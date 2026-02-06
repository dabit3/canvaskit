# CanvasKit -- Design Editor

CanvasKit is a browser-based vector design tool inspired by Figma. It runs entirely in the browser with no server-side processing, using an HTML5 Canvas 2D rendering pipeline and a React-based UI.

## Features

### Drawing and Shapes
- **Shape tools** -- Rectangle, Ellipse, Polygon, Star, Line
- **Frame tool** -- Container nodes that clip children, with visible labels
- **Text tool** -- Full rich text with configurable font family, weight, size, line height, letter spacing, alignment, and decoration (underline, strikethrough)
- **Pen tool** -- Freeform vector path drawing
- **Hold Shift** while drawing to constrain shapes to equal width/height

### Selection and Transform
- **Select, move, resize, and rotate** any object on the canvas
- **Rotation-aware resize** -- Handles work correctly on rotated objects
- **Smart guides and snapping** -- Edges and centers snap to nearby objects during both move and resize operations
- **Multi-selection** with Shift+click or marquee drag
- **Alignment and distribution** -- Align objects to each other or to the canvas, distribute spacing evenly

### Styling
- **Fill** -- Solid color, linear gradient, and radial gradient fills
- **Stroke** -- Configurable color, weight, and alignment (inside, center, outside)
- **Effects** -- Drop shadow with color, offset, and blur radius
- **Opacity and blend modes**
- **Per-corner border radius** -- Uniform or individual control for each corner
- **20 built-in Google Fonts** loaded automatically (Inter, Roboto, Poppins, Montserrat, and more)

### Canvas
- **Infinite canvas** with pan (Space+drag or middle mouse) and zoom (scroll wheel or pinch)
- **Dot grid background** that fades at low zoom levels
- **Zoom presets** including Zoom to Fit, 50%, 100%, and 200%
- **Dimension labels** shown on canvas during drawing and resizing

### Layers and Organization
- **Layers panel** with tree view, drag-and-drop reorder, visibility toggle, and lock toggle
- **Grouping** -- Group and ungroup objects (Ctrl/Cmd+G)
- **Z-order controls** -- Bring forward, send backward, bring to front, send to back
- **Multi-page support** -- Create, rename, and switch between pages

### Import and Export
- **Image import** -- Drag and drop or use the file menu; images are auto-scaled to fit the viewport
- **Export formats** -- PNG, JPG (with quality setting), and SVG
- **Export scale** -- 0.5x, 1x, 2x, 3x, or 4x resolution
- **Document persistence** -- Auto-saves to IndexedDB with immediate flush on page unload
- **JSON import/export** -- Save and load full documents as JSON files

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| V | Select tool |
| F | Frame tool |
| R | Rectangle tool |
| O | Ellipse tool |
| L | Line tool |
| T | Text tool |
| P | Pen tool |
| H | Hand (pan) tool |
| Z | Zoom tool |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+C / V | Copy / Paste |
| Ctrl/Cmd+D | Duplicate |
| Ctrl/Cmd+G | Group |
| Ctrl/Cmd+Shift+G | Ungroup |
| Delete / Backspace | Delete selected |
| Ctrl/Cmd+A | Select all |
| Ctrl/Cmd+0 | Zoom to 100% |
| Ctrl/Cmd+1 | Zoom to fit |
| ? | Show keyboard shortcuts overlay |

## Tech Stack

- **Framework** -- [Next.js](https://nextjs.org) 16 with React 19
- **State management** -- [Zustand](https://github.com/pmndrs/zustand)
- **Rendering** -- HTML5 Canvas 2D API
- **Styling** -- [Tailwind CSS](https://tailwindcss.com) v4
- **Language** -- TypeScript
- **ID generation** -- [nanoid](https://github.com/ai/nanoid)
- **Persistence** -- IndexedDB (browser-local, no server required)

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm, yarn, pnpm, or bun

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
npm run build
npm start
```

## Project Structure

```
app/
  components/
    Canvas.tsx          -- Main canvas with rendering, interactions, and event handling
    Editor.tsx          -- Top-level editor layout, persistence, drag-and-drop
    Toolbar.tsx         -- Tool selection, file menu, zoom controls
    PropertiesPanel.tsx -- Context-sensitive property editing (transform, fill, stroke, effects, typography)
    LayersPanel.tsx     -- Layer tree with reorder, visibility, lock
    ColorPicker.tsx     -- HSV color picker with preset swatches
    ShortcutHelp.tsx    -- Keyboard shortcut overlay
    Toasts.tsx          -- Toast notification system
  utils/
    renderer.ts         -- Canvas rendering pipeline, hit testing, smart guides, snapping
    imageSizing.ts      -- Image import sizing utilities
  store.ts              -- Zustand store with all editor state and actions
  types.ts              -- TypeScript type definitions for the document model
  globals.css           -- Global styles and Tailwind configuration
  layout.tsx            -- Root layout with Google Fonts loading
  page.tsx              -- Entry point
```

## License

This project is for personal and educational use.
