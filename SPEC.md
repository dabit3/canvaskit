# CanvasKit — Product Specification

## 1. Overview

A browser-based vector design tool inspired by Figma. Single-user, local-first — no backend, no accounts. The goal is a **polished, impressive demo** that feels like a real design tool from the moment you open it.

**Codename:** `CanvasKit`
**Stack:** React + TypeScript + Zustand + HTML5 Canvas
**Persistence:** IndexedDB (auto-save) + JSON file export/import

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│              React + TypeScript SPA              │
│                                                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Zustand   │  │  Canvas   │  │  Properties │  │
│  │  Store     │◄─►  Renderer │  │  Panel      │  │
│  │ (doc tree) │  │ (2D ctx)  │  │  (React)    │  │
│  └─────┬─────┘  └───────────┘  └─────────────┘  │
│        │                                         │
│  ┌─────▼──────────────────────────────────────┐  │
│  │  History Manager (undo/redo command stack)  │  │
│  └─────┬──────────────────────────────────────┘  │
│        │                                         │
│  ┌─────▼─────┐                                   │
│  │ IndexedDB  │  ← auto-save every 30s           │
│  └───────────┘                                   │
└─────────────────────────────────────────────────┘
```

Everything runs in the browser. No server, no build-time API keys, no external dependencies beyond npm packages. `npm install && npm run dev` and it works.

---

## 3. Data Model

### 3.1 Document Tree

Every design file is a tree of **nodes**. This is the single source of truth.

```typescript
type NodeType =
  | "DOCUMENT"
  | "PAGE"
  | "FRAME"
  | "GROUP"
  | "RECTANGLE"
  | "ELLIPSE"
  | "POLYGON"
  | "STAR"
  | "LINE"
  | "TEXT"
  | "VECTOR"
  | "BOOLEAN_OPERATION"
  | "COMPONENT"
  | "INSTANCE"
  | "IMAGE";

interface BaseNode {
  id: string;                // nanoid
  type: NodeType;
  name: string;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  children: string[];        // ordered child IDs
}

interface SceneNode extends BaseNode {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;          // degrees
  opacity: number;           // 0–1
  blendMode: BlendMode;
  fills: Paint[];
  strokes: Paint[];
  strokeWeight: number;
  strokeAlign: "INSIDE" | "OUTSIDE" | "CENTER";
  cornerRadius: number | [number, number, number, number];
  effects: Effect[];
  constraints: Constraints;
  clipContent: boolean;
}

interface TextNode extends SceneNode {
  type: "TEXT";
  characters: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number | "AUTO";
  letterSpacing: number;
  textAlign: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textDecoration: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textCase: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  paragraphSpacing: number;
  textStyleRanges: TextStyleRange[];
}
```

### 3.2 Paint & Effects

```typescript
interface SolidPaint {
  type: "SOLID";
  color: RGBA;
  opacity: number;
}

interface GradientPaint {
  type: "LINEAR" | "RADIAL" | "ANGULAR" | "DIAMOND";
  gradientStops: { position: number; color: RGBA }[];
  gradientTransform: Matrix2D;
}

interface ImagePaint {
  type: "IMAGE";
  imageRef: string;          // blob URL or data URI
  scaleMode: "FILL" | "FIT" | "CROP" | "TILE";
}

type Paint = SolidPaint | GradientPaint | ImagePaint;

