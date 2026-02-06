import { DesignNode, SceneNode, TextNode, Camera, Paint, RGBA, SmartGuide, ImagePaint } from "../types";

// Image cache for rendering IMAGE fills
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(imageRef: string): HTMLImageElement | null {
  if (imageCache.has(imageRef)) {
    const img = imageCache.get(imageRef)!;
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
  const img = new Image();
  img.src = imageRef;
  imageCache.set(imageRef, img);
  return null; // not loaded yet, will render next frame
}

interface AxisGuideMatch {
  type: "vertical" | "horizontal";
  position: number;
  from: number;
  to: number;
}

export function rgbaToCSS(c: RGBA, opacity = 1): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a * opacity})`;
}

export function applyFill(ctx: CanvasRenderingContext2D, fills: Paint[], node: SceneNode) {
  for (const fill of fills) {
    if (fill.type === "SOLID") {
      ctx.fillStyle = rgbaToCSS(fill.color, fill.opacity);
    } else if (fill.type === "LINEAR" || fill.type === "RADIAL") {
      const gradient =
        fill.type === "LINEAR"
          ? ctx.createLinearGradient(0, 0, node.width, node.height)
          : ctx.createRadialGradient(
              node.width / 2,
              node.height / 2,
              0,
              node.width / 2,
              node.height / 2,
              Math.max(node.width, node.height) / 2
            );
      for (const stop of fill.gradientStops) {
        gradient.addColorStop(stop.position, rgbaToCSS(stop.color));
      }
      ctx.fillStyle = gradient;
    }
  }
}

function hasImageFill(fills: Paint[]): boolean {
  return fills.some((f) => f.type === "IMAGE");
}

function renderImageFills(ctx: CanvasRenderingContext2D, fills: Paint[], node: SceneNode) {
  for (const fill of fills) {
    if (fill.type !== "IMAGE") continue;
    const imgFill = fill as ImagePaint;
    const img = getCachedImage(imgFill.imageRef);
    if (!img) continue;
    ctx.save();
    drawRoundedRect(ctx, node.width, node.height, node.cornerRadius);
    ctx.clip();
    if (imgFill.scaleMode === "FILL") {
      const scale = Math.max(node.width / img.naturalWidth, node.height / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      ctx.drawImage(img, (node.width - sw) / 2, (node.height - sh) / 2, sw, sh);
    } else if (imgFill.scaleMode === "FIT") {
      const scale = Math.min(node.width / img.naturalWidth, node.height / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      ctx.drawImage(img, (node.width - sw) / 2, (node.height - sh) / 2, sw, sh);
    } else {
      ctx.drawImage(img, 0, 0, node.width, node.height);
    }
    ctx.restore();
  }
}

export function applyStroke(ctx: CanvasRenderingContext2D, strokes: Paint[], weight: number) {
  if (strokes.length === 0 || weight <= 0) return false;
  for (const stroke of strokes) {
    if (stroke.type === "SOLID") {
      ctx.strokeStyle = rgbaToCSS(stroke.color, stroke.opacity);
    }
  }
  ctx.lineWidth = weight;
  return true;
}

// Stroke with alignment support (INSIDE/OUTSIDE/CENTER)
function strokeAligned(
  ctx: CanvasRenderingContext2D,
  scene: SceneNode,
  buildPath: () => void
) {
  if (!applyStroke(ctx, scene.strokes, scene.strokeWeight)) return;

  const align = scene.strokeAlign || "CENTER";

  if (align === "CENTER") {
    buildPath();
    ctx.stroke();
  } else if (align === "INSIDE") {
    ctx.save();
    buildPath();
    ctx.clip();
    ctx.lineWidth = scene.strokeWeight * 2;
    buildPath();
    ctx.stroke();
    ctx.restore();
  } else if (align === "OUTSIDE") {
    ctx.save();
    // Clip to everything outside the shape
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 2e5);
    buildPath();
    ctx.clip("evenodd");
    ctx.lineWidth = scene.strokeWeight * 2;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cr: number | [number, number, number, number]
) {
  if (typeof cr === "number" && cr > 0) {
    const r = Math.min(cr, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.arcTo(w, 0, w, r, r);
    ctx.lineTo(w, h - r);
    ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(r, h);
    ctx.arcTo(0, h, 0, h - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
  } else if (Array.isArray(cr)) {
    const [tl, tr, br, bl] = cr.map((r) => Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(tl, 0);
    ctx.lineTo(w - tr, 0);
    ctx.arcTo(w, 0, w, tr, tr);
    ctx.lineTo(w, h - br);
    ctx.arcTo(w, h, w - br, h, br);
    ctx.lineTo(bl, h);
    ctx.arcTo(0, h, 0, h - bl, bl);
    ctx.lineTo(0, tl);
    ctx.arcTo(0, 0, tl, 0, tl);
    ctx.closePath();
  } else {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
  }
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sides = 6
) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points = 5
) {
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * 0.45;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function renderNode(
  ctx: CanvasRenderingContext2D,
  node: DesignNode,
  allNodes: Map<string, DesignNode>,
  camera: Camera,
  skipNodeId?: string | null
) {
  if (skipNodeId && node.id === skipNodeId) return;
  const scene = node as SceneNode;
  if (!scene.visible) return;

  ctx.save();
  ctx.globalAlpha = scene.opacity;
  ctx.translate(scene.x, scene.y);

  if (scene.rotation) {
    ctx.translate(scene.width / 2, scene.height / 2);
    ctx.rotate((scene.rotation * Math.PI) / 180);
    ctx.translate(-scene.width / 2, -scene.height / 2);
  }

  // Apply effects (shadows)
  for (const effect of scene.effects || []) {
    if (!effect.visible) continue;
    if (effect.type === "DROP_SHADOW" && effect.color && effect.offset) {
      ctx.shadowColor = rgbaToCSS(effect.color);
      ctx.shadowBlur = effect.radius;
      ctx.shadowOffsetX = effect.offset.x;
      ctx.shadowOffsetY = effect.offset.y;
    }
  }

  switch (node.type) {
    case "RECTANGLE":
    case "FRAME":
    case "COMPONENT":
    case "INSTANCE": {
      if (scene.fills.length > 0) {
        if (hasImageFill(scene.fills)) {
          renderImageFills(ctx, scene.fills, scene);
        } else {
          applyFill(ctx, scene.fills, scene);
          drawRoundedRect(ctx, scene.width, scene.height, scene.cornerRadius);
          ctx.fill();
        }
      }
      // Reset shadow after fill
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      strokeAligned(ctx, scene, () => {
        drawRoundedRect(ctx, scene.width, scene.height, scene.cornerRadius);
      });

      // Frame label
      if (node.type === "FRAME") {
        ctx.save();
        ctx.scale(1 / camera.zoom, 1 / camera.zoom);
        const fontSize = 11;
        ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
        const textMetrics = ctx.measureText(node.name);
        const labelY = -6 * camera.zoom;
        ctx.fillStyle = "rgba(153, 153, 153, 0.9)";
        ctx.textBaseline = "bottom";
        ctx.fillText(node.name, 0, labelY);
        // Subtle underline for the frame name
        if (textMetrics.width > 0) {
          ctx.strokeStyle = "rgba(153, 153, 153, 0.2)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(0, labelY + 1);
          ctx.lineTo(textMetrics.width, labelY + 1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Clip children for frames
      if (scene.clipContent) {
        ctx.save();
        drawRoundedRect(ctx, scene.width, scene.height, scene.cornerRadius);
        ctx.clip();
      }

      // Render children
      for (const childId of node.children) {
        const child = allNodes.get(childId);
        if (child) renderNode(ctx, child, allNodes, camera, skipNodeId);
      }

      if (scene.clipContent) {
        ctx.restore();
      }
      break;
    }

    case "ELLIPSE": {
      ctx.beginPath();
      ctx.ellipse(
        scene.width / 2,
        scene.height / 2,
        scene.width / 2,
        scene.height / 2,
        0,
        0,
        Math.PI * 2
      );
      if (scene.fills.length > 0) {
        applyFill(ctx, scene.fills, scene);
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      strokeAligned(ctx, scene, () => {
        ctx.beginPath();
        ctx.ellipse(
          scene.width / 2,
          scene.height / 2,
          scene.width / 2,
          scene.height / 2,
          0,
          0,
          Math.PI * 2
        );
      });
      break;
    }

    case "POLYGON": {
      drawPolygonPath(ctx, scene.width, scene.height);
      if (scene.fills.length > 0) {
        applyFill(ctx, scene.fills, scene);
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      strokeAligned(ctx, scene, () => {
        drawPolygonPath(ctx, scene.width, scene.height);
      });
      break;
    }

    case "STAR": {
      drawStarPath(ctx, scene.width, scene.height);
      if (scene.fills.length > 0) {
        applyFill(ctx, scene.fills, scene);
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      strokeAligned(ctx, scene, () => {
        drawStarPath(ctx, scene.width, scene.height);
      });
      break;
    }

    case "LINE": {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(scene.width, scene.height);
      if (applyStroke(ctx, scene.strokes, scene.strokeWeight)) {
        ctx.stroke();
      }
      break;
    }

    case "TEXT": {
      const textNode = node as TextNode;
      const weight = textNode.fontWeight || 400;
      const size = textNode.fontSize || 16;
      const family = textNode.fontFamily || "Inter";
      ctx.font = `${weight} ${size}px ${family}, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const align = textNode.textAlign === "JUSTIFIED" ? "left" : textNode.textAlign?.toLowerCase();
      ctx.textAlign = (align as CanvasTextAlign) || "left";

      if (textNode.fills.length > 0) {
        applyFill(ctx, textNode.fills, textNode);
      } else {
        ctx.fillStyle = "#000";
      }
      const textFill = ctx.fillStyle;

      const lines = textNode.characters.split("\n");
      const lh = textNode.lineHeight === "AUTO" ? size * 1.4 : textNode.lineHeight;
      let textX = 0;
      if (textNode.textAlign === "CENTER") textX = textNode.width / 2;
      else if (textNode.textAlign === "RIGHT") textX = textNode.width;
      const hasStroke = applyStroke(ctx, textNode.strokes, textNode.strokeWeight);
      if (hasStroke) {
        ctx.lineJoin = "round";
      }
      const decoration = textNode.textDecoration;
      const decorationThickness = Math.max(1, size / 14);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineY = i * lh;
        if (hasStroke) {
          ctx.strokeText(line, textX, lineY);
        }
        ctx.fillText(line, textX, lineY);

        if (decoration !== "NONE" && line.length > 0) {
          const metrics = ctx.measureText(line);
          let startX = textX;
          let endX = textX + metrics.width;
          if (textNode.textAlign === "CENTER") {
            startX = textX - metrics.width / 2;
            endX = textX + metrics.width / 2;
          } else if (textNode.textAlign === "RIGHT") {
            startX = textX - metrics.width;
            endX = textX;
          }

          const decorationY =
            decoration === "UNDERLINE" ? lineY + size * 0.92 : lineY + size * 0.52;

          ctx.save();
          ctx.strokeStyle = textFill;
          ctx.lineWidth = decorationThickness;
          ctx.beginPath();
          ctx.moveTo(startX, decorationY);
          ctx.lineTo(endX, decorationY);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case "GROUP": {
      for (const childId of node.children) {
        const child = allNodes.get(childId);
        if (child) renderNode(ctx, child, allNodes, camera, skipNodeId);
      }
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

export function getNodeWorldPosition(
  node: SceneNode,
  nodes: Map<string, DesignNode>
): { x: number; y: number } {
  let x = node.x;
  let y = node.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.get(parentId) as SceneNode | undefined;
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function getNodeWorldScene(
  node: SceneNode,
  nodes: Map<string, DesignNode>
): SceneNode {
  const worldPos = getNodeWorldPosition(node, nodes);
  return { ...node, x: worldPos.x, y: worldPos.y };
}

export function renderDotGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number
) {
  // Skip grid at very low zoom (too dense) or very high zoom (not useful)
  if (camera.zoom < 0.15) return;

  const gridSize = 20;
  const dotSize = Math.max(0.5, Math.min(1.5, 1 / camera.zoom * 0.8));

  // Fade dots at low zoom levels
  const alpha = Math.min(1, Math.max(0.15, (camera.zoom - 0.15) / 0.85));
  ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.5})`;

  const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize;
  const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize;
  const endX = startX + width / camera.zoom + gridSize * 2;
  const endY = startY + height / camera.zoom + gridSize * 2;

  // Limit max dots to prevent performance issues
  const cols = (endX - startX) / gridSize;
  const rows = (endY - startY) / gridSize;
  if (cols * rows > 10000) return;

  for (let x = startX; x < endX; x += gridSize) {
    for (let y = startY; y < endY; y += gridSize) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }
}

export function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  camera: Camera,
  isHover = false
) {
  ctx.save();
  ctx.translate(node.x, node.y);

  if (node.rotation) {
    ctx.translate(node.width / 2, node.height / 2);
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(-node.width / 2, -node.height / 2);
  }

  const lineWidth = 1.5 / camera.zoom;
  ctx.strokeStyle = isHover ? "#0d99ff80" : "#0d99ff";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(0, 0, node.width, node.height);

  if (!isHover) {
    // Draw resize handles
    const handleSize = 8 / camera.zoom;
    const half = handleSize / 2;
    const positions = [
      [0, 0],
      [node.width / 2, 0],
      [node.width, 0],
      [node.width, node.height / 2],
      [node.width, node.height],
      [node.width / 2, node.height],
      [0, node.height],
      [0, node.height / 2],
    ];

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0d99ff";
    ctx.lineWidth = 1.5 / camera.zoom;

    for (const [hx, hy] of positions) {
      ctx.fillRect(hx - half, hy - half, handleSize, handleSize);
      ctx.strokeRect(hx - half, hy - half, handleSize, handleSize);
    }
  }

  ctx.restore();
}

export function renderSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: SmartGuide[],
  camera: Camera
) {
  ctx.save();
  ctx.strokeStyle = "#ff3366";
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === "vertical") {
      ctx.moveTo(guide.position, guide.from);
      ctx.lineTo(guide.position, guide.to);
    } else {
      ctx.moveTo(guide.from, guide.position);
      ctx.lineTo(guide.to, guide.position);
    }
    ctx.stroke();

    // Distance label
    if (guide.label) {
      ctx.save();
      ctx.setLineDash([]);
      const fontSize = 10 / camera.zoom;
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#ff3366";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (guide.type === "vertical") {
        ctx.fillText(guide.label, guide.position, (guide.from + guide.to) / 2);
      } else {
        ctx.fillText(guide.label, (guide.from + guide.to) / 2, guide.position);
      }
      ctx.restore();
    }
  }

  ctx.restore();
}

export function renderDimensionLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  camera: Camera
) {
  const label = `${Math.round(width)} × ${Math.round(height)}`;
  const fontSize = 11 / camera.zoom;
  ctx.save();
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const textWidth = ctx.measureText(label).width;
  const padding = 4 / camera.zoom;
  const pillW = textWidth + padding * 2;
  const pillH = fontSize + padding * 2;
  const pillX = x + width / 2 - pillW / 2;
  const pillY = y + height + 8 / camera.zoom;

  ctx.fillStyle = "rgba(13, 153, 255, 0.9)";
  const r = 3 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.lineTo(pillX + pillW - r, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + r, r);
  ctx.lineTo(pillX + pillW, pillY + pillH - r);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH, r);
  ctx.lineTo(pillX + r, pillY + pillH);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - r, r);
  ctx.lineTo(pillX, pillY + r);
  ctx.arcTo(pillX, pillY, pillX + r, pillY, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + width / 2, pillY + padding);
  ctx.restore();
}

export function renderMarquee(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  camera: Camera
) {
  ctx.save();
  ctx.strokeStyle = "#0d99ff";
  ctx.fillStyle = "rgba(13, 153, 255, 0.1)";
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function hitTest(
  worldX: number,
  worldY: number,
  nodes: Map<string, DesignNode>,
  pageChildren: string[]
): string | null {
  // Iterate in reverse (top-most first)
  const testChildren = (
    childIds: string[],
    offsetX: number,
    offsetY: number
  ): string | null => {
    for (let i = childIds.length - 1; i >= 0; i--) {
      const node = nodes.get(childIds[i]) as SceneNode;
      if (!node || !node.visible) continue;
      const x = offsetX + node.x;
      const y = offsetY + node.y;

      // Test children first (for frames/groups)
      if (node.children.length > 0) {
        const childHit = testChildren(node.children, x, y);
        if (childHit) return childHit;
      }

      // Simple AABB test (ignoring rotation for simplicity)
      if (node.type === "LINE") {
        const dx = node.width;
        const dy = node.height;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((worldX - x) * dx + (worldY - y) * dy) / (len * len)
          )
        );
        const px = x + t * dx;
        const py = y + t * dy;
        const dist = Math.sqrt((worldX - px) ** 2 + (worldY - py) ** 2);
        if (dist < 5) return node.id;
      } else {
        if (
          worldX >= x &&
          worldX <= x + node.width &&
          worldY >= y &&
          worldY <= y + node.height
        ) {
          return node.id;
        }
      }
    }
    return null;
  };

  return testChildren(pageChildren, 0, 0);
}

// Transform world coords into a node's local (unrotated) coordinate space
function worldToLocal(
  worldX: number,
  worldY: number,
  node: SceneNode
): { lx: number; ly: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = worldX - cx;
  const dy = worldY - cy;
  if (!node.rotation) {
    return { lx: dx + node.width / 2, ly: dy + node.height / 2 };
  }
  const rad = -(node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    lx: dx * cos - dy * sin + node.width / 2,
    ly: dx * sin + dy * cos + node.height / 2,
  };
}

export function getResizeHandle(
  worldX: number,
  worldY: number,
  node: SceneNode,
  camera: Camera
): number {
  const { lx, ly } = worldToLocal(worldX, worldY, node);
  const handleSize = 8 / camera.zoom;
  const half = handleSize / 2;
  const positions = [
    [0, 0],
    [node.width / 2, 0],
    [node.width, 0],
    [node.width, node.height / 2],
    [node.width, node.height],
    [node.width / 2, node.height],
    [0, node.height],
    [0, node.height / 2],
  ];

  for (let i = 0; i < positions.length; i++) {
    const [hx, hy] = positions[i];
    if (
      lx >= hx - half &&
      lx <= hx + half &&
      ly >= hy - half &&
      ly <= hy + half
    ) {
      return i;
    }
  }
  return -1;
}

export function getRotationZone(
  worldX: number,
  worldY: number,
  node: SceneNode,
  camera: Camera
): boolean {
  const { lx, ly } = worldToLocal(worldX, worldY, node);
  const margin = 15 / camera.zoom;

  const inOuter =
    lx >= -margin &&
    lx <= node.width + margin &&
    ly >= -margin &&
    ly <= node.height + margin;
  const inInner =
    lx >= 0 &&
    lx <= node.width &&
    ly >= 0 &&
    ly <= node.height;

  return inOuter && !inInner;
}

export function computeSmartGuides(
  movingIds: string[],
  allNodes: Map<string, DesignNode>,
  pageChildren: string[]
): SmartGuide[] {
  return computeSmartGuidesWithSnap(movingIds, allNodes, pageChildren).guides;
}

export function computeSmartGuidesWithSnap(
  movingIds: string[],
  allNodes: Map<string, DesignNode>,
  pageChildren: string[]
): { guides: SmartGuide[]; snapOffset: { x: number; y: number } } {
  const guides: SmartGuide[] = [];
  const SNAP_THRESHOLD = 5;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of movingIds) {
    const n = allNodes.get(id) as SceneNode;
    if (!n) continue;
    const world = getNodeWorldPosition(n, allNodes);
    minX = Math.min(minX, world.x);
    minY = Math.min(minY, world.y);
    maxX = Math.max(maxX, world.x + n.width);
    maxY = Math.max(maxY, world.y + n.height);
  }
  if (!isFinite(minX) || !isFinite(minY)) {
    return { guides, snapOffset: { x: 0, y: 0 } };
  }

  const movingCenterX = (minX + maxX) / 2;
  const movingCenterY = (minY + maxY) / 2;
  const movingSet = new Set(movingIds);

  const candidates: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
  }> = [];

  const collectCandidates = (ids: string[]) => {
    for (const childId of ids) {
      if (movingSet.has(childId)) continue;
      const node = allNodes.get(childId) as SceneNode;
      if (!node || !node.visible) continue;
      const world = getNodeWorldPosition(node, allNodes);
      candidates.push({
        left: world.x,
        right: world.x + node.width,
        top: world.y,
        bottom: world.y + node.height,
        centerX: world.x + node.width / 2,
        centerY: world.y + node.height / 2,
      });
      if (node.children.length > 0) {
        collectCandidates(node.children);
      }
    }
  };
  collectCandidates(pageChildren);

  let bestDx: number | null = null;
  let bestDy: number | null = null;
  let xMatch: AxisGuideMatch | null = null;
  let yMatch: AxisGuideMatch | null = null;

  for (const edges of candidates) {
    const xChecks = [
      { moving: minX, target: edges.left },
      { moving: minX, target: edges.right },
      { moving: minX, target: edges.centerX },
      { moving: maxX, target: edges.left },
      { moving: maxX, target: edges.right },
      { moving: maxX, target: edges.centerX },
      { moving: movingCenterX, target: edges.centerX },
    ];

    for (const check of xChecks) {
      const delta = check.target - check.moving;
      if (Math.abs(delta) <= SNAP_THRESHOLD) {
        if (bestDx === null || Math.abs(delta) < Math.abs(bestDx)) {
          bestDx = delta;
          xMatch = {
            type: "vertical",
            position: check.target,
            from: Math.min(minY, edges.top) - 20,
            to: Math.max(maxY, edges.bottom) + 20,
          };
        }
      }
    }

    const yChecks = [
      { moving: minY, target: edges.top },
      { moving: minY, target: edges.bottom },
      { moving: minY, target: edges.centerY },
      { moving: maxY, target: edges.top },
      { moving: maxY, target: edges.bottom },
      { moving: maxY, target: edges.centerY },
      { moving: movingCenterY, target: edges.centerY },
    ];

    for (const check of yChecks) {
      const delta = check.target - check.moving;
      if (Math.abs(delta) <= SNAP_THRESHOLD) {
        if (bestDy === null || Math.abs(delta) < Math.abs(bestDy)) {
          bestDy = delta;
          yMatch = {
            type: "horizontal",
            position: check.target,
            from: Math.min(minX, edges.left) - 20,
            to: Math.max(maxX, edges.right) + 20,
          };
        }
      }
    }
  }

  if (xMatch) guides.push(xMatch);
  if (yMatch) guides.push(yMatch);

  return {
    guides,
    snapOffset: {
      x: bestDx ?? 0,
      y: bestDy ?? 0,
    },
  };
}

/**
 * Compute snap offsets during resize. Only the edges being actively dragged
 * are snapped to candidate edges (left/right/centerX for X, top/bottom/centerY for Y).
 * resizeHandle: 0=TL, 1=TC, 2=TR, 3=MR, 4=BR, 5=BC, 6=BL, 7=ML
 */
export function computeResizeSnap(
  nodeId: string,
  newX: number,
  newY: number,
  newW: number,
  newH: number,
  resizeHandle: number,
  allNodes: Map<string, DesignNode>,
  pageChildren: string[]
): { guides: SmartGuide[]; snapDx: number; snapDy: number } {
  const SNAP_THRESHOLD = 5;
  const guides: SmartGuide[] = [];

  // Edges of the node being resized
  const left = newX;
  const right = newX + newW;
  const top = newY;
  const bottom = newY + newH;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  // Which edges are active depends on the handle
  // Left edge moves: handles 0, 6, 7
  // Right edge moves: handles 2, 3, 4
  // Top edge moves: handles 0, 1, 2
  // Bottom edge moves: handles 4, 5, 6
  const movesLeft = [0, 6, 7].includes(resizeHandle);
  const movesRight = [2, 3, 4].includes(resizeHandle);
  const movesTop = [0, 1, 2].includes(resizeHandle);
  const movesBottom = [4, 5, 6].includes(resizeHandle);

  // Collect candidate edges from other nodes
  const candidates: Array<{
    left: number; right: number; top: number; bottom: number;
    centerX: number; centerY: number;
  }> = [];
  const nodeSet = new Set([nodeId]);

  const collectCandidates = (ids: string[]) => {
    for (const childId of ids) {
      if (nodeSet.has(childId)) continue;
      const node = allNodes.get(childId) as SceneNode;
      if (!node || !node.visible) continue;
      const world = getNodeWorldPosition(node, allNodes);
      candidates.push({
        left: world.x,
        right: world.x + node.width,
        top: world.y,
        bottom: world.y + node.height,
        centerX: world.x + node.width / 2,
        centerY: world.y + node.height / 2,
      });
      if (node.children.length > 0) {
        collectCandidates(node.children);
      }
    }
  };
  collectCandidates(pageChildren);

  let bestDx: number | null = null;
  let bestDy: number | null = null;
  let xMatch: SmartGuide | null = null;
  let yMatch: SmartGuide | null = null;

  for (const c of candidates) {
    const targetXEdges = [c.left, c.right, c.centerX];

    // Check active X edges
    const activeXEdges: number[] = [];
    if (movesLeft) activeXEdges.push(left);
    if (movesRight) activeXEdges.push(right);

    for (const activeEdge of activeXEdges) {
      for (const targetEdge of targetXEdges) {
        const delta = targetEdge - activeEdge;
        if (Math.abs(delta) <= SNAP_THRESHOLD) {
          if (bestDx === null || Math.abs(delta) < Math.abs(bestDx)) {
            bestDx = delta;
            xMatch = {
              type: "vertical",
              position: targetEdge,
              from: Math.min(top, c.top) - 20,
              to: Math.max(bottom, c.bottom) + 20,
            };
          }
        }
      }
    }

    // Check active Y edges
    const targetYEdges = [c.top, c.bottom, c.centerY];
    const activeYEdges: number[] = [];
    if (movesTop) activeYEdges.push(top);
    if (movesBottom) activeYEdges.push(bottom);

    for (const activeEdge of activeYEdges) {
      for (const targetEdge of targetYEdges) {
        const delta = targetEdge - activeEdge;
        if (Math.abs(delta) <= SNAP_THRESHOLD) {
          if (bestDy === null || Math.abs(delta) < Math.abs(bestDy)) {
            bestDy = delta;
            yMatch = {
              type: "horizontal",
              position: targetEdge,
              from: Math.min(left, c.left) - 20,
              to: Math.max(right, c.right) + 20,
            };
          }
        }
      }
    }
  }

  if (xMatch) guides.push(xMatch);
  if (yMatch) guides.push(yMatch);

  return {
    guides,
    snapDx: bestDx ?? 0,
    snapDy: bestDy ?? 0,
  };
}
