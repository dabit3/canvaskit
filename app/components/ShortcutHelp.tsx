"use client";

import React from "react";

const shortcuts = [
  { section: "Tools", items: [
    { keys: ["V"], desc: "Select" },
    { keys: ["F"], desc: "Frame" },
    { keys: ["R"], desc: "Rectangle" },
    { keys: ["O"], desc: "Ellipse" },
    { keys: ["L"], desc: "Line" },
    { keys: ["P"], desc: "Pen" },
    { keys: ["T"], desc: "Text" },
    { keys: ["H"], desc: "Hand / Pan" },
    { keys: ["Z"], desc: "Zoom (Alt+click to zoom out)" },
  ]},
  { section: "Edit", items: [
    { keys: ["⌘", "Z"], desc: "Undo" },
    { keys: ["⌘", "⇧", "Z"], desc: "Redo" },
    { keys: ["⌘", "C"], desc: "Copy" },
    { keys: ["⌘", "V"], desc: "Paste" },
    { keys: ["⌘", "D"], desc: "Duplicate" },
    { keys: ["⌫"], desc: "Delete" },
    { keys: ["⌘", "A"], desc: "Select All" },
  ]},
  { section: "Transform", items: [
    { keys: ["↑↓←→"], desc: "Nudge 1px" },
    { keys: ["⇧", "↑↓←→"], desc: "Nudge 10px" },
    { keys: ["⇧"], desc: "Constrain proportions (while resizing)" },
    { keys: ["⇧"], desc: "Snap rotation to 15°" },
  ]},
  { section: "Arrange", items: [
    { keys: ["⌘", "G"], desc: "Group" },
    { keys: ["⌘", "⇧", "G"], desc: "Ungroup" },
    { keys: ["⌘", "]"], desc: "Bring Forward" },
    { keys: ["⌘", "["], desc: "Send Backward" },
    { keys: ["⌘", "⇧", "]"], desc: "Bring to Front" },
    { keys: ["⌘", "⇧", "["], desc: "Send to Back" },
  ]},
  { section: "View", items: [
    { keys: ["⌘", "+"], desc: "Zoom In" },
    { keys: ["⌘", "−"], desc: "Zoom Out" },
    { keys: ["⌘", "0"], desc: "Zoom to 100%" },
    { keys: ["⌘", "1"], desc: "Zoom to Fit" },
    { keys: ["⌘", "2"], desc: "Zoom to Selection" },
    { keys: ["⌘", "\\"], desc: "Toggle Panels" },
    { keys: ["Space"], desc: "Pan (hold + drag)" },
  ]},
  { section: "File", items: [
    { keys: ["⌘", "S"], desc: "Save to File" },
    { keys: ["⌘", "O"], desc: "Open File" },
  ]},
];

export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-[#2a2a2a] border border-white/[0.1] rounded-xl shadow-2xl pointer-events-auto max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] sticky top-0 bg-[#2a2a2a] z-10">
            <h2 className="text-sm font-semibold text-white/80">Keyboard Shortcuts</h2>
            <button
              className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] rounded-md transition-colors"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-6">
            {shortcuts.map((section) => (
              <div key={section.section}>
                <h3 className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                  {section.section}
                </h3>
                <div className="flex flex-col gap-1">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-[11px] text-white/60">{item.desc}</span>
                      <div className="flex gap-0.5">
                        {item.keys.map((key, ki) => (
                          <kbd
                            key={ki}
                            className="min-w-[22px] h-5 flex items-center justify-center px-1.5 text-[10px] text-white/70 bg-white/[0.08] border border-white/[0.12] rounded font-mono"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-white/[0.08] text-center">
            <span className="text-[10px] text-white/30">Press <kbd className="px-1 py-0.5 bg-white/[0.08] rounded text-white/50 font-mono">?</kbd> or <kbd className="px-1 py-0.5 bg-white/[0.08] rounded text-white/50 font-mono">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </>
  );
}
