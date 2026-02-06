"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import { RGBA } from "../types";

interface ColorPickerProps {
  color: RGBA;
  onChange: (color: RGBA) => void;
  onClose: () => void;
}

function rgbaToHsv(c: RGBA): { h: number; s: number; v: number } {
  const r = c.r, g = c.g, b = c.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h, s, v };
}

function hsvToRgba(h: number, s: number, v: number, a: number): RGBA {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return { r, g, b, a };
}

function rgbaToHex(c: RGBA): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
}

function hexToRgba(hex: string, a: number): RGBA | null {
  const match = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const h = match[1];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a,
  };
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const alphaCanvasRef = useRef<HTMLCanvasElement>(null);

  const [hsv, setHsv] = useState(() => rgbaToHsv(color));
  const [alpha, setAlpha] = useState(color.a);
  const [hexInput, setHexInput] = useState(rgbaToHex(color));
  const [dragging, setDragging] = useState<"sv" | "hue" | "alpha" | null>(null);

  const SV_SIZE = 200;
  const BAR_HEIGHT = 12;

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const emitColor = useCallback(
    (h: number, s: number, v: number, a: number) => {
      const rgba = hsvToRgba(h, s, v, a);
      onChange(rgba);
      setHexInput(rgbaToHex(rgba));
    },
    [onChange]
  );

  // Draw SV square
  useEffect(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = SV_SIZE;
    const h = SV_SIZE;
    canvas.width = w;
    canvas.height = h;

    // Base hue color
    const hueColor = hsvToRgba(hsv.h, 1, 1, 1);
    ctx.fillStyle = `rgb(${Math.round(hueColor.r * 255)}, ${Math.round(hueColor.g * 255)}, ${Math.round(hueColor.b * 255)})`;
    ctx.fillRect(0, 0, w, h);

    // White gradient (left to right)
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
    whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // Black gradient (top to bottom)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, "rgba(0,0,0,0)");
    blackGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);

    // Indicator
    const ix = hsv.s * w;
    const iy = (1 - hsv.v) * h;
    ctx.beginPath();
    ctx.arc(ix, iy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsv]);

  // Draw hue bar
  useEffect(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SV_SIZE;
    canvas.height = BAR_HEIGHT;

    const grad = ctx.createLinearGradient(0, 0, SV_SIZE, 0);
    for (let i = 0; i <= 6; i++) {
      const c = hsvToRgba(i / 6, 1, 1, 1);
      grad.addColorStop(
        i / 6,
        `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
      );
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SV_SIZE, BAR_HEIGHT);

    // Indicator
    const ix = hsv.h * SV_SIZE;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ix - 3, -1, 6, BAR_HEIGHT + 2);
  }, [hsv.h]);

  // Draw alpha bar
  useEffect(() => {
    const canvas = alphaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SV_SIZE;
    canvas.height = BAR_HEIGHT;

    // Checkerboard
    const size = 4;
    for (let x = 0; x < SV_SIZE; x += size) {
      for (let y = 0; y < BAR_HEIGHT; y += size) {
        ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#ccc" : "#fff";
        ctx.fillRect(x, y, size, size);
      }
    }

    const c = hsvToRgba(hsv.h, hsv.s, hsv.v, 1);
    const grad = ctx.createLinearGradient(0, 0, SV_SIZE, 0);
    grad.addColorStop(0, `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, 0)`);
    grad.addColorStop(1, `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, 1)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SV_SIZE, BAR_HEIGHT);

    // Indicator
    const ix = alpha * SV_SIZE;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ix - 3, -1, 6, BAR_HEIGHT + 2);
  }, [hsv, alpha]);

  const handleSVMouse = useCallback(
    (e: React.MouseEvent) => {
      const canvas = svCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const newHsv = { ...hsv, s: x, v: 1 - y };
      setHsv(newHsv);
      emitColor(newHsv.h, newHsv.s, newHsv.v, alpha);
    },
    [hsv, alpha, emitColor]
  );

  const handleHueMouse = useCallback(
    (e: React.MouseEvent) => {
      const canvas = hueCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newHsv = { ...hsv, h: x };
      setHsv(newHsv);
      emitColor(newHsv.h, newHsv.s, newHsv.v, alpha);
    },
    [hsv, alpha, emitColor]
  );

  const handleAlphaMouse = useCallback(
    (e: React.MouseEvent) => {
      const canvas = alphaCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setAlpha(x);
      emitColor(hsv.h, hsv.s, hsv.v, x);
    },
    [hsv, emitColor]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const fakeEvent = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
      if (dragging === "sv") handleSVMouse(fakeEvent);
      else if (dragging === "hue") handleHueMouse(fakeEvent);
      else if (dragging === "alpha") handleAlphaMouse(fakeEvent);
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, handleSVMouse, handleHueMouse, handleAlphaMouse]);

  const currentColor = hsvToRgba(hsv.h, hsv.s, hsv.v, alpha);

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-[#2c2c2c] border border-[#444] rounded-lg shadow-xl p-3 flex flex-col gap-2"
      style={{ width: SV_SIZE + 24 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* SV Square */}
      <canvas
        ref={svCanvasRef}
        className="rounded cursor-crosshair"
        style={{ width: SV_SIZE, height: SV_SIZE }}
        onMouseDown={(e) => {
          setDragging("sv");
          handleSVMouse(e);
        }}
      />

      {/* Hue bar */}
      <canvas
        ref={hueCanvasRef}
        className="rounded cursor-pointer"
        style={{ width: SV_SIZE, height: BAR_HEIGHT }}
        onMouseDown={(e) => {
          setDragging("hue");
          handleHueMouse(e);
        }}
      />

      {/* Alpha bar */}
      <canvas
        ref={alphaCanvasRef}
        className="rounded cursor-pointer"
        style={{ width: SV_SIZE, height: BAR_HEIGHT }}
        onMouseDown={(e) => {
          setDragging("alpha");
          handleAlphaMouse(e);
        }}
      />

      {/* Hex input */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-white/40 text-xs">#</span>
        <input
          className="flex-1 bg-[#3c3c3c] text-white text-xs px-2 py-1 rounded border border-[#555] outline-none focus:border-[#0d99ff] font-mono"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            const parsed = hexToRgba(e.target.value, alpha);
            if (parsed) {
              onChange(parsed);
              setHsv(rgbaToHsv(parsed));
            }
          }}
        />
        <span className="text-white/40 text-xs w-8 text-right">
          {Math.round(alpha * 100)}%
        </span>
      </div>

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-1 mt-1">
        {[
          "#000000", "#FFFFFF", "#FF0000", "#FF6B00", "#FFD600",
          "#00C853", "#00B0FF", "#0D99FF", "#651FFF", "#FF4081",
          "#795548", "#607D8B", "#9E9E9E", "#E0E0E0", "#F5F5F5",
          "#1A1A2E", "#16213E", "#0F3460", "#E94560", "#533483",
        ].map((hex) => {
          const parsed = hexToRgba(hex, alpha);
          return (
            <button
              key={hex}
              className="w-4 h-4 rounded-sm border border-white/10 hover:border-white/40 transition-colors cursor-pointer"
              style={{ backgroundColor: hex }}
              onClick={() => {
                if (parsed) {
                  onChange(parsed);
                  setHsv(rgbaToHsv(parsed));
                  setHexInput(hex.replace("#", ""));
                }
              }}
              title={hex}
            />
          );
        })}
      </div>

      {/* Color preview */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border border-[#555]"
          style={{
            backgroundColor: `rgba(${Math.round(currentColor.r * 255)}, ${Math.round(currentColor.g * 255)}, ${Math.round(currentColor.b * 255)}, ${currentColor.a})`,
          }}
        />
        <span className="text-white/60 text-xs font-mono">
          rgb({Math.round(currentColor.r * 255)}, {Math.round(currentColor.g * 255)}, {Math.round(currentColor.b * 255)})
        </span>
      </div>
    </div>
  );
}
