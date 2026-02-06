"use client";

import React, { useState, useRef, useEffect } from "react";
import { useEditorStore } from "../store";
import { ToolType } from "../types";
import { fitImageToMaxWidth } from "../utils/imageSizing";
import UserMenu from "./UserMenu";

function ToolIcon({ type }: { type: ToolType }) {
  const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "SELECT": return <svg {...s}><path d="M4 4l7 17 2.5-6.5L20 12z" fill="currentColor" stroke="none" /><path d="M13.5 14.5L20 21" strokeWidth="2.5" /></svg>;
    case "FRAME": return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeWidth="1.5" /></svg>;
    case "RECTANGLE": return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
    case "ELLIPSE": return <svg {...s}><ellipse cx="12" cy="12" rx="9" ry="9" /></svg>;
    case "LINE": return <svg {...s}><line x1="5" y1="19" x2="19" y2="5" /></svg>;
    case "POLYGON": return <svg {...s}><path d="M12 2l9.5 7-3.5 10.5h-12L2.5 9z" /></svg>;
    case "STAR": return <svg {...s}><path d="M12 2l2.9 6.3L22 9.2l-5 5.2L18.2 22 12 18.5 5.8 22 7 14.4l-5-5.2 7.1-.9z" /></svg>;
    case "PEN": return <svg {...s}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18" /><circle cx="11" cy="11" r="1" fill="currentColor" stroke="none" /></svg>;
    case "TEXT": return <svg {...s} strokeWidth="2.5"><path d="M6 4h12M12 4v16" /></svg>;
    case "HAND": return <svg {...s}><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4.5a2 2 0 0 0-4 0V10M10 9.5V6a2 2 0 0 0-4 0v7" /><path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6.1-2.7L4.2 17a2 2 0 0 1 3-2.4L8 16" /></svg>;
    case "ZOOM": return <svg {...s}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6M11 8v6" strokeWidth="1.5" /></svg>;
    default: return null;
  }
}

type ToolGroup = { type: ToolType; label: string; shortcut: string }[] | "separator";

const toolGroups: ToolGroup[] = [
  [{ type: "SELECT", label: "Select", shortcut: "V" }],
  "separator",
  [
    { type: "FRAME", label: "Frame", shortcut: "F" },
    { type: "RECTANGLE", label: "Rectangle", shortcut: "R" },
    { type: "ELLIPSE", label: "Ellipse", shortcut: "O" },
    { type: "LINE", label: "Line", shortcut: "L" },
    { type: "POLYGON", label: "Polygon", shortcut: "—" },
    { type: "STAR", label: "Star", shortcut: "—" },
  ],
  "separator",
  [
    { type: "PEN", label: "Pen", shortcut: "P" },
    { type: "TEXT", label: "Text", shortcut: "T" },
  ],
  "separator",
  [
    { type: "HAND", label: "Hand", shortcut: "H" },
    { type: "ZOOM", label: "Zoom (Alt+click out)", shortcut: "Z" },
  ],
];

interface ToolbarProps {
  profile: { name: string; color: string } | null;
  onUpdateProfile: (name: string, color: string) => void;
  collaboratorCount: number;
}