interface Effect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  color?: RGBA;
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
}
```

---

## 4. Feature Specification

### 4.1 Canvas & Viewport

| Feature | Description | Priority |
|---|---|---|
| Infinite canvas | Pan with scroll/middle-click/spacebar+drag. No boundaries. | P0 |
| Zoom | Scroll-wheel zoom, pinch-to-zoom, zoom-to-fit, zoom-to-selection. Range: 1%–25600%. | P0 |
| Pixel grid | Show pixel grid at zoom >800%. | P2 |
| Rulers & guides | Draggable horizontal/vertical guides from rulers. Snap-to-guide. | P1 |
| Multi-page | Tabs for multiple pages within a single file. | P1 |
| Canvas background | Subtle dot grid or checkerboard to convey infinite space. | P0 |

### 4.2 Tools

| Tool | Shortcut | Behavior |
|---|---|---|
| Select (V) | `V` | Click to select, drag to marquee-select, click+drag to move |
| Frame (F) | `F` | Draw frames (artboards). Dropdown of device presets (iPhone, Desktop, etc.). |
| Rectangle (R) | `R` | Draw rectangles. Hold Shift for squares. |
| Ellipse (O) | `O` | Draw ellipses. Hold Shift for circles. |
| Line (L) | `L` | Draw lines. Hold Shift for 45° snaps. |
| Polygon | — | Configurable side count. |
| Star | — | Configurable point count and inner radius ratio. |
| Pen (P) | `P` | Bezier pen tool for custom vector paths. |
| Text (T) | `T` | Click for auto-width text, drag for fixed-width text box. |
| Hand (H) | `H` | Pan the canvas. |
| Zoom (Z) | `Z` | Click to zoom in, Alt+click to zoom out. |

### 4.3 Selection & Transform

- **Single select:** Click on object.
- **Multi-select:** Shift+click or marquee drag.
- **Deep select:** Double-click to enter frames/groups; Ctrl+click to select nested child directly.
- **Move:** Drag selected objects. Arrow keys for 1px nudge, Shift+arrow for 10px.
- **Resize:** 8 handles on bounding box. Shift to maintain aspect ratio. Alt to resize from center.
- **Rotate:** Cursor near corners outside bounding box. Shift for 15° snaps.
- **Smart guides:** Alignment and equal-spacing guides relative to siblings and parent. **This is critical for demo appeal — it makes the tool feel professional.**
- **Snapping:** Snap to object edges, centers, spacing, pixel grid.
- **Align & Distribute:** Toolbar buttons for align left/center/right/top/middle/bottom and distribute spacing.

### 4.4 Properties Panel (Right)

Context-sensitive panel for the selected node(s):

**Transform section:**
- X, Y, W, H inputs (editable, support basic math like `+10`)
- Rotation input
- Corner radius (single value or per-corner toggle)

**Fill section:**
- List of fills (add/remove/reorder)
- Color picker with hex/RGB/HSL input and opacity slider
- Fill type switcher: Solid → Linear Gradient → Radial Gradient → Image
- Gradient editor with draggable stops

**Stroke section:**
- List of strokes (add/remove)
- Color, weight, alignment (inside/center/outside)
- Dash pattern, cap (butt/round/square), join (miter/round/bevel)

**Effects section:**
- Drop shadow, inner shadow, layer blur, background blur
- Per-effect: color, offset X/Y, blur radius, spread

**Typography section** (text nodes):
- Font family dropdown (Google Fonts)
- Weight, size, line height, letter spacing
- Alignment, decoration, case

**Opacity & Blend Mode:**
- Opacity slider 0–100%
- Blend mode dropdown

**Export section:**
- Add export presets: PNG, JPG, SVG, PDF
- Scale: 0.5x, 1x, 2x, 3x, 4x
- One-click export/download

### 4.5 Layers Panel (Left)

- Tree view reflecting the document hierarchy.
- Drag-and-drop reordering and re-parenting.
- Toggle visibility (eye icon) and lock (lock icon).
- Inline rename on double-click.
- Right-click context menu: rename, duplicate, delete, group, frame selection, copy/paste.
- Collapse/expand groups and frames.
- Highlight corresponding layer on canvas hover and vice versa.

### 4.6 Components & Instances

| Feature | Description | Priority |
|---|---|---|
| Create component | `Ctrl+Alt+K` — convert frame/group to a master component (purple diamond icon). | P1 |
| Instances | Drag from assets panel or Alt+drag to place an instance. Linked to master. | P1 |
| Overrides | Override text content, fill colors, and visibility on instances. | P1 |
| Detach instance | Break the link, turning it into a plain group. | P1 |
| Assets panel | Searchable list of all components in the file. | P1 |

### 4.7 Styles (Design Tokens)

- **Color styles:** Named colors. Apply to any fill or stroke. Edit in one place, updates everywhere.
- **Text styles:** Named font/size/weight/line-height combos.
- **Effect styles:** Named shadow/blur presets.
- Create, edit, and detach styles from the properties panel.

### 4.8 Auto Layout

Flexbox-like layout within frames. **High demo value — makes designs feel responsive.**

- **Direction:** Horizontal / Vertical
- **Spacing:** Fixed gap or auto (space-between)
- **Padding:** Per-side padding
- **Alignment:** Primary and cross-axis
- **Child sizing:** Fixed / Hug Contents / Fill Container
- Nesting auto layout frames for complex layouts
- Visual indicators on canvas showing padding and spacing

### 4.9 Boolean Operations

- Union, Subtract, Intersect, Exclude
- Non-destructive until explicitly flattened
- Accessible via toolbar or right-click menu

### 4.10 Pen Tool & Vector Editing

- Click to place straight points, click+drag for bezier curves.
- Double-click or Enter to finish path.
- Edit mode: move anchor points, adjust handles (symmetric / independent).
- Add/delete points on existing paths.
- Close/open paths.

### 4.11 Image Support

- Drag-and-drop images onto canvas from desktop.
- Paste images from clipboard.
- Image fills on any shape.
- Basic crop via image fill "CROP" mode.
- Images stored as data URIs in the document (keeps it self-contained).

### 4.12 Export

| Format | Details |
|---|---|
| PNG | Configurable scale (1x–4x), transparent or with background |
| JPG | Configurable scale, quality slider |
| SVG | Vector export of selected objects or full frame |
| PDF | Frame-based page export |
| JSON | Full document export (native format, re-importable) |

### 4.13 Import

- Drag-and-drop images (PNG, JPG, GIF, WEBP, SVG).
- SVG import → parsed into editable vector nodes.
- JSON import → load a previously exported `.canvas.json` file.
- Paste SVG from clipboard.

---

## 5. UI Layout & Visual Design

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─────┐                                                        │
│  │ ≡   │  File Name ▾    [Tools Row]          100% ▾   [▶ Play] │
│  └─────┘                                                        │
├────────────┬─────────────────────────────────────┬───────────────┤
│            │                                     │               │
│  LAYERS    │                                     │  DESIGN       │
│            │         C A N V A S                 │               │
│  Pages     │                                     │  Transform    │
│  ────────  │    (dark gray background,           │  Fill         │
│  ▸ Frame 1 │     dot grid pattern,               │  Stroke       │
│    □ Rect  │     colored selection handles,      │  Effects      │
│    T Text  │     smart guides)                   │  Typography   │
│  ▸ Frame 2 │                                     │  Auto Layout  │
│            │                                     │  Export       │
│            │                                     │               │
│  ASSETS    │                                     │               │
│  ────────  │                                     │               │
│  ◆ Button  │                                     │               │
│  ◆ Card    │                                     │               │
├────────────┴─────────────────────────────────────┴───────────────┤
│  Objects: 3 selected  │  X: 120  Y: 340  │  W: 200  H: 80      │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Polish (Demo Appeal)

These details make the difference between "student project" and "wow, this looks real":

- **Dark UI** with the Figma-style dark gray (`#2c2c2c`) toolbar and panels, lighter canvas area (`#e5e5e5`).
- **Smooth animations** on panel open/close, dropdown menus, tooltip fade-in.
- **Color picker** with a proper saturation/brightness square, hue slider, opacity slider, and hex input.
- **Crisp selection handles:** Blue `#0d99ff` selection outlines, white square resize handles with subtle shadows.
- **Smart guide lines:** Magenta/red dashed lines with distance labels in small pills.
- **Cursor changes:** Crosshair when drawing, move cursor on hover over selected objects, resize cursors on handles, rotate cursor near corners.
- **Loading state:** Show a tasteful spinner or skeleton when opening large files.
- **Empty state:** When canvas is blank, show a centered hint: "Press F for a frame, R for a rectangle, or drag an image here."
- **Toasts:** Subtle notifications for actions like "Exported as PNG" or "Saved".
- **Context menus:** Right-click anywhere for relevant actions, styled consistently.
- **Tooltips:** On every toolbar icon, showing name + shortcut.

