"use client";

import React, { useState, useCallback, useRef } from "react";
import { useEditorStore } from "../store";

interface DragState {
  dragId: string | null;
  dropTargetId: string | null;
  dropPosition: "above" | "below" | null;
}

function LayerItem({
  nodeId,
  depth = 0,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  nodeId: string;
  depth?: number;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: "above" | "below") => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const node = useEditorStore((s) => s.nodes.get(nodeId));
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const toggleSelection = useEditorStore((s) => s.toggleSelection);
  const setHoveredId = useEditorStore((s) => s.setHoveredId);
  const updateNode = useEditorStore((s) => s.updateNode);

  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  if (!node) return null;

  const isSelected = selectedIds.has(nodeId);
  const isHovered = hoveredId === nodeId;
  const hasChildren = node.children.length > 0;

  const typeIcons: Record<string, string> = {
    FRAME: "▢",
    RECTANGLE: "□",
    ELLIPSE: "○",
    LINE: "╱",
    TEXT: "T",
    GROUP: "⊞",
    COMPONENT: "◆",
    INSTANCE: "◇",
    IMAGE: "🖼",
    VECTOR: "⬡",
    STAR: "★",
    POLYGON: "⬠",
  };

  return (
    <>
      <div
        ref={rowRef}
        className={`flex items-center h-7 px-2 cursor-pointer text-xs select-none group relative transition-colors ${
          isSelected
            ? "bg-[#0d99ff]/15 text-white"
            : isHovered
            ? "bg-white/[0.06] text-white/80"
            : "text-white/55 hover:bg-white/[0.04]"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", nodeId);
          onDragStart(nodeId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = rowRef.current?.getBoundingClientRect();
          if (rect) {
            const midY = rect.top + rect.height / 2;
            onDragOver(nodeId, e.clientY < midY ? "above" : "below");
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        onDragEnd={onDragEnd}
        onClick={(e) => {
          if (e.shiftKey) toggleSelection(nodeId);
          else setSelectedIds(new Set([nodeId]));
        }}
        onMouseEnter={() => setHoveredId(nodeId)}
        onMouseLeave={() => setHoveredId(null)}
        onDoubleClick={() => setEditing(true)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Drop indicator */}
        {dragState.dropTargetId === nodeId && dragState.dropPosition === "above" && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#0d99ff] z-10" />
        )}
        {dragState.dropTargetId === nodeId && dragState.dropPosition === "below" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d99ff] z-10" />
        )}
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            className="w-4 h-4 flex items-center justify-center text-[10px] text-white/30 hover:text-white/70 mr-0.5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 mr-0.5" />
        )}

        {/* Type icon */}
        <span className="w-4 text-center text-[10px] mr-1.5 opacity-50">
          {typeIcons[node.type] || "?"}
        </span>

        {/* Name */}
        {editing ? (
          <input
            className="flex-1 bg-[#3c3c3c] text-white text-xs px-1 py-0.5 rounded border border-[#0d99ff] outline-none"
            value={node.name}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateNode(nodeId, { name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditing(false);
              e.stopPropagation();
            }}
          />
        ) : (
          <span className="flex-1 truncate">{node.name}</span>
        )}

        {/* Visibility toggle */}
        <button
          className={`w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all ${
            node.visible ? "text-white/35 hover:text-white/70" : "text-white/15 hover:text-white/40"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            updateNode(nodeId, { visible: !node.visible });
          }}
          title={node.visible ? "Hide" : "Show"}
        >
          {node.visible ? "👁" : "—"}
        </button>

        {/* Lock toggle */}
        <button
          className={`w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all ${
            node.locked ? "text-white/50 hover:text-white/80" : "text-white/15 hover:text-white/40"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            updateNode(nodeId, { locked: !node.locked });
          }}
          title={node.locked ? "Unlock" : "Lock"}
        >
          {node.locked ? "🔒" : "🔓"}
        </button>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((childId) => (
            <LayerItem
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function ContextMenu({
  x,
  y,
  nodeId,
  onClose,
}: {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}) {
  const store = useEditorStore();

  const items = [
    {
      label: "Rename",
      action: () => {
        // handled by double-click
      },
    },
    {
      label: "Duplicate",
      shortcut: "Ctrl+D",
      action: () => {
        store.duplicateNodes([nodeId]);
      },
    },
    {
      label: "Delete",
      shortcut: "Del",
      action: () => {
        store.deleteNodes([nodeId]);
        store.pushHistory("Delete");
      },
    },
    { label: "---" },
    {
      label: "Group Selection",
      shortcut: "Ctrl+G",
      action: () => {
        store.groupNodes(Array.from(store.selectedIds));
      },
    },
    {
      label: "Bring to Front",
      shortcut: "Ctrl+Shift+]",
      action: () => {
        store.bringToFront([nodeId]);
      },
    },
    {
      label: "Send to Back",
      shortcut: "Ctrl+Shift+[",
      action: () => {
        store.sendToBack([nodeId]);
      },
    },
    { label: "---" },
    {
      label: "Copy",
      shortcut: "Ctrl+C",
      action: () => {
        store.setSelectedIds(new Set([nodeId]));
        store.copyNodes();
      },
    },
    {
      label: "Paste",
      shortcut: "Ctrl+V",
      action: () => {
        store.pasteNodes();
      },
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-[#2a2a2a] border border-white/[0.1] rounded-lg shadow-2xl py-1.5 min-w-[200px] backdrop-blur-sm"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.label === "---" ? (
            <div key={i} className="h-px bg-white/10 my-1" />
          ) : (
            <button
              key={i}
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={() => {
                item.action?.();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="text-white/30 ml-4">{item.shortcut}</span>
              )}
            </button>
          )
        )}
      </div>
    </>
  );
}

export default function LayersPanel() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage);
  const addPage = useEditorStore((s) => s.addPage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const nodes = useEditorStore((s) => s.nodes);

  const currentPage = pages.find((p) => p.id === currentPageId);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  // Drag-and-drop state for layer reordering
  const [dragState, setDragState] = useState<DragState>({
    dragId: null,
    dropTargetId: null,
    dropPosition: null,
  });

  const handleDragStart = useCallback((id: string) => {
    setDragState({ dragId: id, dropTargetId: null, dropPosition: null });
  }, []);

  const handleDragOver = useCallback((id: string, position: "above" | "below") => {
    setDragState((prev) => ({
      ...prev,
      dropTargetId: id,
      dropPosition: position,
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ dragId: null, dropTargetId: null, dropPosition: null });
  }, []);

  const handleDrop = useCallback(() => {
    const { dragId, dropTargetId, dropPosition } = dragState;
    if (!dragId || !dropTargetId || !dropPosition || dragId === dropTargetId) {
      handleDragEnd();
      return;
    }

    const dragNode = nodes.get(dragId);
    const dropNode = nodes.get(dropTargetId);
    if (!dragNode || !dropNode) { handleDragEnd(); return; }

    // Only support reordering within the same parent for now
    const dragParent = dragNode.parentId;
    const dropParent = dropNode.parentId;
    if (dragParent !== dropParent) { handleDragEnd(); return; }

    // Get the siblings list (actual order, not reversed)
    const siblings = dragParent
      ? nodes.get(dragParent)?.children || []
      : currentPage?.children || [];

    const dropIdx = siblings.indexOf(dropTargetId);
    if (dropIdx === -1) { handleDragEnd(); return; }

    // The list is displayed reversed: top of list = high index = front.
    // "above" in the visual list means moving toward the front (higher index).
    // "below" in the visual list means moving toward the back (lower index).
    let targetIdx = dropPosition === "above" ? dropIdx + 1 : dropIdx;

    // Adjust if dragging from before the target (removal shifts indices)
    const dragIdx = siblings.indexOf(dragId);
    if (dragIdx < targetIdx) targetIdx--;

    if (targetIdx !== dragIdx) {
      reorderNode(dragId, targetIdx);
      pushHistory("Reorder layer");
    }

    handleDragEnd();
  }, [dragState, nodes, currentPage, reorderNode, pushHistory, handleDragEnd]);

  return (
    <div className="flex flex-col h-full">
      {/* Pages */}
      <div className="border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs font-semibold text-white/45">
            Pages
          </span>
          <button
            className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-md text-sm transition-colors"
            onClick={addPage}
            title="Add page"
          >
            +
          </button>
        </div>
        <div className="pb-2">
          {pages.map((page) => (
            <div
              key={page.id}
              className={`group/page flex items-center h-7 px-4 cursor-pointer text-xs transition-colors ${
                page.id === currentPageId
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:bg-white/[0.04]"
              }`}
              onClick={() => setCurrentPage(page.id)}
              onDoubleClick={() => setEditingPageId(page.id)}
            >
              {editingPageId === page.id ? (
                <input
                  className="flex-1 bg-[#3c3c3c] text-white text-xs px-1 py-0.5 rounded border border-[#0d99ff] outline-none"
                  value={page.name}
                  autoFocus
                  onChange={(e) => renamePage(page.id, e.target.value)}
                  onBlur={() => setEditingPageId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingPageId(null);
                    e.stopPropagation();
                  }}
                />
              ) : (
                <>
                  <span className="truncate flex-1">{page.name}</span>
                  {pages.length > 1 && (
                    <button
                      className="ml-1 text-white/30 hover:text-white/80 text-xs opacity-0 group-hover/page:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                      }}
                      title="Delete page"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Layers */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center px-4 py-2.5">
          <span className="text-xs font-semibold text-white/45">
            Layers
          </span>
        </div>
        <div className="pb-2">
          {currentPage?.children
            .slice()
            .reverse()
            .map((childId) => (
              <LayerItem
                key={childId}
                nodeId={childId}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))}
        </div>
        {currentPage?.children.length === 0 && (
          <div className="px-4 py-6 text-xs text-white/20 text-center">
            No layers yet
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-white/[0.06] px-4 py-2 text-[10px] text-white/30">
        {selectedIds.size > 0
          ? `${selectedIds.size} selected`
          : `${currentPage?.children.length || 0} objects`}
      </div>
    </div>
  );
}