export default function Toolbar({ profile, onUpdateProfile, collaboratorCount }: ToolbarProps) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const documentName = useEditorStore((s) => s.documentName);
  const setDocumentName = useEditorStore((s) => s.setDocumentName);
  const camera = useEditorStore((s) => s.camera);
  const setCamera = useEditorStore((s) => s.setCamera);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const [editingName, setEditingName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportDocument = useEditorStore((s) => s.exportDocument);
  const importDocument = useEditorStore((s) => s.importDocument);
  const addToast = useEditorStore((s) => s.addToast);
  const showLeftPanel = useEditorStore((s) => s.showLeftPanel);
  const showRightPanel = useEditorStore((s) => s.showRightPanel);
  const setShowLeftPanel = useEditorStore((s) => s.setShowLeftPanel);
  const setShowRightPanel = useEditorStore((s) => s.setShowRightPanel);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleNewFile = () => {
    setMenuOpen(false);
    if (confirm("Create a new file? Unsaved changes will be lost.")) {
      window.location.reload();
    }
  };

  const handleOpenFile = () => {
    setMenuOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.canvas.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        importDocument(reader.result as string);
        addToast("File opened");
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSaveFile = () => {
    setMenuOpen(false);
    const json = exportDocument();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentName || "Untitled"}.canvas.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("Saved to file");
  };

  const handleImportImage = () => {
    setMenuOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const state = useEditorStore.getState();
            const { camera } = state;
            const canvas = document.querySelector("canvas");
            const rect = canvas?.getBoundingClientRect();
            const cx = rect ? rect.width / 2 : 400;
            const cy = rect ? rect.height / 2 : 300;
            const maxImportWidth = rect ? rect.width / camera.zoom : img.width;
            const { width, height } = fitImageToMaxWidth(img.width, img.height, maxImportWidth);
            const worldX = (cx - camera.x) / camera.zoom - width / 2;
            const worldY = (cy - camera.y) / camera.zoom - height / 2;

            state.createShape("RECTANGLE", worldX, worldY, width, height, {
              name: file.name,
              fills: [{
                type: "IMAGE" as const,
                imageRef: reader.result as string,
                scaleMode: "FILL" as const,
              }],
            });
            state.pushHistory("Import image");
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
      addToast(`Imported ${files.length} image${files.length > 1 ? "s" : ""}`);
    };
    input.click();
  };

  const handleTogglePanels = () => {
    setMenuOpen(false);
    setShowLeftPanel(!showLeftPanel);
    setShowRightPanel(!showRightPanel);
  };

  const zoomPercent = Math.round(camera.zoom * 100);

  const handleZoomToFit = () => {
    const state = useEditorStore.getState();
    const pageNodes = state.getCurrentPageNodes();
    if (pageNodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of pageNodes) {
      const sn = n as import("../types").SceneNode;
      minX = Math.min(minX, sn.x);
      minY = Math.min(minY, sn.y);
      maxX = Math.max(maxX, sn.x + sn.width);
      maxY = Math.max(maxY, sn.y + sn.height);
    }
    if (!isFinite(minX)) return;
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padding = 64;
    const vw = Math.max(1, rect.width - padding * 2);
    const vh = Math.max(1, rect.height - padding * 2);
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const zoom = Math.min(vw / bw, vh / bh, 8);
    const cx = minX + bw / 2;
    const cy = minY + bh / 2;
    setCamera({ zoom, x: rect.width / 2 - cx * zoom, y: rect.height / 2 - cy * zoom });
  };

  const zoomPresets: { label: string; action: () => void }[] = [
    { label: "Zoom to Fit", action: handleZoomToFit },
    { label: "50%", action: () => setCamera({ zoom: 0.5 }) },
    { label: "100%", action: () => setCamera({ zoom: 1 }) },
    { label: "200%", action: () => setCamera({ zoom: 2 }) },
    { label: "400%", action: () => setCamera({ zoom: 4 }) },
  ];

  return (
    <div className="h-11 bg-[#252525] border-b border-white/[0.06] flex items-center px-3 gap-1 select-none">
      {/* Logo / Menu */}
      <div className="relative" ref={menuRef}>
        <div
          className={`w-8 h-8 flex items-center justify-center text-white/50 hover:bg-white/[0.08] rounded-md cursor-pointer mr-2 transition-colors ${
            menuOpen ? "bg-white/[0.1]" : ""
          }`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="14" height="2" rx="0.5" />
            <rect x="1" y="7" width="14" height="2" rx="0.5" />
            <rect x="1" y="12" width="14" height="2" rx="0.5" />
          </svg>
        </div>
        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 bg-[#2a2a2a] border border-white/[0.1] rounded-lg shadow-2xl py-1.5 z-50 min-w-[200px]">
            <button
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={handleNewFile}
            >
              <span>New File</span>
            </button>
            <button
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={handleOpenFile}
            >
              <span>Open File...</span>
              <span className="text-white/30 text-[10px]">Ctrl+O</span>
            </button>
            <button
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={handleSaveFile}
            >
              <span>Save to File</span>
              <span className="text-white/30 text-[10px]">Ctrl+S</span>
            </button>
            <div className="h-px bg-white/[0.08] my-1.5 mx-2" />
            <button
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={handleImportImage}
            >
              <span>Import Image...</span>
            </button>
            <div className="h-px bg-white/[0.08] my-1.5 mx-2" />
            <button
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] flex justify-between items-center transition-colors"
              onClick={handleTogglePanels}
            >
              <span>Toggle Panels</span>
              <span className="text-white/30 text-[10px]">Ctrl+\</span>
            </button>
          </div>
        )}
      </div>

      {/* Document name */}
      {editingName ? (
        <input
          className="bg-white/[0.06] text-white text-[12px] px-2.5 py-1 rounded-md border border-[#0d99ff]/70 outline-none w-40"
          value={documentName}
          autoFocus
          onChange={(e) => setDocumentName(e.target.value)}
          onBlur={() => setEditingName(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditingName(false);
          }}
        />
      ) : (
        <button
          className="text-white/70 text-[12px] px-2 py-1 hover:bg-white/[0.08] rounded-md mr-3 transition-colors"
          onClick={() => setEditingName(true)}
        >
          {documentName}
        </button>
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-white/[0.08] mx-1" />

      {/* Undo/Redo */}
      <button
        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white/70 hover:bg-white/[0.08] rounded-md transition-colors"
        onClick={undo}
        title="Undo (Ctrl+Z)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" />
          <path d="M7 14l-4-4 4-4" />
        </svg>
      </button>
      <button
        className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-white/70 hover:bg-white/[0.08] rounded-md transition-colors"
        onClick={redo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10H11a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h5" />
          <path d="M17 14l4-4-4-4" />
        </svg>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-white/[0.08] mx-1" />

      {/* Tools */}
      {toolGroups.map((group, gi) =>
        group === "separator" ? (
          <div key={`sep-${gi}`} className="w-px h-5 bg-white/[0.08] mx-0.5" />
        ) : (
          group.map((tool) => (
            <button
              key={tool.type}
              className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                activeTool === tool.type
                  ? "bg-[#0d99ff]/90 text-white shadow-sm shadow-[#0d99ff]/20"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.08]"
              }`}
              onClick={() => setActiveTool(tool.type)}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <ToolIcon type={tool.type} />
            </button>
          ))
        )
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Menu */}
      {profile && (
        <>
          <UserMenu
            name={profile.name}
            color={profile.color}
            onUpdate={onUpdateProfile}
            collaboratorCount={collaboratorCount}
          />
          <div className="w-px h-5 bg-white/[0.08] mx-2" />
        </>
      )}

      {/* Zoom */}
      <div className="relative group">
        <button className="text-white/50 text-[11px] px-2.5 py-1 hover:bg-white/[0.08] rounded-md min-w-[50px] text-center transition-colors">
          {zoomPercent}%
        </button>
        <div className="absolute right-0 top-full mt-1 bg-[#2a2a2a] border border-white/[0.1] rounded-lg shadow-2xl py-1.5 hidden group-hover:block z-50 min-w-[130px]">
          {zoomPresets.map((preset) => (
            <button
              key={preset.label}
              className="w-full text-left px-3.5 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08] transition-colors"
              onClick={preset.action}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
