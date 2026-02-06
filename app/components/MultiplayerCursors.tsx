import React from "react";
import { useEditorStore } from "../store";
import { Collaborator } from "../types";

const CursorIcon = ({ color }: { color: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
  >
    <path
      d="M1 1L5.5 14L8 8.5L14 7L1 1Z"
      fill={color}
      stroke="white"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

interface MultiplayerCursorsProps {
  collaborators: Map<string, Collaborator>;
}

export default function MultiplayerCursors({ collaborators }: MultiplayerCursorsProps) {
  const camera = useEditorStore((s) => s.camera);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from(collaborators.values()).map((c) => {
        // Simple linear interpolation could be added here for smoother movement
        const sx = c.x * camera.zoom + camera.x;
        const sy = c.y * camera.zoom + camera.y;

        return (
          <div
            key={c.id}
            className="absolute left-0 top-0 flex flex-col items-start transition-transform duration-100 ease-linear will-change-transform"
            style={{
              transform: `translate(${sx}px, ${sy}px)`,
            }}
          >
            <CursorIcon color={c.color} />
            <div
              className="ml-3 mt-1 px-1.5 py-0.5 rounded text-[10px] text-white font-medium whitespace-nowrap shadow-sm max-w-[100px] truncate"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
