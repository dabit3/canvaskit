"use client";

import React, { useEffect, useState } from "react";
import { useEditorStore } from "../store";
import { SceneNode } from "../types";
import Toolbar from "./Toolbar";
import Canvas from "./Canvas";
import LayersPanel from "./LayersPanel";
import PropertiesPanel from "./PropertiesPanel";
import Toasts from "./Toasts";
import ShortcutHelp from "./ShortcutHelp";
import { fitImageToMaxWidth } from "../utils/imageSizing";
import { useMultiplayer } from "../hooks/useMultiplayer";

const DB_NAME = "canvaskit";
const STORE_NAME = "documents";
const AUTOSAVE_ID = "autosave";

function openEditorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAutosaveDocument(data: string): Promise<void> {
  const db = await openEditorDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id: AUTOSAVE_ID,
      data,
      timestamp: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function loadAutosaveDocument(): Promise<string | null> {
  const db = await openEditorDb();
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(AUTOSAVE_ID);
    request.onsuccess = () => resolve(request.result?.data ?? null);
    request.onerror = () => reject(request.error);
  });
}

export default function Editor() {
  const showLeftPanel = useEditorStore((s) => s.showLeftPanel);
  const showRightPanel = useEditorStore((s) => s.showRightPanel);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const camera = useEditorStore((s) => s.camera);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const { collaborators, myProfile, updateProfile, updatePresence } = useMultiplayer();

  // Push initial history state
  useEffect(() => {
    pushHistory("Initial state");
  }, [pushHistory]);

  // ? key to toggle shortcut help
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showShortcuts]);

  // Debounced auto-save to IndexedDB when document data changes
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;

    const flushSave = () => {
      if (!dirty) return;
      dirty = false;
      const json = useEditorStore.getState().exportDocument();
      saveAutosaveDocument(json).catch(() => {
        // no-op in demo mode
      });
    };

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      const changed =
        state.nodes !== prev.nodes ||
        state.pages !== prev.pages ||
        state.documentName !== prev.documentName;
      if (!changed) return;

      dirty = true;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(flushSave, 500);
    });

    // Flush save immediately on page unload so changes aren't lost
    const handleBeforeUnload = () => {
      if (timer) clearTimeout(timer);
      flushSave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timer) clearTimeout(timer);
      flushSave();
    };
  }, []);

  // Load auto-save on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAutosaveDocument();
        if (!cancelled && data) {
          const state = useEditorStore.getState();
          state.importDocument(data);
          state.addToast("Recovered auto-save");
        }
      } catch {
        // no-op in demo mode
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Image drag-and-drop
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const state = useEditorStore.getState();
              const { camera } = state;
              const canvas = document.querySelector("canvas");
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const worldX = ((e.clientX - rect.left) - camera.x) / camera.zoom;
              const worldY = ((e.clientY - rect.top) - camera.y) / camera.zoom;
              const maxImportWidth = rect.width / camera.zoom;
              const { width, height } = fitImageToMaxWidth(img.width, img.height, maxImportWidth);

              state.createShape("RECTANGLE", worldX, worldY, width, height, {
                name: file.name,
                fills: [{
                  type: "IMAGE" as const,
                  imageRef: reader.result as string,
                  scaleMode: "FILL" as const,
                }],
              });
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        } else if (file.name.endsWith(".canvas.json") || file.name.endsWith(".json")) {
          const reader = new FileReader();
          reader.onload = () => {
            useEditorStore.getState().importDocument(reader.result as string);
          };
          reader.readAsText(file);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, []);

  // Status bar info
  const selectedNodes = Array.from(selectedIds)
    .map((id) => nodes.get(id))
    .filter(Boolean) as SceneNode[];
  const firstNode = selectedNodes[0];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1a1a1a] overflow-hidden">
      {/* Toolbar */}
      <Toolbar
        profile={myProfile}
        onUpdateProfile={updateProfile}
        collaboratorCount={collaborators.size}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        {showLeftPanel && (
          <div className="w-60 bg-[#252525] border-r border-white/[0.06] flex flex-col overflow-hidden">
            <LayersPanel />
          </div>
        )}

        {/* Canvas */}
        <Canvas
          collaborators={collaborators}
          onPointerUpdate={updatePresence}
        />

        {/* Right panel */}
        {showRightPanel && (
          <div className="w-64 bg-[#252525] border-l border-white/[0.06] flex flex-col overflow-hidden">
            <PropertiesPanel />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-7 bg-[#252525] border-t border-white/[0.06] flex items-center px-4 text-[10px] text-white/35 gap-4">
        <span>
          {selectedIds.size > 0
            ? `${selectedIds.size} selected`
            : "No selection"}
        </span>
        {firstNode && (
          <>
            <span className="text-white/25">|</span>
            <span>
              X: {Math.round(firstNode.x)}  Y: {Math.round(firstNode.y)}
            </span>
            <span>
              W: {Math.round(firstNode.width)}  H: {Math.round(firstNode.height)}
            </span>
            {firstNode.rotation !== 0 && (
              <span>R: {Math.round(firstNode.rotation)}°</span>
            )}
          </>
        )}
        <div className="flex-1" />
        <button
          className="text-white/25 hover:text-white/50 transition-colors cursor-pointer"
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts"
        >
          ? Shortcuts
        </button>
        <span className="text-white/25">|</span>
        <span>Zoom: {Math.round(camera.zoom * 100)}%</span>
      </div>

      {/* Toasts */}
      <Toasts />

      {/* Shortcut help overlay */}
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
