import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  DesignNode,
  SceneNode,
  TextNode,
  ToolType,
  Camera,
  PageData,
  SmartGuide,
  HistoryEntry,
} from "./types";

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneNodesMap(nodes: Map<string, DesignNode>): Map<string, DesignNode> {
  const clone = new Map<string, DesignNode>();
  nodes.forEach((node, id) => {
    clone.set(id, deepClone(node));
  });
  return clone;
}

function getWorldPosition(
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

function getParentWorldPosition(
  parentId: string | null,
  nodes: Map<string, DesignNode>
): { x: number; y: number } {
  if (!parentId) return { x: 0, y: 0 };
  const parent = nodes.get(parentId) as SceneNode | undefined;
  if (!parent) return { x: 0, y: 0 };
  return getWorldPosition(parent, nodes);
}

function createDefaultNode(
  type: DesignNode["type"],
  overrides: Partial<SceneNode> = {}
): SceneNode {
  return {
    id: nanoid(),
    type,
    name: type.charAt(0) + type.slice(1).toLowerCase(),
    visible: true,
    locked: false,
    parentId: null,
    children: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    blendMode: "NORMAL",
    fills: [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85, a: 1 }, opacity: 1 }],
    strokes: [],
    strokeWeight: 0,
    strokeAlign: "CENTER",
    cornerRadius: 0,
    effects: [],
    constraints: { horizontal: "MIN", vertical: "MIN" },
    clipContent: false,
    ...overrides,
  };
}

function createDefaultTextNode(overrides: Partial<TextNode> = {}): TextNode {
  return {
    ...createDefaultNode("TEXT"),
    type: "TEXT",
    characters: "Text",
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 16,
    lineHeight: "AUTO" as const,
    letterSpacing: 0,
    textAlign: "LEFT" as const,
    textDecoration: "NONE" as const,
    textCase: "ORIGINAL" as const,
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 }],
    ...overrides,
  } as TextNode;
}

interface EditorState {
  // Document
  nodes: Map<string, DesignNode>;
  pages: PageData[];
  currentPageId: string;
  documentName: string;

  // Selection
  selectedIds: Set<string>;
  hoveredId: string | null;

  // Tool
  activeTool: ToolType;

  // Camera
  camera: Camera;

  // UI
  showLeftPanel: boolean;
  showRightPanel: boolean;
  smartGuides: SmartGuide[];
  clipboard: DesignNode[];
  toasts: { id: string; message: string; timestamp: number }[];

  // History
  history: HistoryEntry[];
  historyIndex: number;

  // Drawing state
  isDrawing: boolean;
  drawStart: { x: number; y: number } | null;

  // Actions
  addNode: (node: DesignNode, parentId?: string) => void;
  updateNode: (id: string, updates: Partial<DesignNode>) => void;
  deleteNodes: (ids: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelection: (id: string) => void;
  setHoveredId: (id: string | null) => void;
  setActiveTool: (tool: ToolType) => void;
  setCamera: (camera: Partial<Camera>) => void;
  setShowLeftPanel: (show: boolean) => void;
  setShowRightPanel: (show: boolean) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;
  setIsDrawing: (drawing: boolean) => void;
  setDrawStart: (point: { x: number; y: number } | null) => void;
  setDocumentName: (name: string) => void;

  // Complex actions
  createShape: (
    type: DesignNode["type"],
    x: number,
    y: number,
    width: number,
    height: number,
    overrides?: Partial<SceneNode>
  ) => string;
  createTextNode: (x: number, y: number, overrides?: Partial<TextNode>) => string;
  duplicateNodes: (ids: string[]) => void;
  groupNodes: (ids: string[]) => void;
  ungroupNodes: (ids: string[]) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  reorderNode: (id: string, newIndex: number, newParentId?: string) => void;
  bringForward: (ids: string[]) => void;
  sendBackward: (ids: string[]) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;

  // History
  pushHistory: (description: string) => void;
  undo: () => void;
  redo: () => void;

  // Clipboard
  copyNodes: () => void;
  pasteNodes: () => void;

  // Pages
  addPage: () => void;
  setCurrentPage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  deletePage: (pageId: string) => void;

  // Toast
  addToast: (message: string) => void;
  removeToast: (id: string) => void;

  // Persistence
  exportDocument: () => string;
  importDocument: (json: string) => void;

  // Get helpers
  getNode: (id: string) => DesignNode | undefined;
  getSelectedNodes: () => DesignNode[];
  getCurrentPageNodes: () => DesignNode[];
  getChildNodes: (parentId: string) => DesignNode[];
}

const defaultPageId = nanoid();

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: new Map(),
  pages: [{ id: defaultPageId, name: "Page 1", children: [] }],
  currentPageId: defaultPageId,
  documentName: "Untitled",