---

## 6. Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Select tool | `V` |
| Frame tool | `F` |
| Rectangle | `R` |
| Ellipse | `O` |
| Line | `L` |
| Pen | `P` |
| Text | `T` |
| Hand/Pan | `H` / Space+drag |
| Zoom in/out | `Ctrl +` / `Ctrl -` |
| Zoom to fit | `Ctrl 1` |
| Zoom to selection | `Ctrl 2` |
| Zoom to 100% | `Ctrl 0` |
| Undo / Redo | `Ctrl Z` / `Ctrl Shift Z` |
| Copy / Paste | `Ctrl C` / `Ctrl V` |
| Duplicate | `Ctrl D` / Alt+drag |
| Group / Ungroup | `Ctrl G` / `Ctrl Shift G` |
| Delete | `Backspace` / `Delete` |
| Bring forward / Send backward | `Ctrl ]` / `Ctrl [` |
| Bring to front / Send to back | `Ctrl Shift ]` / `Ctrl Shift [` |
| Lock | `Ctrl Shift L` |
| Hide | `Ctrl Shift H` |
| Create component | `Ctrl Alt K` |
| Toggle UI panels | `Ctrl \` |
| Quick actions | `Ctrl /` or `Ctrl K` |
| Select all | `Ctrl A` |
| Save to file | `Ctrl S` (triggers JSON download) |
| Open file | `Ctrl O` (triggers file picker for JSON import) |

---

## 7. Persistence (Local)

- **Auto-save:** Debounced write to IndexedDB every 30 seconds after last edit.
- **Manual save:** `Ctrl+S` exports the document as a `.canvas.json` file download.
- **Open file:** `Ctrl+O` opens a file picker to import a `.canvas.json` file.
- **Recent files:** On the "home" screen, list recently opened files from IndexedDB.
- **Undo/redo:** In-memory command stack. Survives within a session. Lost on page refresh (this is fine for a demo).
- **Image storage:** Images are inlined as base64 data URIs in the document JSON. For large images, use IndexedDB blob storage with references.

---

## 8. Rendering Pipeline

```
Document Tree (Zustand store)
       │
       ▼
