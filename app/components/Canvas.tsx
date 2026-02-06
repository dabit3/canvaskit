"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { useEditorStore } from "../store";
import { DesignNode, SceneNode, ToolType, TextNode, Collaborator } from "../types";
import MultiplayerCursors from "./MultiplayerCursors";
import {
  renderNode,
  renderDotGrid,
  renderSelectionBox,
  renderSmartGuides,
  renderMarquee,
  renderDimensionLabel,
  hitTest,
  getResizeHandle,
  getRotationZone,
  computeSmartGuidesWithSnap,
  computeResizeSnap,
  getNodeWorldScene,
  getNodeWorldPosition,
} from "../utils/renderer";
import { fitImageToMaxWidth } from "../utils/imageSizing";

type InteractionMode =
  | "none"
  | "panning"
  | "drawing"
  | "moving"
  | "resizing"
  | "rotating"
  | "marquee"
  | "editing-text";

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 256;

interface CanvasProps {
  collaborators?: Map<string, Collaborator>;
  onPointerUpdate?: (x: number, y: number) => void;
}

export default function Canvas({ collaborators, onPointerUpdate }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const contextMenuRef = useRef<{ x: number; y: number; nodeId: string | null } | null>(null);

  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState(-1);
  const [initialNodeStates, setInitialNodeStates] = useState<Map<string, SceneNode>>(new Map());
  const [spacePressed, setSpacePressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);

  // Text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const editingTextIdRef = useRef<string | null>(null);
  editingTextIdRef.current = editingTextId;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const activeTool = useEditorStore((s) => s.activeTool);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const camera = useEditorStore.getState().camera;
      return {
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom,
      };
    },
    []
  );

  const zoomAtPoint = useCallback((sx: number, sy: number, zoomFactor: number) => {
    const state = useEditorStore.getState();
    const { camera } = state;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * zoomFactor));
    state.setCamera({
      zoom: newZoom,
      x: sx - (sx - camera.x) * (newZoom / camera.zoom),
      y: sy - (sy - camera.y) * (newZoom / camera.zoom),
    });
  }, []);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    );
  }, []);

  const snapLineTo45 = useCallback((dx: number, dy: number) => {
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return { dx, dy };
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return {
      dx: Math.cos(snapped) * distance,
      dy: Math.sin(snapped) * distance,
    };
  }, []);

  // Persistent render refs to avoid re-creating RAF callback
  const interactionModeRef = useRef(interactionMode);
  const dragStartRef = useRef(dragStart);
  const dragCurrentRef = useRef(dragCurrent);
  const renderSnapshotRef = useRef<{
    camera: object | null;
    nodes: object | null;
    pages: object | null;
    currentPageId: string;
    activeTool: ToolType;
    selectedIds: object | null;
    hoveredId: string | null;
    smartGuides: object | null;
    mode: InteractionMode;
    dragStart: { x: number; y: number } | null;
    dragCurrent: { x: number; y: number } | null;
  }>({
    camera: null,
    nodes: null,
    pages: null,
    currentPageId: "",
    activeTool: "SELECT",
    selectedIds: null,
    hoveredId: null,
    smartGuides: null,
    mode: "none",
    dragStart: null,
    dragCurrent: null,
  });
  const canvasMetricsRef = useRef({ width: 0, height: 0, dpr: 0 });
  interactionModeRef.current = interactionMode;
  dragStartRef.current = dragStart;
  dragCurrentRef.current = dragCurrent;
  contextMenuRef.current = contextMenu;

  // Persistent render loop - keeps interaction smooth while avoiding redundant redraw work.
  useEffect(() => {
    let running = true;

    const render = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (!canvas) { animFrameRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { animFrameRef.current = requestAnimationFrame(render); return; }

      const state = useEditorStore.getState();
      const { camera, nodes, pages, currentPageId, selectedIds, hoveredId, smartGuides } = state;
      const page = pages.find((p) => p.id === currentPageId);

      const iMode = interactionModeRef.current;
      const dStart = dragStartRef.current;
      const dCurrent = dragCurrentRef.current;

      const last = renderSnapshotRef.current;
      const snapshotUnchanged =
        last.camera === camera &&
        last.nodes === nodes &&
        last.pages === pages &&
        last.currentPageId === currentPageId &&
        last.activeTool === state.activeTool &&
        last.selectedIds === selectedIds &&
        last.hoveredId === hoveredId &&
        last.smartGuides === smartGuides &&
        last.mode === iMode &&
        last.dragStart === dStart &&
        last.dragCurrent === dCurrent;

      if (snapshotUnchanged) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      renderSnapshotRef.current = {
        camera,
        nodes,
        pages,
        currentPageId,
        activeTool: state.activeTool,
        selectedIds,
        hoveredId,
        smartGuides,
        mode: iMode,
        dragStart: dStart,
        dragCurrent: dCurrent,
      };

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) { animFrameRef.current = requestAnimationFrame(render); return; }
      const metrics = canvasMetricsRef.current;
      if (metrics.width !== w || metrics.height !== h || metrics.dpr !== dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvasMetricsRef.current = { width: w, height: h, dpr };
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.fillStyle = "#e5e5e5";
      ctx.fillRect(0, 0, w, h);

      if (!page) { animFrameRef.current = requestAnimationFrame(render); return; }

      // Apply camera
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Dot grid
      renderDotGrid(ctx, camera, w, h);

      // Render page nodes (skip the node being text-edited to avoid duplicate)
      const currentEditingTextId = editingTextIdRef.current;
      for (const childId of page.children) {
        const node = nodes.get(childId);
        if (node) renderNode(ctx, node, nodes, camera, currentEditingTextId);
      }

      // Hover outline
      if (hoveredId && !selectedIds.has(hoveredId)) {
        const hNode = nodes.get(hoveredId) as SceneNode;
        if (hNode) renderSelectionBox(ctx, getNodeWorldScene(hNode, nodes), camera, true);
      }

      // Selection outlines
      for (const id of selectedIds) {
        const sNode = nodes.get(id) as SceneNode;
        if (sNode) renderSelectionBox(ctx, getNodeWorldScene(sNode, nodes), camera);
      }

      // Smart guides
      if (smartGuides.length > 0) {
        renderSmartGuides(ctx, smartGuides, camera);
      }

      if (iMode === "marquee" && dStart && dCurrent) {
        const ws = screenToWorld(dStart.x, dStart.y);
        const wc = screenToWorld(dCurrent.x, dCurrent.y);
        renderMarquee(ctx, ws, wc, camera);
      }

      // Drawing preview
      if (iMode === "drawing" && dStart && dCurrent) {
        const ws = screenToWorld(dStart.x, dStart.y);
        const wc = screenToWorld(dCurrent.x, dCurrent.y);
        const x = Math.min(ws.x, wc.x);
        const y = Math.min(ws.y, wc.y);
        const pw = Math.abs(wc.x - ws.x);
        const ph = Math.abs(wc.y - ws.y);

        ctx.strokeStyle = "#0d99ff";
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);

        const tool = state.activeTool;
        if (tool === "ELLIPSE") {
          ctx.beginPath();
          ctx.ellipse(x + pw / 2, y + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (tool === "LINE") {
          ctx.beginPath();
          ctx.moveTo(ws.x, ws.y);
          ctx.lineTo(wc.x, wc.y);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, pw, ph);
        }
        ctx.setLineDash([]);

        // Dimension label during drawing
        renderDimensionLabel(ctx, x, y, pw, ph, camera);
      }

      // Dimension label during resizing
      if (iMode === "resizing") {
        for (const id of selectedIds) {
          const sNode = nodes.get(id) as SceneNode;
          if (sNode) {
            const worldNode = getNodeWorldScene(sNode, nodes);
            renderDimensionLabel(ctx, worldNode.x, worldNode.y, worldNode.width, worldNode.height, camera);
          }
        }
      }

      ctx.restore();

      // Empty state hint
      if (page.children.length === 0 && iMode === "none") {
        ctx.save();
        ctx.fillStyle = "#999";
        ctx.font = "14px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "Press F for a frame, R for a rectangle, or drag an image here",
          w / 2,
          h / 2
        );
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [screenToWorld]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      canvasMetricsRef.current = { width: 0, height: 0, dpr: 0 };
      renderSnapshotRef.current.camera = null;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getCanvasOffset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { left: 0, top: 0 };
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const state = useEditorStore.getState();
      const { activeTool, camera, nodes, pages, currentPageId, selectedIds } = state;
      const offset = getCanvasOffset();
      const sx = e.clientX - offset.left;
      const sy = e.clientY - offset.top;
      const world = screenToWorld(sx, sy);
      const page = pages.find((p) => p.id === currentPageId);
      if (!page) return;

      // Space + drag = pan
      if (spacePressed || activeTool === "HAND") {
        setInteractionMode("panning");
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Zoom tool
      if (activeTool === "ZOOM") {
        const zoomFactor = e.altKey ? 0.8 : 1.25;
        zoomAtPoint(sx, sy, zoomFactor);
        return;
      }

      // Drawing tools
      if (
        ["RECTANGLE", "ELLIPSE", "LINE", "FRAME", "POLYGON", "STAR"].includes(
          activeTool
        )
      ) {
        setInteractionMode("drawing");
        setDragStart({ x: sx, y: sy });
        setDragCurrent({ x: sx, y: sy });
        return;
      }

      // Text tool
      if (activeTool === "TEXT") {
        const id = state.createTextNode(world.x, world.y, {
          width: 200,
          height: 24,
        });
        state.setSelectedIds(new Set([id]));
        state.setActiveTool("SELECT");
        setEditingTextId(id);
        setInteractionMode("editing-text");
        return;
      }

      // Select tool
      if (activeTool === "SELECT") {
        // Check resize handles first
        for (const id of selectedIds) {
          const node = nodes.get(id) as SceneNode;
          if (!node) continue;
          const worldNode = getNodeWorldScene(node, nodes);
          const handle = getResizeHandle(world.x, world.y, worldNode, camera);
          if (handle >= 0) {
            setInteractionMode("resizing");
            setResizeHandle(handle);
            setDragStart({ x: sx, y: sy });
            setDragCurrent({ x: sx, y: sy });
            const states = new Map<string, SceneNode>();
            for (const sid of selectedIds) {
              const sn = nodes.get(sid) as SceneNode;
              if (sn) states.set(sid, { ...sn });
            }
            setInitialNodeStates(states);
            return;
          }

          // Check rotation zone
          if (getRotationZone(world.x, world.y, worldNode, camera)) {
            setInteractionMode("rotating");
            setDragStart({ x: sx, y: sy });
            setDragCurrent({ x: sx, y: sy });
            const states = new Map<string, SceneNode>();
            for (const sid of selectedIds) {
              const sn = nodes.get(sid) as SceneNode;
              if (sn) states.set(sid, { ...sn });
            }
            setInitialNodeStates(states);
            return;
          }
        }

        // Hit test
        const hitId = hitTest(world.x, world.y, nodes, page.children);

        if (hitId) {
          const hitNode = nodes.get(hitId);
          if (hitNode && hitNode.locked) return;

          if (e.shiftKey) {
            state.toggleSelection(hitId);
          } else if (!selectedIds.has(hitId)) {
            state.setSelectedIds(new Set([hitId]));
          }

          // Start moving
          setInteractionMode("moving");
          setDragStart({ x: sx, y: sy });
          setDragCurrent({ x: sx, y: sy });
          const currentSelected = e.shiftKey
            ? useEditorStore.getState().selectedIds
            : new Set([hitId]);
          const states = new Map<string, SceneNode>();
          for (const sid of currentSelected) {
            const sn = nodes.get(sid) as SceneNode;
            if (sn) states.set(sid, { ...sn });
          }
          setInitialNodeStates(states);
        } else {
          // Start marquee
          if (!e.shiftKey) {
            state.setSelectedIds(new Set());
          }
          setInteractionMode("marquee");
          setDragStart({ x: sx, y: sy });
          setDragCurrent({ x: sx, y: sy });
        }
      }
    },
    [screenToWorld, spacePressed, zoomAtPoint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const state = useEditorStore.getState();
      const { camera, nodes, pages, currentPageId } = state;
      const offset = getCanvasOffset();
      const sx = e.clientX - offset.left;
      const sy = e.clientY - offset.top;
      const world = screenToWorld(sx, sy);

      if (onPointerUpdate) {
        onPointerUpdate(world.x, world.y);
      }

      const page = pages.find((p) => p.id === currentPageId);

      // Update hover + cursor hints for resize/rotate zones
      if (interactionMode === "none" && page && state.activeTool === "SELECT") {
        const hitId = hitTest(world.x, world.y, nodes, page.children);
        state.setHoveredId(hitId);

        // Check if hovering over resize handle or rotation zone of selected nodes
        let foundCursor: string | null = null;
        for (const id of state.selectedIds) {
          const sNode = nodes.get(id) as SceneNode;
          if (!sNode) continue;
          const worldNode = getNodeWorldScene(sNode, nodes);
          const handle = getResizeHandle(world.x, world.y, worldNode, camera);
          if (handle >= 0) {
            const cursors = ["nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"];
            foundCursor = cursors[handle];
            break;
          }
          if (getRotationZone(world.x, world.y, worldNode, camera)) {
            foundCursor = "grab";
            break;
          }
        }
        setHoverCursor(foundCursor);
      }

      if (interactionMode === "panning" && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        state.setCamera({
          x: camera.x + dx,
          y: camera.y + dy,
        });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      if (
        (interactionMode === "drawing" || interactionMode === "marquee") &&
        dragStart
      ) {
        if (interactionMode === "drawing" && e.shiftKey) {
          const ws = screenToWorld(dragStart.x, dragStart.y);
          const wc = screenToWorld(sx, sy);

          if (state.activeTool === "LINE") {
            const snapped = snapLineTo45(wc.x - ws.x, wc.y - ws.y);
            setDragCurrent({
              x: (ws.x + snapped.dx) * camera.zoom + camera.x,
              y: (ws.y + snapped.dy) * camera.zoom + camera.y,
            });
          } else {
            const dx = wc.x - ws.x;
            const dy = wc.y - ws.y;
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            const sxn = dx < 0 ? -1 : 1;
            const syn = dy < 0 ? -1 : 1;
            const constrainedX = ws.x + sxn * size;
            const constrainedY = ws.y + syn * size;
            setDragCurrent({
              x: constrainedX * camera.zoom + camera.x,
              y: constrainedY * camera.zoom + camera.y,
            });
          }
        } else {
          setDragCurrent({ x: sx, y: sy });
        }
        return;
      }

      if (interactionMode === "moving" && dragStart) {
        const dx = (sx - dragStart.x) / camera.zoom;
        const dy = (sy - dragStart.y) / camera.zoom;
        const movingIds = Array.from(initialNodeStates.keys());

        const simulatedNodes = new Map(nodes);
        for (const [id, initial] of initialNodeStates) {
          simulatedNodes.set(id, {
            ...initial,
            x: initial.x + dx,
            y: initial.y + dy,
          } as SceneNode);
        }

        let snapDx = 0;
        let snapDy = 0;
        let guides: ReturnType<typeof computeSmartGuidesWithSnap>["guides"] = [];
        if (page) {
          const snapResult = computeSmartGuidesWithSnap(movingIds, simulatedNodes, page.children);
          guides = snapResult.guides;
          snapDx = snapResult.snapOffset.x;
          snapDy = snapResult.snapOffset.y;
        }

        for (const [id, initial] of initialNodeStates) {
          state.updateNode(id, {
            x: initial.x + dx + snapDx,
            y: initial.y + dy + snapDy,
          });
        }
        state.setSmartGuides(guides);
        return;
      }

      if (interactionMode === "resizing" && dragStart) {
        const rawDx = (sx - dragStart.x) / camera.zoom;
        const rawDy = (sy - dragStart.y) / camera.zoom;

        for (const [id, initial] of initialNodeStates) {
          // Rotate mouse delta into node's local coordinate frame
          let dx = rawDx;
          let dy = rawDy;
          if (initial.rotation) {
            const rad = -(initial.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            dx = rawDx * cos - rawDy * sin;
            dy = rawDx * sin + rawDy * cos;
          }

          let newX = initial.x;
          let newY = initial.y;
          let newW = initial.width;
          let newH = initial.height;

          // Handle indices: 0=TL, 1=TC, 2=TR, 3=MR, 4=BR, 5=BC, 6=BL, 7=ML
          switch (resizeHandle) {
            case 0: // TL
              newX = initial.x + dx;
              newY = initial.y + dy;
              newW = initial.width - dx;
              newH = initial.height - dy;
              break;
            case 1: // TC
              newY = initial.y + dy;
              newH = initial.height - dy;
              break;
            case 2: // TR
              newY = initial.y + dy;
              newW = initial.width + dx;
              newH = initial.height - dy;
              break;
            case 3: // MR
              newW = initial.width + dx;
              break;
            case 4: // BR
              newW = initial.width + dx;
              newH = initial.height + dy;
              break;
            case 5: // BC
              newH = initial.height + dy;
              break;
            case 6: // BL
              newX = initial.x + dx;
              newW = initial.width - dx;
              newH = initial.height + dy;
              break;
            case 7: // ML
              newX = initial.x + dx;
              newW = initial.width - dx;
              break;
          }

          // Shift = maintain aspect ratio
          if (e.shiftKey && initial.width > 0 && initial.height > 0) {
            const aspect = initial.width / initial.height;
            if ([0, 2, 4, 6].includes(resizeHandle)) {
              newH = newW / aspect;
            }
          }

          // Minimum size
          if (newW < 1) { newW = 1; newX = initial.x + initial.width - 1; }
          if (newH < 1) { newH = 1; newY = initial.y + initial.height - 1; }

          // Snap active edges to nearby candidates
          const page = pages.find((p) => p.id === currentPageId);
          if (page) {
            const snap = computeResizeSnap(id, newX, newY, newW, newH, resizeHandle, nodes, page.children);
            state.setSmartGuides(snap.guides);

            // Apply X snap to the correct edge
            if (snap.snapDx !== 0) {
              const movesLeft = [0, 6, 7].includes(resizeHandle);
              const movesRight = [2, 3, 4].includes(resizeHandle);
              if (movesLeft) {
                newX += snap.snapDx;
                newW -= snap.snapDx;
              } else if (movesRight) {
                newW += snap.snapDx;
              }
            }

            // Apply Y snap to the correct edge
            if (snap.snapDy !== 0) {
              const movesTop = [0, 1, 2].includes(resizeHandle);
              const movesBottom = [4, 5, 6].includes(resizeHandle);
              if (movesTop) {
                newY += snap.snapDy;
                newH -= snap.snapDy;
              } else if (movesBottom) {
                newH += snap.snapDy;
              }
            }
          }

          state.updateNode(id, { x: newX, y: newY, width: newW, height: newH });
        }
        return;
      }

      if (interactionMode === "rotating" && dragStart) {
        for (const [id, initial] of initialNodeStates) {
          const cx = initial.x + initial.width / 2;
          const cy = initial.y + initial.height / 2;
          const startWorld = screenToWorld(dragStart.x, dragStart.y);
          const startAngle = Math.atan2(startWorld.y - cy, startWorld.x - cx);
          const currentAngle = Math.atan2(world.y - cy, world.x - cx);
          let angleDeg = ((currentAngle - startAngle) * 180) / Math.PI;

          if (e.shiftKey) {
            angleDeg = Math.round(angleDeg / 15) * 15;
          }

          state.updateNode(id, {
            rotation: initial.rotation + angleDeg,
          });
        }
        return;
      }
    },
    [interactionMode, dragStart, initialNodeStates, resizeHandle, screenToWorld, snapLineTo45, onPointerUpdate]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const state = useEditorStore.getState();
      const { nodes, pages, currentPageId } = state;
      const offset = getCanvasOffset();
      const sx = e.clientX - offset.left;
      const sy = e.clientY - offset.top;

      if (interactionMode === "drawing" && dragStart) {
        const ws = screenToWorld(dragStart.x, dragStart.y);
        const wc = screenToWorld(sx, sy);
        const x = Math.min(ws.x, wc.x);
        const y = Math.min(ws.y, wc.y);
        let w = Math.abs(wc.x - ws.x);
        let h = Math.abs(wc.y - ws.y);

        if (w < 2 && h < 2) {
          w = 100;
          h = 100;
        }

        if (e.shiftKey && state.activeTool !== "LINE") {
          const size = Math.max(w, h);
          w = size;
          h = size;
        }

        const typeMap: Record<string, SceneNode["type"]> = {
          RECTANGLE: "RECTANGLE",
          ELLIPSE: "ELLIPSE",
          LINE: "LINE",
          FRAME: "FRAME",
          POLYGON: "POLYGON",
          STAR: "STAR",
        };

        const nodeType = typeMap[state.activeTool] || "RECTANGLE";

        if (nodeType === "LINE") {
          let dx = wc.x - ws.x;
          let dy = wc.y - ws.y;
          if (e.shiftKey) {
            const snapped = snapLineTo45(dx, dy);
            dx = snapped.dx;
            dy = snapped.dy;
          }
          const id = state.createShape(nodeType, ws.x, ws.y, dx, dy);
          state.setSelectedIds(new Set([id]));
        } else {
          const id = state.createShape(nodeType, x, y, w, h);
          state.setSelectedIds(new Set([id]));
        }

        state.setActiveTool("SELECT");
      }

      if (interactionMode === "marquee" && dragStart) {
        const ws = screenToWorld(dragStart.x, dragStart.y);
        const wc = screenToWorld(sx, sy);
        const mx = Math.min(ws.x, wc.x);
        const my = Math.min(ws.y, wc.y);
        const mw = Math.abs(wc.x - ws.x);
        const mh = Math.abs(wc.y - ws.y);

        const page = pages.find((p) => p.id === currentPageId);
        if (page && mw > 2 && mh > 2) {
          const selected = new Set<string>();
          const checkChildren = (childIds: string[]) => {
            for (const id of childIds) {
              const node = nodes.get(id) as SceneNode;
              if (!node || !node.visible) continue;
              const worldNode = getNodeWorldPosition(node, nodes);
              if (
                worldNode.x >= mx &&
                worldNode.y >= my &&
                worldNode.x + node.width <= mx + mw &&
                worldNode.y + node.height <= my + mh
              ) {
                selected.add(id);
              }
              if (node.children.length > 0) {
                checkChildren(node.children);
              }
            }
          };
          checkChildren(page.children);
          state.setSelectedIds(selected);
        }
      }

      if (interactionMode === "moving" || interactionMode === "resizing" || interactionMode === "rotating") {
        state.pushHistory(
          interactionMode === "moving"
            ? "Move"
            : interactionMode === "resizing"
            ? "Resize"
            : "Rotate"
        );
        state.setSmartGuides([]);
      }

      setInteractionMode("none");
      setDragStart(null);
      setDragCurrent(null);
      setResizeHandle(-1);
      setInitialNodeStates(new Map());
    },
    [interactionMode, dragStart, screenToWorld, snapLineTo45]
  );

  // Wheel handler via native event listener (non-passive, so preventDefault works)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      const { camera } = state;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        zoomAtPoint(sx, sy, zoomFactor);
      } else {
        // Pan
        state.setCamera({
          x: camera.x - e.deltaX,
          y: camera.y - e.deltaY,
        });
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [zoomAtPoint]);

  // Paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const state = useEditorStore.getState();
          const { camera } = state;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const centerWorld = screenToWorld(rect.width / 2, rect.height / 2);
          const maxImportWidth = rect.width / camera.zoom;
          const { width, height } = fitImageToMaxWidth(img.width, img.height, maxImportWidth);

          state.createShape(
            "RECTANGLE",
            centerWorld.x - width / 2,
            centerWorld.y - height / 2,
            width,
            height,
            {
              name: "Pasted Image",
              fills: [{
                type: "IMAGE",
                imageRef: reader.result as string,
                scaleMode: "FILL",
              }],
            }
          );
          state.addToast("Pasted image");
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isEditableTarget, screenToWorld]);

  // Double-click to edit text
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const state = useEditorStore.getState();
      const { nodes, pages, currentPageId } = state;
      const offset = getCanvasOffset();
      const sx = e.clientX - offset.left;
      const sy = e.clientY - offset.top;
      const world = screenToWorld(sx, sy);
      const page = pages.find((p) => p.id === currentPageId);
      if (!page) return;

      const hitId = hitTest(world.x, world.y, nodes, page.children);
      if (hitId) {
        const node = nodes.get(hitId);
        if (node?.type === "TEXT") {
          setEditingTextId(hitId);
          setInteractionMode("editing-text");
          state.setSelectedIds(new Set([hitId]));
        } else if (node?.type === "FRAME" || node?.type === "GROUP") {
          // Deep select - enter the frame/group
          const childHit = hitTest(world.x, world.y, nodes, node.children);
          if (childHit) {
            state.setSelectedIds(new Set([childHit]));
          }
        }
      }
    },
    [screenToWorld]
  );

  const zoomToBounds = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = useEditorStore.getState();
    const rect = canvas.getBoundingClientRect();
    const padding = 64;
    const viewportWidth = Math.max(1, rect.width - padding * 2);
    const viewportHeight = Math.max(1, rect.height - padding * 2);
    const safeWidth = Math.max(1, bounds.width);
    const safeHeight = Math.max(1, bounds.height);
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(viewportWidth / safeWidth, viewportHeight / safeHeight))
    );

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    state.setCamera({
      zoom,
      x: rect.width / 2 - centerX * zoom,
      y: rect.height / 2 - centerY * zoom,
    });
  }, []);

  const getBoundsForIds = useCallback((ids: Iterable<string>, nodes: Map<string, DesignNode>) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of ids) {
      const node = nodes.get(id) as SceneNode | undefined;
      if (!node || !node.visible) continue;
      const world = getNodeWorldPosition(node, nodes);
      minX = Math.min(minX, world.x);
      minY = Math.min(minY, world.y);
      maxX = Math.max(maxX, world.x + node.width);
      maxY = Math.max(maxY, world.y + node.height);
    }

    if (!isFinite(minX) || !isFinite(minY)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when editing text
      if (editingTextId) {
        if (e.key === "Escape") {
          setEditingTextId(null);
          setInteractionMode("none");
        }
        return;
      }

      if (isEditableTarget(e.target)) {
        return;
      }

      const state = useEditorStore.getState();
      const { selectedIds } = state;

      // Escape: dismiss context menu, deselect, or switch to select tool
      if (e.key === "Escape") {
        if (contextMenuRef.current) {
          setContextMenu(null);
          return;
        }
        if (state.selectedIds.size > 0) { state.setSelectedIds(new Set()); return; }
        state.setActiveTool("SELECT");
        return;
      }

      if (e.key === "Alt") {
        setAltPressed(true);
      }

      if (e.key === " ") {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const toolMap: Record<string, ToolType> = {
          v: "SELECT",
          f: "FRAME",
          r: "RECTANGLE",
          o: "ELLIPSE",
          l: "LINE",
          p: "PEN",
          t: "TEXT",
          h: "HAND",
          z: "ZOOM",
        };
        if (toolMap[e.key.toLowerCase()]) {
          state.setActiveTool(toolMap[e.key.toLowerCase()]);
          return;
        }
      }

      // Arrow keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        state.moveNodes(ids, dx, dy);
        state.pushHistory("Nudge");
        return;
      }

      // Delete
      if (e.key === "Backspace" || e.key === "Delete") {
        const ids = Array.from(selectedIds);
        if (ids.length > 0) {
          state.deleteNodes(ids);
          state.pushHistory("Delete");
        }
        return;
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) state.redo();
            else state.undo();
            break;
          case "c":
            e.preventDefault();
            state.copyNodes();
            break;
          case "v":
            e.preventDefault();
            state.pasteNodes();
            break;
          case "d":
            e.preventDefault();
            state.duplicateNodes(Array.from(selectedIds));
            break;
          case "g":
            e.preventDefault();
            if (e.shiftKey) {
              state.ungroupNodes(Array.from(selectedIds));
            } else {
              state.groupNodes(Array.from(selectedIds));
            }
            break;
          case "a":
            e.preventDefault();
            {
              const page = state.pages.find((p) => p.id === state.currentPageId);
              if (page) state.setSelectedIds(new Set(page.children));
            }
            break;
          case "]":
            e.preventDefault();
            if (e.shiftKey) state.bringToFront(Array.from(selectedIds));
            else state.bringForward(Array.from(selectedIds));
            break;
          case "[":
            e.preventDefault();
            if (e.shiftKey) state.sendToBack(Array.from(selectedIds));
            else state.sendBackward(Array.from(selectedIds));
            break;
          case "s":
            e.preventDefault();
            {
              const json = state.exportDocument();
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${state.documentName}.canvas.json`;
              a.click();
              URL.revokeObjectURL(url);
              state.addToast("Saved to file");
            }
            break;
          case "=":
          case "+":
            e.preventDefault();
            {
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                zoomAtPoint(rect.width / 2, rect.height / 2, 1.1);
              }
            }
            break;
          case "-":
          case "_":
            e.preventDefault();
            {
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                zoomAtPoint(rect.width / 2, rect.height / 2, 0.9);
              }
            }
            break;
          case "0":
            e.preventDefault();
            {
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const factor = 1 / Math.max(state.camera.zoom, 0.0001);
                zoomAtPoint(rect.width / 2, rect.height / 2, factor);
              }
            }
            break;
          case "1":
            e.preventDefault();
            {
              const pageNodes = state.getCurrentPageNodes();
              const bounds = getBoundsForIds(pageNodes.map((n) => n.id), state.nodes);
              if (bounds) {
                zoomToBounds(bounds);
              }
            }
            break;
          case "2":
            e.preventDefault();
            {
              const bounds = getBoundsForIds(selectedIds, state.nodes);
              if (bounds) {
                zoomToBounds(bounds);
              }
            }
            break;
          case "o":
            e.preventDefault();
            {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    state.importDocument(reader.result as string);
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }
            break;
          case "\\":
            e.preventDefault();
            state.setShowLeftPanel(!state.showLeftPanel);
            state.setShowRightPanel(!state.showRightPanel);
            break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setSpacePressed(false);
      }
      if (e.key === "Alt") {
        setAltPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [editingTextId, getBoundsForIds, isEditableTarget, zoomAtPoint, zoomToBounds]);

  // Custom rotate cursor (SVG data URI)
  const rotateCursorUrl = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-3-6.7'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E") 9 9, crosshair`;

  // Cursor
  const getCursor = () => {
    const tool = activeTool;
    if (spacePressed || tool === "HAND") return "grab";
    if (interactionMode === "panning") return "grabbing";
    if (tool === "ZOOM") return altPressed ? "zoom-out" : "zoom-in";
    if (["RECTANGLE", "ELLIPSE", "LINE", "FRAME", "TEXT", "POLYGON", "STAR"].includes(tool)) return "crosshair";
    if (interactionMode === "moving") return "move";
    if (interactionMode === "rotating") return rotateCursorUrl;
    if (interactionMode === "resizing") {
      const cursors = ["nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"];
      return cursors[resizeHandle] || "default";
    }
    if (interactionMode === "drawing") return "crosshair";
    if (interactionMode === "none" && hoverCursor) {
      return hoverCursor === "grab" ? rotateCursorUrl : hoverCursor;
    }
    return "default";
  };

  // Text editing overlay
  const getTextOverlayStyle = (): React.CSSProperties | null => {
    if (!editingTextId) return null;
    const state = useEditorStore.getState();
    const node = state.nodes.get(editingTextId) as TextNode;
    if (!node) return null;
    const { camera } = state;
    const worldPos = getNodeWorldPosition(node, state.nodes);

    const scaledFontSize = (node.fontSize || 16) * camera.zoom;
    const scaledLineHeight = node.lineHeight === "AUTO" ? scaledFontSize * 1.4 : node.lineHeight * camera.zoom;
    // CSS line boxes center glyphs vertically when line-height > font-size.
    // Canvas text with baseline "top" does not, so offset edit overlay upward.
    const leadingCompensation = Math.max(0, (scaledLineHeight - scaledFontSize) / 2);
    const textStroke = node.strokes?.find((stroke) => stroke.type === "SOLID");
    const textDecoration =
      node.textDecoration === "UNDERLINE"
        ? "underline"
        : node.textDecoration === "STRIKETHROUGH"
          ? "line-through"
          : "none";

    return {
      position: "absolute",
      left: worldPos.x * camera.zoom + camera.x,
      top: worldPos.y * camera.zoom + camera.y - leadingCompensation,
      width: node.width * camera.zoom,
      height: node.height * camera.zoom + leadingCompensation,
      fontSize: scaledFontSize,
      fontFamily: `${node.fontFamily || "Inter"}, system-ui, sans-serif`,
      fontWeight: node.fontWeight || 400,
      color: node.fills?.[0]?.type === "SOLID"
        ? `rgba(${Math.round(node.fills[0].color.r * 255)}, ${Math.round(node.fills[0].color.g * 255)}, ${Math.round(node.fills[0].color.b * 255)}, ${node.fills[0].color.a})`
        : "#000",
      background: "transparent",
      border: "none",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      padding: 0,
      margin: 0,
      boxSizing: "border-box" as const,
      lineHeight: `${scaledLineHeight}px`,
      textAlign: (node.textAlign?.toLowerCase() || "left") as React.CSSProperties["textAlign"],
      textDecoration,
      zIndex: 1000,
      letterSpacing: node.letterSpacing ? `${node.letterSpacing * camera.zoom}px` : undefined,
      WebkitTextStrokeWidth:
        textStroke && (node.strokeWeight || 0) > 0 ? `${node.strokeWeight * camera.zoom}px` : undefined,
      WebkitTextStrokeColor:
        textStroke && (node.strokeWeight || 0) > 0
          ? `rgba(${Math.round(textStroke.color.r * 255)}, ${Math.round(textStroke.color.g * 255)}, ${Math.round(textStroke.color.b * 255)}, ${textStroke.color.a * textStroke.opacity})`
          : undefined,
    };
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      const { nodes, pages, currentPageId } = state;
      const offset = getCanvasOffset();
      const sx = e.clientX - offset.left;
      const sy = e.clientY - offset.top;
      const world = screenToWorld(sx, sy);
      const page = pages.find((p) => p.id === currentPageId);
      if (!page) return;

      const hitId = hitTest(world.x, world.y, nodes, page.children);
      if (hitId && !state.selectedIds.has(hitId)) {
        state.setSelectedIds(new Set([hitId]));
      }
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: hitId });
    },
    [screenToWorld]
  );

  const textStyle = getTextOverlayStyle();

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {collaborators && <MultiplayerCursors collaborators={collaborators} />}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {editingTextId && textStyle && (
        <textarea
          ref={textInputRef}
          className="text-edit-overlay"
          style={textStyle}
          defaultValue={
            (useEditorStore.getState().nodes.get(editingTextId) as TextNode)
              ?.characters || ""
          }
          autoFocus
          onChange={(e) => {
            useEditorStore.getState().updateNode(editingTextId, {
              characters: e.target.value,
            } as Partial<TextNode>);
          }}
          onBlur={() => {
            useEditorStore.getState().pushHistory("Edit text");
            setEditingTextId(null);
            setInteractionMode("none");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingTextId(null);
              setInteractionMode("none");
            }
            e.stopPropagation();
          }}
        />
      )}
      {/* Canvas context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-50 bg-[#2c2c2c] border border-[#444] rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId ? (
              <>
                <CtxBtn label="Copy" shortcut="⌘C" onClick={() => { useEditorStore.getState().copyNodes(); setContextMenu(null); }} />
                <CtxBtn label="Paste" shortcut="⌘V" onClick={() => { useEditorStore.getState().pasteNodes(); setContextMenu(null); }} />
                <CtxBtn label="Duplicate" shortcut="⌘D" onClick={() => { useEditorStore.getState().duplicateNodes(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <div className="h-px bg-white/10 my-1" />
                <CtxBtn label="Group Selection" shortcut="⌘G" onClick={() => { useEditorStore.getState().groupNodes(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <CtxBtn label="Ungroup" shortcut="⌘⇧G" onClick={() => { useEditorStore.getState().ungroupNodes(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <div className="h-px bg-white/10 my-1" />
                <CtxBtn label="Bring Forward" shortcut="⌘]" onClick={() => { useEditorStore.getState().bringForward(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <CtxBtn label="Bring to Front" shortcut="⌘⇧]" onClick={() => { useEditorStore.getState().bringToFront(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <CtxBtn label="Send Backward" shortcut="⌘[" onClick={() => { useEditorStore.getState().sendBackward(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <CtxBtn label="Send to Back" shortcut="⌘⇧[" onClick={() => { useEditorStore.getState().sendToBack(Array.from(useEditorStore.getState().selectedIds)); setContextMenu(null); }} />
                <div className="h-px bg-white/10 my-1" />
                <CtxBtn label="Delete" shortcut="⌫" onClick={() => { const ids = Array.from(useEditorStore.getState().selectedIds); useEditorStore.getState().deleteNodes(ids); useEditorStore.getState().pushHistory("Delete"); setContextMenu(null); }} />
              </>
            ) : (
              <>
                <CtxBtn label="Paste" shortcut="⌘V" onClick={() => { useEditorStore.getState().pasteNodes(); setContextMenu(null); }} />
                <div className="h-px bg-white/10 my-1" />
                <CtxBtn label="Select All" shortcut="⌘A" onClick={() => { const s = useEditorStore.getState(); const page = s.pages.find(p => p.id === s.currentPageId); if (page) s.setSelectedIds(new Set(page.children)); setContextMenu(null); }} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CtxBtn({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 flex justify-between items-center"
      onClick={onClick}
    >
      <span>{label}</span>
      {shortcut && <span className="text-white/30 ml-4 text-[10px]">{shortcut}</span>}
    </button>
  );
}