  selectedIds: new Set(),
  hoveredId: null,

  activeTool: "SELECT",
  camera: { x: 0, y: 0, zoom: 1 },

  showLeftPanel: true,
  showRightPanel: true,
  smartGuides: [],
  clipboard: [],
  toasts: [],

  history: [],
  historyIndex: -1,

  isDrawing: false,
  drawStart: null,

  // Actions
  addNode: (node, parentId) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      const nextNode = {
        ...node,
        parentId: parentId ?? node.parentId ?? null,
      } as DesignNode;
      newNodes.set(nextNode.id, nextNode);

      const newPages = [...state.pages];
      if (parentId) {
        const parent = newNodes.get(parentId);
        if (parent) {
          const updatedParent = {
            ...parent,
            children: [...parent.children, nextNode.id],
          };
          newNodes.set(parentId, updatedParent);
        }
      } else {
        const pageIdx = newPages.findIndex(
          (p) => p.id === state.currentPageId
        );
        if (pageIdx >= 0) {
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            children: [...newPages[pageIdx].children, nextNode.id],
          };
        }
      }

      return { nodes: newNodes, pages: newPages };
    }),

  updateNode: (id, updates) =>
    set((state) => {
      const node = state.nodes.get(id);
      if (!node) return state;
      const newNodes = new Map(state.nodes);
      newNodes.set(id, { ...node, ...updates } as DesignNode);
      return { nodes: newNodes };
    }),

  deleteNodes: (ids) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));
      const newSelectedIds = new Set(state.selectedIds);

      const deleteRecursive = (nodeId: string) => {
        const node = newNodes.get(nodeId);
        if (!node) return;
        for (const childId of node.children) {
          deleteRecursive(childId);
        }
        newNodes.delete(nodeId);
        newSelectedIds.delete(nodeId);

        // Remove from parent
        if (node.parentId) {
          const parent = newNodes.get(node.parentId);
          if (parent) {
            newNodes.set(node.parentId, {
              ...parent,
              children: parent.children.filter((c) => c !== nodeId),
            } as DesignNode);
          }
        } else {
          for (const page of newPages) {
            page.children = page.children.filter((c) => c !== nodeId);
          }
        }
      };

      for (const id of ids) {
        deleteRecursive(id);
      }

      return { nodes: newNodes, pages: newPages, selectedIds: newSelectedIds };
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((state) => {
      const newIds = new Set(state.selectedIds);
      if (newIds.has(id)) newIds.delete(id);
      else newIds.add(id);
      return { selectedIds: newIds };
    }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCamera: (camera) =>
    set((state) => ({ camera: { ...state.camera, ...camera } })),
  setShowLeftPanel: (show) => set({ showLeftPanel: show }),
  setShowRightPanel: (show) => set({ showRightPanel: show }),
  setSmartGuides: (guides) => set({ smartGuides: guides }),
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  setDrawStart: (point) => set({ drawStart: point }),
  setDocumentName: (name) => set({ documentName: name }),

  createShape: (type, x, y, width, height, overrides = {}) => {
    const fills: SceneNode["fills"] =
      type === "LINE"
        ? []
        : [
            {
              type: "SOLID",
              color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
              opacity: 1,
            },
          ];
    const strokes: SceneNode["strokes"] =
      type === "LINE"
        ? [
            {
              type: "SOLID",
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1,
            },
          ]
        : [];
    const strokeWeight = type === "LINE" ? 2 : 0;

    const frameFills: SceneNode["fills"] =
      type === "FRAME"
        ? [
            {
              type: "SOLID",
              color: { r: 1, g: 1, b: 1, a: 1 },
              opacity: 1,
            },
          ]
        : fills;

    const node = createDefaultNode(type, {
      x,
      y,
      width,
      height,
      fills: type === "FRAME" ? frameFills : fills,
      strokes,
      strokeWeight,
      clipContent: type === "FRAME",
      ...overrides,
    });

    get().addNode(node);
    get().pushHistory(`Create ${type.toLowerCase()}`);
    return node.id;
  },

  createTextNode: (x, y, overrides = {}) => {
    const node = createDefaultTextNode({
      x,
      y,
      width: 100,
      height: 24,
      ...overrides,
    });
    get().addNode(node);
    get().pushHistory("Create text");
    return node.id;
  },

  duplicateNodes: (ids) => {
    const state = get();
    const newIds: string[] = [];
    const newNodes = new Map(state.nodes);
    const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));

    for (const id of ids) {
      const node = state.nodes.get(id);
      if (!node) continue;
      const newId = nanoid();
      const dup = { ...node, id: newId, x: (node as SceneNode).x + 20, y: (node as SceneNode).y + 20 } as DesignNode;
      newNodes.set(newId, dup);
      newIds.push(newId);

      if (node.parentId) {
        const parent = newNodes.get(node.parentId);
        if (parent) {
          newNodes.set(node.parentId, {
            ...parent,
            children: [...parent.children, newId],
          } as DesignNode);
        }
      } else {
        const pageIdx = newPages.findIndex((p) => p.id === state.currentPageId);
        if (pageIdx >= 0) {
          newPages[pageIdx].children.push(newId);
        }
      }
    }

    set({
      nodes: newNodes,
      pages: newPages,
      selectedIds: new Set(newIds),
    });
    get().pushHistory("Duplicate");
  },

  groupNodes: (ids) => {
    if (ids.length < 2) return;
    const state = get();
    const validIds = ids.filter((id) => state.nodes.has(id));
    if (validIds.length < 2) return;

    const newNodes = new Map(state.nodes);
    const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));

    const firstNode = state.nodes.get(validIds[0]) as SceneNode | undefined;
    const parentId = firstNode?.parentId ?? null;
    const parentWorld = getParentWorldPosition(parentId, state.nodes);

    const worldPositions = new Map<string, { x: number; y: number }>();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of validIds) {
      const n = state.nodes.get(id) as SceneNode;
      if (!n) continue;
      const worldPos = getWorldPosition(n, state.nodes);
      worldPositions.set(id, worldPos);
      minX = Math.min(minX, worldPos.x);
      minY = Math.min(minY, worldPos.y);
      maxX = Math.max(maxX, worldPos.x + n.width);
      maxY = Math.max(maxY, worldPos.y + n.height);
    }
    if (!isFinite(minX) || !isFinite(minY)) return;

    const group = createDefaultNode("GROUP", {
      x: minX - parentWorld.x,
      y: minY - parentWorld.y,
      width: maxX - minX,
      height: maxY - minY,
      fills: [],
      children: [...validIds],
      parentId,
    });

    for (const id of validIds) {
      const node = newNodes.get(id);
      if (!node) continue;

      if (node.parentId) {
        const parent = newNodes.get(node.parentId);
        if (parent) {
          newNodes.set(node.parentId, {
            ...parent,
            children: parent.children.filter((c) => c !== id),
          } as DesignNode);
        }
      } else {
        for (const page of newPages) {
          page.children = page.children.filter((c) => c !== id);
        }
      }
    }

    for (const id of validIds) {
      const node = newNodes.get(id) as SceneNode | undefined;
      const worldPos = worldPositions.get(id);
      if (!node || !worldPos) continue;
      newNodes.set(id, {
        ...node,
        parentId: group.id,
        x: worldPos.x - minX,
        y: worldPos.y - minY,
      } as DesignNode);
    }

    newNodes.set(group.id, group as DesignNode);

    if (parentId) {
      const parent = newNodes.get(parentId);
      if (parent) {
        newNodes.set(parentId, {
          ...parent,
          children: [...parent.children, group.id],
        } as DesignNode);
      }
    } else {
      const pageIdx = newPages.findIndex((p) => p.id === state.currentPageId);
      if (pageIdx >= 0) {
        newPages[pageIdx].children.push(group.id);
      }
    }

    set({
      nodes: newNodes,
      pages: newPages,
      selectedIds: new Set([group.id]),
    });
    get().pushHistory("Group");
  },

  ungroupNodes: (ids) => {
    const state = get();
    const newNodes = new Map(state.nodes);
    const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));
    const newSelectedIds: string[] = [];

    for (const id of ids) {
      const node = newNodes.get(id) as SceneNode | undefined;
      if (!node || node.type !== "GROUP") continue;

      const groupWorld = getWorldPosition(node, newNodes);
      const parentWorld = getParentWorldPosition(node.parentId, newNodes);

      if (node.parentId) {
        const parent = newNodes.get(node.parentId);
        if (parent) {
          newNodes.set(node.parentId, {
            ...parent,
            children: parent.children.filter((c) => c !== id),
          } as DesignNode);
        }
      } else {
        for (const page of newPages) {
          page.children = page.children.filter((c) => c !== id);
        }
      }

      for (const childId of node.children) {
        const child = newNodes.get(childId) as SceneNode | undefined;
        if (!child) continue;
        const childWorld = {
          x: groupWorld.x + child.x,
          y: groupWorld.y + child.y,
        };

        newNodes.set(childId, {
          ...child,
          parentId: node.parentId,
          x: childWorld.x - parentWorld.x,
          y: childWorld.y - parentWorld.y,
        } as DesignNode);
        newSelectedIds.push(childId);
      }

      if (node.parentId) {
        const parent = newNodes.get(node.parentId);
        if (parent) {
          newNodes.set(node.parentId, {
            ...parent,
            children: [...parent.children, ...node.children],
          } as DesignNode);
        }
      } else {
        const pageIdx = newPages.findIndex((p) => p.id === state.currentPageId);
        if (pageIdx >= 0) {
          newPages[pageIdx].children.push(...node.children);
        }
        for (const page of newPages) {
          page.children = page.children.filter((c) => c !== id);
        }
      }
      newNodes.delete(id);
    }

    set({
      nodes: newNodes,
      pages: newPages,
      selectedIds: new Set(newSelectedIds),
    });
    get().pushHistory("Ungroup");
  },

  moveNodes: (ids, dx, dy) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      for (const id of ids) {
        const node = newNodes.get(id) as SceneNode;
        if (!node || node.locked) continue;
        newNodes.set(id, { ...node, x: node.x + dx, y: node.y + dy } as DesignNode);
      }
      return { nodes: newNodes };
    }),

  reorderNode: (id, newIndex, newParentId) => {
    const state = get();
    const node = state.nodes.get(id);
    if (!node) return;

    const newNodes = new Map(state.nodes);
    const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));

    // Remove from old parent
    if (node.parentId) {
      const parent = newNodes.get(node.parentId);
      if (parent) {
        newNodes.set(node.parentId, {
          ...parent,
          children: parent.children.filter((c) => c !== id),
        } as DesignNode);
      }
    } else {
      for (const page of newPages) {
        page.children = page.children.filter((c) => c !== id);
      }
    }

    // Add to new parent
    const targetParentId = newParentId ?? node.parentId;
    if (targetParentId) {
      const parent = newNodes.get(targetParentId);
      if (parent) {
        const children = [...parent.children];
        children.splice(newIndex, 0, id);
        newNodes.set(targetParentId, { ...parent, children } as DesignNode);
      }
    } else {
      const pageIdx = newPages.findIndex((p) => p.id === state.currentPageId);
      if (pageIdx >= 0) {
        newPages[pageIdx].children.splice(newIndex, 0, id);
      }
    }

    newNodes.set(id, { ...node, parentId: targetParentId ?? null } as DesignNode);
    set({ nodes: newNodes, pages: newPages });
  },

  bringForward: (ids) => {
    const state = get();
    for (const id of ids) {
      const node = state.nodes.get(id);
      if (!node) continue;
      const siblings = node.parentId
        ? state.nodes.get(node.parentId)?.children || []
        : state.pages.find((p) => p.id === state.currentPageId)?.children || [];
      const idx = siblings.indexOf(id);
      if (idx < siblings.length - 1) {
        get().reorderNode(id, idx + 1);
      }
    }
    get().pushHistory("Bring forward");
  },

  sendBackward: (ids) => {
    const state = get();
    for (const id of ids) {
      const node = state.nodes.get(id);
      if (!node) continue;
      const siblings = node.parentId
        ? state.nodes.get(node.parentId)?.children || []
        : state.pages.find((p) => p.id === state.currentPageId)?.children || [];
      const idx = siblings.indexOf(id);
      if (idx > 0) {
        get().reorderNode(id, idx - 1);
      }
    }
    get().pushHistory("Send backward");
  },

  bringToFront: (ids) => {
    const state = get();
    for (const id of ids) {
      const node = state.nodes.get(id);
      if (!node) continue;
      const siblings = node.parentId
        ? state.nodes.get(node.parentId)?.children || []
        : state.pages.find((p) => p.id === state.currentPageId)?.children || [];
      get().reorderNode(id, siblings.length - 1);
    }
    get().pushHistory("Bring to front");
  },

  sendToBack: (ids) => {
    for (const id of ids) {
      get().reorderNode(id, 0);
    }
    get().pushHistory("Send to back");
  },

  // History
  pushHistory: (description) =>
    set((state) => {
      const clonedNodes = cloneNodesMap(state.nodes);
      const entry: HistoryEntry = {
        nodes: clonedNodes,
        pages: deepClone(state.pages),
        description,
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);
      if (newHistory.length > 100) newHistory.shift();
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];
      return {
        nodes: cloneNodesMap(entry.nodes),
        pages: deepClone(entry.pages),
        historyIndex: newIndex,
        selectedIds: new Set(),
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      return {
        nodes: cloneNodesMap(entry.nodes),
        pages: deepClone(entry.pages),
        historyIndex: newIndex,
        selectedIds: new Set(),
      };
    }),

  // Clipboard
  copyNodes: () => {
    const state = get();
    const copied: DesignNode[] = [];
    for (const id of state.selectedIds) {
      const node = state.nodes.get(id);
      if (node) copied.push(deepClone(node));
    }
    set({ clipboard: copied });
  },

  pasteNodes: () => {
    const state = get();
    if (state.clipboard.length === 0) return;
    const newIds: string[] = [];
    const newNodes = new Map(state.nodes);
    const newPages = state.pages.map((p) => ({ ...p, children: [...p.children] }));

    for (const node of state.clipboard) {
      const newId = nanoid();
      const dup = {
        ...deepClone(node),
        id: newId,
        parentId: null,
        x: (node as SceneNode).x + 20,
        y: (node as SceneNode).y + 20,
      } as DesignNode;
      newNodes.set(newId, dup);
      newIds.push(newId);

      const pageIdx = newPages.findIndex((p) => p.id === state.currentPageId);
      if (pageIdx >= 0) {
        newPages[pageIdx].children.push(newId);
      }
    }

    set({
      nodes: newNodes,
      pages: newPages,
      selectedIds: new Set(newIds),
    });
    get().pushHistory("Paste");
  },

  // Pages
  addPage: () =>
    set((state) => {
      const newPage: PageData = {
        id: nanoid(),
        name: `Page ${state.pages.length + 1}`,
        children: [],
      };
      return {
        pages: [...state.pages, newPage],
        currentPageId: newPage.id,
        selectedIds: new Set(),
      };
    }),

  setCurrentPage: (pageId) =>
    set({ currentPageId: pageId, selectedIds: new Set() }),

  renamePage: (pageId, name) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, name } : p
      ),
    })),

  deletePage: (pageId) =>
    set((state) => {
      if (state.pages.length <= 1) return state;
      const page = state.pages.find((p) => p.id === pageId);
      if (!page) return state;

      const newNodes = new Map(state.nodes);
      const deleteRecursive = (nodeId: string) => {
        const node = newNodes.get(nodeId);
        if (!node) return;
        for (const childId of node.children) {
          deleteRecursive(childId);
        }
        newNodes.delete(nodeId);
      };
      for (const childId of page.children) {
        deleteRecursive(childId);
      }

      const newPages = state.pages.filter((p) => p.id !== pageId);
      const newCurrentPageId =
        state.currentPageId === pageId ? newPages[0].id : state.currentPageId;

      return {
        nodes: newNodes,
        pages: newPages,
        currentPageId: newCurrentPageId,
        selectedIds: state.currentPageId === pageId ? new Set<string>() : state.selectedIds,
      };
    }),

  // Toast
  addToast: (message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: nanoid(), message, timestamp: Date.now() },
      ],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Persistence
  exportDocument: () => {
    const state = get();
    const nodesObj: Record<string, DesignNode> = {};
    state.nodes.forEach((v, k) => {
      nodesObj[k] = v;
    });
    return JSON.stringify(
      {
        formatVersion: "1.0",
        name: state.documentName,
        lastModified: new Date().toISOString(),
        pages: state.pages,
        nodes: nodesObj,
        components: {},
        styles: { colors: {}, text: {}, effects: {} },
        assets: { images: {} },
      },
      null,
      2
    );
  },

  importDocument: (json) => {
    try {
      const doc = JSON.parse(json);
      const nodesMap = new Map<string, DesignNode>();
      if (doc.nodes) {
        for (const [k, v] of Object.entries(doc.nodes)) {
          nodesMap.set(k, deepClone(v as DesignNode));
        }
      }
      const pages: PageData[] =
        Array.isArray(doc.pages) && doc.pages.length > 0
          ? deepClone(doc.pages)
          : [{ id: nanoid(), name: "Page 1", children: [] }];

      set({
        nodes: nodesMap,
        pages,
        currentPageId: pages[0].id,
        documentName: doc.name || "Imported",
        selectedIds: new Set(),
      });
      get().pushHistory("Import document");
      get().addToast("Document imported");
    } catch {
      get().addToast("Failed to import document");
    }
  },

  // Helpers
  getNode: (id) => get().nodes.get(id),
  getSelectedNodes: () => {
    const state = get();
    return Array.from(state.selectedIds)
      .map((id) => state.nodes.get(id))
      .filter(Boolean) as DesignNode[];
  },
  getCurrentPageNodes: () => {
    const state = get();
    const page = state.pages.find((p) => p.id === state.currentPageId);
    if (!page) return [];
    const result: DesignNode[] = [];
    const collectNodes = (childIds: string[]) => {
      for (const id of childIds) {
        const node = state.nodes.get(id);
        if (node) {
          result.push(node);
          if (node.children.length > 0) {
            collectNodes(node.children);
          }
        }
      }
    };
    collectNodes(page.children);
    return result;
  },
  getChildNodes: (parentId) => {
    const state = get();
    const parent = state.nodes.get(parentId);
    if (!parent) return [];
    return parent.children
      .map((id) => state.nodes.get(id))
      .filter(Boolean) as DesignNode[];
  },
}));