Compute absolute transforms (walk tree, accumulate parent transforms)
       │
       ▼
Viewport culling (skip objects fully outside visible area)
       │
       ▼
Paint in tree order (back to front):
  - Apply transform (translate, rotate, scale)
  - Draw fills (solid, gradient, image)
  - Draw strokes
  - Apply effects (shadows via canvas shadowBlur, blur via filter)
  - Clip children if clipContent=true
       │
       ▼
Overlay pass (separate canvas layer or same canvas, drawn last):
  - Selection outlines and handles
  - Hover outlines
  - Smart guides and distance labels
  - Marquee selection rectangle
  - Tool previews (shape being drawn, pen path in progress)
  - Rulers and guides
```

**Performance targets:**

- 60fps pan/zoom with 5,000+ objects on canvas.
- Spatial index (R-tree or grid) for O(log n) hit-testing and viewport culling.
- Cache static objects as offscreen canvas bitmaps; invalidate on edit.
- Only repaint dirty regions when possible.
- Debounce property panel re-renders.

---

## 9. File Format

```json
{
  "formatVersion": "1.0",
  "name": "My Design File",
  "lastModified": "2026-02-05T10:30:00Z",
  "pages": [
    {
      "id": "page-1",
      "name": "Page 1",
      "children": [
        {
          "id": "frame-1",
          "type": "FRAME",
          "name": "Desktop — 1440×900",
          "x": 0, "y": 0,
          "width": 1440, "height": 900,
          "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 }, "opacity": 1 }],
          "strokes": [],
          "strokeWeight": 0,
          "strokeAlign": "CENTER",
          "cornerRadius": 0,
          "effects": [],
          "opacity": 1,
          "rotation": 0,
          "visible": true,
          "locked": false,
          "clipContent": true,
          "children": [ "..." ]
        }
      ]
    }
  ],
  "components": {},
  "styles": {
    "colors": {},
    "text": {},
    "effects": {}
  },
  "assets": {
    "images": {}
  }
}
```

---

## 10. Implementation Phases

### Phase 1 — Core Canvas & Shapes (Weeks 1–3)

The foundation. At the end of this phase you can draw shapes, move them around, and it looks good.

- [ ] Project scaffolding: Vite + React + TypeScript + Zustand
- [ ] Canvas renderer with camera (pan + zoom via transform matrix)
- [ ] Dark UI shell: toolbar, left panel, right panel, canvas area
- [ ] Rectangle, Ellipse, Line tools with draw interaction
- [ ] Selection: click-select, marquee-select, multi-select
- [ ] Bounding box with 8 resize handles and rotation
- [ ] Move with arrow keys (1px / 10px)
- [ ] Properties panel: X, Y, W, H, rotation, fill color, stroke color/weight, opacity
- [ ] Solid color picker (saturation square + hue bar + hex input)
- [ ] Layers panel: flat list, visibility toggle, lock toggle, reorder drag-and-drop
- [ ] Undo/redo (command pattern)
- [ ] Keyboard shortcuts for tools
- [ ] Canvas dot-grid background
- [ ] Cursor changes per tool/state
- [ ] Tooltips on toolbar icons

### Phase 2 — Rich Styling & Text (Weeks 4–5)

The tool becomes useful for real design work.

- [ ] Multiple fills and strokes per object
- [ ] Gradient fills (linear + radial) with visual editor
- [ ] Corner radius (uniform + per-corner mode)
- [ ] Effects: drop shadow, inner shadow, layer blur
- [ ] Blend modes
- [ ] Text tool: create text nodes, inline editing on canvas
- [ ] Typography panel: Google Fonts loader, size, weight, line height, alignment
- [ ] Frame tool with clip content, background fill, and device presets dropdown
- [ ] Groups (Ctrl+G / Ctrl+Shift+G)
- [ ] Deep select (double-click into frames/groups)
- [ ] Smart guides (alignment + equal spacing)
- [ ] Snapping (edges, centers, pixel grid)
- [ ] Copy/paste (Ctrl+C/V), duplicate (Ctrl+D, Alt+drag)
- [ ] Z-ordering (bring forward, send back, etc.)
- [ ] Right-click context menus

### Phase 3 — Components, Auto Layout & Polish (Weeks 6–8)

The "wow" features that make demos impressive.

- [ ] Create component / instances / overrides / detach
- [ ] Assets panel: list and search components
- [ ] Auto Layout on frames (direction, gap, padding, alignment, sizing)
- [ ] Visual auto layout indicators on canvas (padding, spacing)
- [ ] Constraints for responsive resize
- [ ] Color styles, text styles, effect styles (create, apply, detach)
- [ ] Pen tool: basic bezier path creation + editing
- [ ] Boolean operations (union, subtract, intersect, exclude)
- [ ] Image import (drag-and-drop, paste, image fills)
- [ ] SVG import (parse to vector nodes)
- [ ] Rulers and draggable guides

### Phase 4 — Export, Persistence & Demo Polish (Weeks 9–10)

Ship it.

- [ ] Export: PNG, JPG, SVG, PDF — per-object or per-frame
- [ ] Export preview dialog with scale and format options
- [ ] Save/load to IndexedDB (auto-save)
- [ ] JSON file export/import (`Ctrl+S` / `Ctrl+O`)
- [ ] Home screen: recent files, "New file" button
- [ ] Empty state hints on canvas
- [ ] Toast notifications
- [ ] Quick actions palette (`Ctrl+K`)
- [ ] Align & distribute toolbar
- [ ] Performance pass: spatial indexing, render culling, bitmap caching
- [ ] Polish pass: animations, transitions, hover states, focus rings
- [ ] Demo file: ship a pre-built `.canvas.json` showcasing all features

---

## 11. Demo File

Ship a default demo file that opens on first launch. It should showcase:

- A "marketing landing page" frame with header, hero section, feature cards, and footer.
- A "mobile app" frame with a few screens.
- Components used across both (buttons, cards, nav bars).
- Auto layout in action (a card list that reflows).
- Multiple text styles and color styles applied.
- A few drop shadows and rounded corners.
- At least one gradient and one image.

This lets someone open the app and immediately see it in action without creating anything.

---

## 12. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | 60fps canvas at 5k objects |
| Initial load | <3s to interactive on modern hardware |
| Bundle size | <2MB (lazy-load heavy features like PDF export) |
| Browser support | Chrome and Edge (latest 2). Firefox and Safari best-effort. |
| Offline | Fully functional offline (no server dependency) |
| Accessibility | Keyboard-navigable panels, tool shortcuts, focus management |

---

## 13. Notes for the AI Agent

1. **Start with the canvas.** Get pan, zoom, and rectangle drawing working first. Everything else builds on that.
2. **Nail the visual polish early.** Use Figma's exact colors: selection blue `#0d99ff`, panel dark `#2c2c2c`, canvas gray `#e5e5e5`. Match the feel.
3. **Don't over-engineer the data model.** Start with a flat Map<string, Node> and parent/child IDs. Don't build an ORM.
4. **Use Canvas 2D, not WebGL.** Canvas 2D is simpler, more debuggable, and sufficient for a demo. Only consider WebGL if you measurably hit performance walls.
5. **Google Fonts for typography.** Load a curated set of ~20 popular fonts. Don't try to load the full catalog initially.
6. **The color picker is a make-or-break UI element.** It needs to feel snappy. Use an HSV color space with a 2D saturation-brightness picker and a separate hue slider. Don't use a native `<input type="color">`.
7. **Smart guides are the single most impactful "feel" feature.** Prioritize these. When you drag an object and it snaps to align with a sibling, showing a thin guide line — that's the moment it feels like a real design tool.
8. **Test with the demo file.** Build the demo file early and use it as your integration test. If the demo file renders correctly and interactions work on it, the app works.
9. **Don't implement prototyping.** It's a huge scope increase for minimal demo value. Skip it entirely.
10. **Avoid premature abstraction.** Build features concretely first, extract patterns later. A working rectangle tool is better than a perfect shape abstraction that doesn't render yet.