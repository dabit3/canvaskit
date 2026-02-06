import React, { useState, useRef, useEffect } from "react";

interface UserMenuProps {
  name: string;
  color: string;
  onUpdate: (name: string, color: string) => void;
  collaboratorCount: number;
}

const COLORS = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#ef4444", "#f59e0b", "#10b981", "#3b82f6"];

export default function UserMenu({ name, color, onUpdate, collaboratorCount }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingName, setEditingName] = useState(name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditingName(name);
  }, [name]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSave = () => {
    onUpdate(editingName || "Anonymous", color);
  };

  const handleColorSelect = (c: string) => {
    onUpdate(editingName || "Anonymous", c);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-2 hover:bg-white/[0.08] px-2 py-1 rounded-md transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Multiplayer Profile"
      >
        <div className="flex -space-x-1.5 items-center">
             {/* Current user avatar */}
             <div
                className="w-6 h-6 rounded-full border-2 border-[#252525] flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm"
                style={{ backgroundColor: color }}
             >
                {name.charAt(0)}
             </div>
             {/* Count badge */}
             {collaboratorCount > 0 && (
                <div className="w-6 h-6 rounded-full bg-[#444] border-2 border-[#252525] flex items-center justify-center text-[9px] text-white font-medium shadow-sm">
                    +{collaboratorCount}
                </div>
             )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-[#2a2a2a] border border-white/[0.1] rounded-lg shadow-2xl p-3 w-48 z-50">
          <div className="text-[11px] text-white/50 mb-2 font-medium">YOUR PROFILE</div>

          <input
            className="w-full bg-black/20 text-white text-[12px] px-2 py-1.5 rounded border border-white/10 outline-none focus:border-[#0d99ff]/50 mb-3"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Your Name"
            maxLength={20}
          />

          <div className="text-[11px] text-white/50 mb-2 font-medium">COLOR</div>
          <div className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform ${color === c ? 'ring-2 ring-white/50' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
              />
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-white/40 text-center">
            {collaboratorCount === 0 ? "No one else here" : `${collaboratorCount} other(s) online`}
          </div>
        </div>
      )}
    </div>
  );
}
