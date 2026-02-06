"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditorStore } from "../store";
import { SceneNode, TextNode, RGBA, Paint, Effect } from "../types";
import ColorPicker from "./ColorPicker";
import { renderNode as renderNodeFn } from "../utils/renderer";

function rgbaToHexColor(color: RGBA): string {
  const toHex = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [localValue, setLocalValue] = useState(String(Math.round(value * 100) / 100));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(String(Math.round(value * 100) / 100));
    }
  }, [value]);

  const parseNumericInput = (raw: string, baseValue: number): number => {
    const input = raw.trim();
    if (!input) return baseValue;

    const relativeMatch = input.match(/^([+\-*/])\s*(-?\d*\.?\d+)$/);
    if (relativeMatch) {
      const op = relativeMatch[1];
      const operand = parseFloat(relativeMatch[2]);
      if (isNaN(operand)) return baseValue;
      switch (op) {
        case "+":
          return baseValue + operand;
        case "-":
          return baseValue - operand;
        case "*":
          return baseValue * operand;
        case "/":
          return operand === 0 ? baseValue : baseValue / operand;
        default:
          return baseValue;
      }
    }

    const absolute = parseFloat(input);
    return isNaN(absolute) ? baseValue : absolute;
  };

  const commit = (val: string) => {
    let result = parseNumericInput(val, value);
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    onChange(result);
    setLocalValue(String(Math.round(result * 100) / 100));
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-white/40 font-medium">{label}</label>
      <input
        ref={inputRef}
        className="bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 focus:bg-white/[0.08] outline-none w-full transition-colors"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => commit(localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(localValue);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const s = e.shiftKey ? step * 10 : step;
            commit(String(value + s));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const s = e.shiftKey ? step * 10 : step;
            commit(String(value - s));
          }
          e.stopPropagation();
        }}
      />
    </div>
  );
}

function CornerRadiusInput({ node }: { node: SceneNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [perCorner, setPerCorner] = useState(Array.isArray(node.cornerRadius));

  if (perCorner || Array.isArray(node.cornerRadius)) {
    const cr = Array.isArray(node.cornerRadius) ? node.cornerRadius : [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius];
    return (
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-white/40 font-medium">Corners</label>
          <button
            className="text-[9px] text-white/30 hover:text-white/60 transition-colors"
            onClick={() => {
              setPerCorner(false);
              updateNode(node.id, { cornerRadius: cr[0] });
              pushHistory("Change corner radius");
            }}
            title="Use uniform radius"
          >
            Uniform
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {["TL", "TR", "BR", "BL"].map((label, i) => (
            <div key={label} className="flex flex-col gap-0.5">
              <label className="text-[9px] text-white/30 text-center">{label}</label>
              <input
                className="bg-white/[0.06] text-white/90 text-xs px-1.5 py-[5px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none w-full text-center transition-colors"
                type="number"
                min={0}
                value={cr[i]}
                onChange={(e) => {
                  const newCr = [...cr] as [number, number, number, number];
                  newCr[i] = Math.max(0, parseInt(e.target.value) || 0);
                  updateNode(node.id, { cornerRadius: newCr });
                }}
                onBlur={() => pushHistory("Change corner radius")}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-white/40 font-medium">Radius</label>
        <button
          className="text-[9px] text-white/30 hover:text-white/60 transition-colors"
          onClick={() => {
            setPerCorner(true);
            const v = typeof node.cornerRadius === "number" ? node.cornerRadius : 0;
            updateNode(node.id, { cornerRadius: [v, v, v, v] });
          }}
          title="Set per-corner radius"
        >
          Per corner
        </button>
      </div>
      <input
        className="bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 focus:bg-white/[0.08] outline-none w-full transition-colors"
        type="number"
        min={0}
        value={typeof node.cornerRadius === "number" ? node.cornerRadius : 0}
        onChange={(e) => {
          updateNode(node.id, { cornerRadius: Math.max(0, parseInt(e.target.value) || 0) });
        }}
        onBlur={() => pushHistory("Change corner radius")}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ExportSection({ selectedNodes }: { selectedNodes: SceneNode[] }) {
  const [exportScale, setExportScale] = useState(2);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg">("png");
  const addToast = useEditorStore((s) => s.addToast);

  const doExport = () => {
    if (selectedNodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of selectedNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const exportName = selectedNodes.length === 1 ? selectedNodes[0].name : `${selectedNodes.length}-layers`;

    if (exportFormat === "svg") {
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boundsW}" height="${boundsH}" viewBox="${minX} ${minY} ${boundsW} ${boundsH}">`;
      for (const n of selectedNodes) {
        const fill = n.fills.length > 0 && n.fills[0].type === "SOLID"
          ? `rgb(${Math.round(n.fills[0].color.r * 255)}, ${Math.round(n.fills[0].color.g * 255)}, ${Math.round(n.fills[0].color.b * 255)})`
          : "none";
        const strokeParts: string[] = [];
        if (n.strokes.length > 0 && n.strokes[0].type === "SOLID" && n.strokeWeight > 0) {
          strokeParts.push(`stroke="rgb(${Math.round(n.strokes[0].color.r * 255)}, ${Math.round(n.strokes[0].color.g * 255)}, ${Math.round(n.strokes[0].color.b * 255)})"`);
          strokeParts.push(`stroke-width="${n.strokeWeight}"`);
        }
        const strokeAttr = strokeParts.join(" ");
        const transform = n.rotation ? ` transform="rotate(${n.rotation} ${n.x + n.width / 2} ${n.y + n.height / 2})"` : "";
        if (n.type === "ELLIPSE") {
          svg += `<ellipse cx="${n.x + n.width / 2}" cy="${n.y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" fill="${fill}" opacity="${n.opacity}" ${strokeAttr}${transform} />`;
        } else if (n.type === "TEXT") {
          const tn = n as TextNode;
          svg += `<text x="${n.x}" y="${n.y + (tn.fontSize || 16)}" font-family="${tn.fontFamily}" font-size="${tn.fontSize}" font-weight="${tn.fontWeight}" fill="${fill}" opacity="${n.opacity}"${transform}>${tn.characters}</text>`;
        } else if (n.type === "LINE") {
          svg += `<line x1="${n.x}" y1="${n.y}" x2="${n.x + n.width}" y2="${n.y + n.height}" ${strokeAttr || 'stroke="black" stroke-width="2"'} opacity="${n.opacity}"${transform} />`;
        } else {
          const cr = typeof n.cornerRadius === "number" ? n.cornerRadius : 0;
          svg += `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${cr}" fill="${fill}" opacity="${n.opacity}" ${strokeAttr}${transform} />`;
        }
      }
      svg += `</svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Exported as SVG");
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = boundsW * exportScale;
      canvas.height = boundsH * exportScale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (exportFormat === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.scale(exportScale, exportScale);
      ctx.translate(-minX, -minY);
      const allNodes = useEditorStore.getState().nodes;
      const camera = { x: 0, y: 0, zoom: 1 };
      for (const n of selectedNodes) {
        renderNodeFn(ctx, n, allNodes, camera);
      }
      const mimeType = exportFormat === "jpg" ? "image/jpeg" : "image/png";
      const quality = exportFormat === "jpg" ? 0.92 : undefined;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportName}@${exportScale}x.${exportFormat}`;
        a.click();
        URL.revokeObjectURL(url);
        addToast(`Exported as ${exportFormat.toUpperCase()} @${exportScale}x`);
      }, mimeType, quality);
    }
  };

  return (
    <div className="pb-4">
      <span className="text-[11px] font-semibold text-white/50 block mb-3">Export</span>
      <div className="flex gap-2 mb-2.5">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-[10px] text-white/40 font-medium">Format</label>
          <select
            className="bg-white/[0.06] text-white/90 text-xs px-2 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none transition-colors"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as "png" | "jpg" | "svg")}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        {exportFormat !== "svg" && (
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] text-white/40 font-medium">Scale</label>
            <select
              className="bg-white/[0.06] text-white/90 text-xs px-2 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none transition-colors"
              value={exportScale}
              onChange={(e) => setExportScale(Number(e.target.value))}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        )}
      </div>
      <button
        className="w-full py-2 text-xs bg-[#0d99ff]/20 text-[#0d99ff] hover:bg-[#0d99ff]/30 rounded-md border border-[#0d99ff]/30 transition-colors font-medium"
        onClick={doExport}
      >
        Export {exportFormat.toUpperCase()}{exportFormat !== "svg" ? ` @${exportScale}x` : ""}
      </button>
    </div>
  );
}

function FillSection({ node }: { node: SceneNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const addFill = () => {
    const newFills: Paint[] = [
      ...node.fills,
      { type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85, a: 1 }, opacity: 1 },
    ];
    updateNode(node.id, { fills: newFills });
    pushHistory("Add fill");
  };

  const switchFillType = (index: number, newType: string) => {
    const newFills = [...node.fills];
    const current = newFills[index];
    if (newType === "SOLID") {
      const color = current.type === "SOLID" ? current.color : { r: 0.85, g: 0.85, b: 0.85, a: 1 };
      newFills[index] = { type: "SOLID", color, opacity: 1 };
    } else if (newType === "LINEAR" || newType === "RADIAL") {
      const startColor = current.type === "SOLID" ? current.color : { r: 0.2, g: 0.5, b: 1, a: 1 };
      newFills[index] = {
        type: newType as "LINEAR" | "RADIAL",
        gradientStops: [
          { position: 0, color: startColor },
          { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
        ],
        gradientTransform: [1, 0, 0, 1, 0, 0],
      };
    }
    updateNode(node.id, { fills: newFills });
    pushHistory("Change fill type");
  };

  const removeFill = (index: number) => {
    const newFills = node.fills.filter((_, i) => i !== index);
    updateNode(node.id, { fills: newFills });
    pushHistory("Remove fill");
  };

  const updateFillColor = (index: number, color: RGBA) => {
    const newFills = [...node.fills];
    if (newFills[index].type === "SOLID") {
      newFills[index] = { ...newFills[index], color, opacity: color.a } as Paint;
    }
    updateNode(node.id, { fills: newFills });
  };

  return (
    <div className="border-b border-white/[0.06] pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-white/50">
          Fill
        </span>
        <button
          className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-md text-sm transition-colors"
          onClick={addFill}
        >
          +
        </button>
      </div>
      {node.fills.map((fill, i) => (
        <div key={i} className="mb-2 relative">
          <div className="flex items-center gap-2 mb-2">
            <select
              className="bg-white/[0.06] text-white/70 text-[10px] px-2 py-1 rounded border border-white/[0.14] outline-none"
              value={fill.type === "SOLID" ? "SOLID" : fill.type === "LINEAR" ? "LINEAR" : fill.type === "RADIAL" ? "RADIAL" : "SOLID"}
              onChange={(e) => switchFillType(i, e.target.value)}
            >
              <option value="SOLID">Solid</option>
              <option value="LINEAR">Linear</option>
              <option value="RADIAL">Radial</option>
            </select>
            <div className="flex-1" />
            <button
              className="text-white/25 hover:text-white/60 text-xs transition-colors"
              onClick={() => removeFill(i)}
            >
              ×
            </button>
          </div>
          {fill.type === "SOLID" && (
            <div className="flex items-center gap-2.5">
              <button
                className="w-7 h-7 rounded-md border border-white/[0.12] cursor-pointer flex-shrink-0 shadow-sm"
                style={{
                  backgroundColor: `rgba(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)}, ${fill.opacity})`,
                }}
                onClick={() => setPickerIndex(pickerIndex === i ? null : i)}
              />
              <label
                className="w-7 h-7 rounded-md border border-white/[0.12] cursor-pointer flex items-center justify-center text-[9px] text-white/55 hover:text-white/80 transition-colors"
                title="Open system color picker"
              >
                OS
                <input
                  type="color"
                  className="sr-only"
                  value={rgbaToHexColor(fill.color)}
                  onChange={(e) => {
                    const rgb = hexToRgb(e.target.value);
                    if (!rgb) return;
                    updateFillColor(i, { ...rgb, a: fill.opacity });
                    pushHistory("Change fill color");
                  }}
                />
              </label>
              <span className="text-[11px] text-white/60 flex-1 font-mono tracking-wide">
                #{Math.round(fill.color.r * 255).toString(16).padStart(2, "0")}
                {Math.round(fill.color.g * 255).toString(16).padStart(2, "0")}
                {Math.round(fill.color.b * 255).toString(16).padStart(2, "0")}
              </span>
              <span className="text-[11px] text-white/35 w-9 text-right">
                {Math.round(fill.opacity * 100)}%
              </span>
              {pickerIndex === i && (
                <div className="absolute left-0 top-14 z-50">
                  <ColorPicker
                    color={fill.color}
                    onChange={(c) => updateFillColor(i, c)}
                    onClose={() => {
                      setPickerIndex(null);
                      pushHistory("Change fill color");
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {(fill.type === "LINEAR" || fill.type === "RADIAL") && "gradientStops" in fill && (
            <div className="flex flex-col gap-1.5">
              <div
                className="w-full h-6 rounded-md border border-white/[0.12]"
                style={{
                  background: `linear-gradient(to right, ${fill.gradientStops.map((s: {position: number; color: RGBA}) => `rgba(${Math.round(s.color.r * 255)}, ${Math.round(s.color.g * 255)}, ${Math.round(s.color.b * 255)}, ${s.color.a}) ${s.position * 100}%`).join(", ")})`,
                }}
              />
              {fill.gradientStops.map((stop: {position: number; color: RGBA}, si: number) => (
                <div key={si} className="flex items-center gap-2">
                  <button
                    className="w-5 h-5 rounded border border-white/[0.12] cursor-pointer flex-shrink-0"
                    style={{
                      backgroundColor: `rgba(${Math.round(stop.color.r * 255)}, ${Math.round(stop.color.g * 255)}, ${Math.round(stop.color.b * 255)}, ${stop.color.a})`,
                    }}
                    onClick={() => setPickerIndex(pickerIndex === i * 100 + si ? null : i * 100 + si)}
                  />
                  <span className="text-[10px] text-white/40">{Math.round(stop.position * 100)}%</span>
                  {pickerIndex === i * 100 + si && (
                    <div className="absolute left-0 top-20 z-50">
                      <ColorPicker
                        color={stop.color}
                        onChange={(c) => {
                          const newFills = [...node.fills];
                          if ("gradientStops" in newFills[i]) {
                            const gf = { ...newFills[i] } as import("../types").GradientPaint;
                            gf.gradientStops = [...gf.gradientStops];
                            gf.gradientStops[si] = { ...gf.gradientStops[si], color: c };
                            newFills[i] = gf;
                            updateNode(node.id, { fills: newFills });
                          }
                        }}
                        onClose={() => {
                          setPickerIndex(null);
                          pushHistory("Change gradient color");
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StrokeSection({ node }: { node: SceneNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const addStroke = () => {
    const newStrokes: Paint[] = [
      ...node.strokes,
      { type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 },
    ];
    updateNode(node.id, { strokes: newStrokes, strokeWeight: node.strokeWeight || 1 });
    pushHistory("Add stroke");
  };

  const removeStroke = (index: number) => {
    const newStrokes = node.strokes.filter((_, i) => i !== index);
    updateNode(node.id, { strokes: newStrokes });
    pushHistory("Remove stroke");
  };

  const updateStrokeColor = (index: number, color: RGBA) => {
    const newStrokes = [...node.strokes];
    if (newStrokes[index].type === "SOLID") {
      newStrokes[index] = { ...newStrokes[index], color, opacity: color.a } as Paint;
    }
    updateNode(node.id, { strokes: newStrokes });
  };

  return (
    <div className="border-b border-white/[0.06] pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-white/50">
          Stroke
        </span>
        <button
          className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-md text-sm transition-colors"
          onClick={addStroke}
        >
          +
        </button>
      </div>
      {node.strokes.map((stroke, i) => (
        <div key={i} className="flex items-center gap-2.5 mb-1.5 relative">
          {stroke.type === "SOLID" && (
            <>
              <button
                className="w-7 h-7 rounded-md border border-white/[0.12] cursor-pointer flex-shrink-0 shadow-sm"
                style={{
                  backgroundColor: `rgba(${Math.round(stroke.color.r * 255)}, ${Math.round(stroke.color.g * 255)}, ${Math.round(stroke.color.b * 255)}, ${stroke.opacity})`,
                }}
                onClick={() => setPickerIndex(pickerIndex === i ? null : i)}
              />
              <label
                className="w-7 h-7 rounded-md border border-white/[0.12] cursor-pointer flex items-center justify-center text-[9px] text-white/55 hover:text-white/80 transition-colors"
                title="Open system color picker"
              >
                OS
                <input
                  type="color"
                  className="sr-only"
                  value={rgbaToHexColor(stroke.color)}
                  onChange={(e) => {
                    const rgb = hexToRgb(e.target.value);
                    if (!rgb) return;
                    updateStrokeColor(i, { ...rgb, a: stroke.opacity });
                    pushHistory("Change stroke color");
                  }}
                />
              </label>
              <span className="text-[11px] text-white/60 flex-1 font-mono tracking-wide">
                #{Math.round(stroke.color.r * 255).toString(16).padStart(2, "0")}
                {Math.round(stroke.color.g * 255).toString(16).padStart(2, "0")}
                {Math.round(stroke.color.b * 255).toString(16).padStart(2, "0")}
              </span>
              <button
                className="text-white/25 hover:text-white/60 text-xs transition-colors"
                onClick={() => removeStroke(i)}
              >
                ×
              </button>
              {pickerIndex === i && (
                <div className="absolute left-0 top-8 z-50">
                  <ColorPicker
                    color={stroke.color}
                    onChange={(c) => updateStrokeColor(i, c)}
                    onClose={() => {
                      setPickerIndex(null);
                      pushHistory("Change stroke color");
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {node.strokes.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <NumberInput
            label="Weight"
            value={node.strokeWeight}
            onChange={(v) => {
              updateNode(node.id, { strokeWeight: v });
              pushHistory("Change stroke weight");
            }}
            min={0}
            step={1}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 font-medium">Align</label>
            <select
              className="bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none transition-colors"
              value={node.strokeAlign}
              onChange={(e) => {
                updateNode(node.id, { strokeAlign: e.target.value as SceneNode["strokeAlign"] });
                pushHistory("Change stroke align");
              }}
            >
              <option value="CENTER">Center</option>
              <option value="INSIDE">Inside</option>
              <option value="OUTSIDE">Outside</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function EffectsSection({ node }: { node: SceneNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const addEffect = () => {
    const newEffect: Effect = {
      type: "DROP_SHADOW",
      visible: true,
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
    };
    updateNode(node.id, { effects: [...node.effects, newEffect] });
    pushHistory("Add effect");
  };

  const removeEffect = (index: number) => {
    const newEffects = node.effects.filter((_, i) => i !== index);
    updateNode(node.id, { effects: newEffects });
    pushHistory("Remove effect");
  };

  const updateEffect = (index: number, updates: Partial<Effect>) => {
    const newEffects = [...node.effects];
    newEffects[index] = { ...newEffects[index], ...updates };
    updateNode(node.id, { effects: newEffects });
  };

  return (
    <div className="border-b border-white/[0.06] pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-white/50">
          Effects
        </span>
        <button
          className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-md text-sm transition-colors"
          onClick={addEffect}
        >
          +
        </button>
      </div>
      {node.effects.map((effect, i) => (
        <div key={i} className="mb-2 bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-1.5">
            <select
              className="bg-white/[0.06] text-white/90 text-xs px-2 py-1 rounded-md border border-white/[0.08] outline-none"
              value={effect.type}
              onChange={(e) => {
                updateEffect(i, { type: e.target.value as Effect["type"] });
                pushHistory("Change effect type");
              }}
            >
              <option value="DROP_SHADOW">Drop Shadow</option>
              <option value="INNER_SHADOW">Inner Shadow</option>
              <option value="LAYER_BLUR">Layer Blur</option>
              <option value="BACKGROUND_BLUR">Background Blur</option>
            </select>
            <div className="flex items-center gap-1.5">
              <button
                className={`text-xs transition-colors ${effect.visible ? "text-white/50 hover:text-white/80" : "text-white/20 hover:text-white/40"}`}
                onClick={() => {
                  updateEffect(i, { visible: !effect.visible });
                }}
              >
                👁
              </button>
              <button
                className="text-white/25 hover:text-white/60 text-xs transition-colors"
                onClick={() => removeEffect(i)}
              >
                ×
              </button>
            </div>
          </div>
          {(effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && (
            <div className="grid grid-cols-3 gap-1 mt-1">
              <NumberInput
                label="X"
                value={effect.offset?.x || 0}
                onChange={(v) => {
                  updateEffect(i, { offset: { x: v, y: effect.offset?.y || 0 } });
                }}
              />
              <NumberInput
                label="Y"
                value={effect.offset?.y || 0}
                onChange={(v) => {
                  updateEffect(i, { offset: { x: effect.offset?.x || 0, y: v } });
                }}
              />
              <NumberInput
                label="Blur"
                value={effect.radius}
                onChange={(v) => {
                  updateEffect(i, { radius: v });
                }}
                min={0}
              />
            </div>
          )}
          {(effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") && (
            <div className="mt-1">
              <NumberInput
                label="Blur"
                value={effect.radius}
                onChange={(v) => {
                  updateEffect(i, { radius: v });
                }}
                min={0}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TextSection({ node }: { node: TextNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const fonts = [
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Raleway", "Nunito", "Playfair Display", "Merriweather",
    "Source Sans Pro", "Ubuntu", "Oswald", "Noto Sans", "PT Sans",
    "Roboto Mono", "Fira Code", "Space Grotesk", "DM Sans", "Work Sans",
  ];

  return (
    <div className="border-b border-white/[0.06] pb-4">
      <span className="text-[11px] font-semibold text-white/50 block mb-3">
        Typography
      </span>

      {/* Font family */}
      <select
        className="w-full bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none mb-2.5 transition-colors"
        value={node.fontFamily}
        onChange={(e) => {
          updateNode(node.id, { fontFamily: e.target.value } as Partial<TextNode>);
          pushHistory("Change font");
        }}
      >
        {fonts.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/40 font-medium">Weight</label>
          <select
            className="bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none transition-colors"
            value={node.fontWeight}
            onChange={(e) => {
              updateNode(node.id, { fontWeight: parseInt(e.target.value) } as Partial<TextNode>);
              pushHistory("Change font weight");
            }}
          >
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <NumberInput
          label="Size"
          value={node.fontSize}
          onChange={(v) => {
            updateNode(node.id, { fontSize: v } as Partial<TextNode>);
            pushHistory("Change font size");
          }}
          min={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <NumberInput
          label="Line Height"
          value={node.lineHeight === "AUTO" ? 0 : node.lineHeight}
          onChange={(v) => {
            updateNode(node.id, { lineHeight: v === 0 ? "AUTO" : v } as Partial<TextNode>);
            pushHistory("Change line height");
          }}
          min={0}
        />
        <NumberInput
          label="Letter Spacing"
          value={node.letterSpacing}
          onChange={(v) => {
            updateNode(node.id, { letterSpacing: v } as Partial<TextNode>);
            pushHistory("Change letter spacing");
          }}
          step={0.1}
        />
      </div>

      {/* Text align */}
      <div className="flex gap-1 mb-2.5">
        {(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"] as const).map((align) => (
          <button
            key={align}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors flex items-center justify-center ${
              node.textAlign === align
                ? "bg-[#0d99ff]/80 text-white"
                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] border border-white/[0.06]"
            }`}
            onClick={() => {
              updateNode(node.id, { textAlign: align } as Partial<TextNode>);
              pushHistory("Change text align");
            }}
            title={`Align ${align.toLowerCase()}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              {align === "LEFT" && <><rect x="1" y="2" width="10" height="1.5" rx="0.5" /><rect x="1" y="6" width="14" height="1.5" rx="0.5" /><rect x="1" y="10" width="8" height="1.5" rx="0.5" /><rect x="1" y="14" width="12" height="1.5" rx="0.5" /></>}
              {align === "CENTER" && <><rect x="3" y="2" width="10" height="1.5" rx="0.5" /><rect x="1" y="6" width="14" height="1.5" rx="0.5" /><rect x="4" y="10" width="8" height="1.5" rx="0.5" /><rect x="2" y="14" width="12" height="1.5" rx="0.5" /></>}
              {align === "RIGHT" && <><rect x="5" y="2" width="10" height="1.5" rx="0.5" /><rect x="1" y="6" width="14" height="1.5" rx="0.5" /><rect x="7" y="10" width="8" height="1.5" rx="0.5" /><rect x="3" y="14" width="12" height="1.5" rx="0.5" /></>}
              {align === "JUSTIFIED" && <><rect x="1" y="2" width="14" height="1.5" rx="0.5" /><rect x="1" y="6" width="14" height="1.5" rx="0.5" /><rect x="1" y="10" width="14" height="1.5" rx="0.5" /><rect x="1" y="14" width="14" height="1.5" rx="0.5" /></>}
            </svg>
          </button>
        ))}
      </div>

      {/* Text decoration */}
      <div className="flex gap-1">
        {(["NONE", "UNDERLINE", "STRIKETHROUGH"] as const).map((dec) => (
          <button
            key={dec}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
              node.textDecoration === dec
                ? "bg-[#0d99ff]/80 text-white"
                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] border border-white/[0.06]"
            }`}
            onClick={() => {
              updateNode(node.id, { textDecoration: dec } as Partial<TextNode>);
              pushHistory("Change text decoration");
            }}
          >
            {dec === "NONE" ? "Aa" : dec === "UNDERLINE" ? "U̲" : "S̶"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const updateNode = useEditorStore((s) => s.updateNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const selectedNodes = Array.from(selectedIds)
    .map((id) => nodes.get(id))
    .filter(Boolean) as SceneNode[];

  if (selectedNodes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-3.5 border-b border-white/[0.06]">
          <span className="text-[13px] font-semibold text-white/60">
            Design
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-white/25">Select an object</span>
        </div>
      </div>
    );
  }

  const node = selectedNodes[0];
  const isMulti = selectedNodes.length > 1;
  const isText = node.type === "TEXT";

  const handleTransformChange = (field: string, value: number) => {
    for (const n of selectedNodes) {
      updateNode(n.id, { [field]: value });
    }
    pushHistory(`Change ${field}`);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-white/60">
          Design
        </span>
        <div className="text-[11px] text-white/40 mt-1">
          {isMulti
            ? `${selectedNodes.length} objects`
            : `${node.type} — ${node.name}`}
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Transform */}
        <div className="border-b border-white/[0.06] pb-4">
          <span className="text-[11px] font-semibold text-white/50 block mb-3">
            Transform
          </span>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={node.x}
              onChange={(v) => handleTransformChange("x", v)}
            />
            <NumberInput
              label="Y"
              value={node.y}
              onChange={(v) => handleTransformChange("y", v)}
            />
            <NumberInput
              label="W"
              value={node.width}
              onChange={(v) => handleTransformChange("width", v)}
              min={1}
            />
            <NumberInput
              label="H"
              value={node.height}
              onChange={(v) => handleTransformChange("height", v)}
              min={1}
            />
            <NumberInput
              label="Rotation"
              value={node.rotation}
              onChange={(v) => handleTransformChange("rotation", v)}
            />
            <CornerRadiusInput node={node} />
          </div>
        </div>

        {/* Opacity & Blend */}
        <div className="border-b border-white/[0.06] pb-4">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Opacity %"
              value={Math.round(node.opacity * 100)}
              onChange={(v) => {
                updateNode(node.id, { opacity: v / 100 });
                pushHistory("Change opacity");
              }}
              min={0}
              max={100}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 font-medium">Blend</label>
              <select
                className="bg-white/[0.06] text-white/90 text-xs px-2.5 py-[7px] rounded-md border border-white/[0.08] focus:border-[#0d99ff]/70 outline-none transition-colors"
                value={node.blendMode}
                onChange={(e) => {
                  updateNode(node.id, { blendMode: e.target.value as SceneNode["blendMode"] });
                  pushHistory("Change blend mode");
                }}
              >
                {[
                  "NORMAL", "MULTIPLY", "SCREEN", "OVERLAY", "DARKEN", "LIGHTEN",
                  "COLOR_DODGE", "COLOR_BURN", "HARD_LIGHT", "SOFT_LIGHT",
                  "DIFFERENCE", "EXCLUSION",
                ].map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fill */}
        <FillSection node={node} />

        {/* Stroke */}
        <StrokeSection node={node} />

        {/* Effects */}
        <EffectsSection node={node} />

        {/* Typography (text nodes only) */}
        {isText && <TextSection node={node as TextNode} />}

        {/* Alignment buttons */}
        <div className="border-b border-white/[0.06] pb-4">
          <span className="text-[11px] font-semibold text-white/50 block mb-3">
            Align{selectedNodes.length > 1 ? "" : " to Canvas"}
          </span>
          <div className="flex gap-1 mb-2">
            {[
              { title: "Align Left", action: () => alignNodes("left"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="1.5" height="14" /><rect x="4" y="3" width="8" height="4" rx="0.5" /><rect x="4" y="9" width="5" height="4" rx="0.5" /></svg> },
              { title: "Align Center H", action: () => alignNodes("centerH"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="7.25" y="1" width="1.5" height="14" /><rect x="3" y="3" width="10" height="4" rx="0.5" /><rect x="4.5" y="9" width="7" height="4" rx="0.5" /></svg> },
              { title: "Align Right", action: () => alignNodes("right"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="13.5" y="1" width="1.5" height="14" /><rect x="4" y="3" width="8" height="4" rx="0.5" /><rect x="7" y="9" width="5" height="4" rx="0.5" /></svg> },
              { title: "Align Top", action: () => alignNodes("top"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="14" height="1.5" /><rect x="3" y="4" width="4" height="8" rx="0.5" /><rect x="9" y="4" width="4" height="5" rx="0.5" /></svg> },
              { title: "Align Center V", action: () => alignNodes("centerV"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="7.25" width="14" height="1.5" /><rect x="3" y="2" width="4" height="12" rx="0.5" /><rect x="9" y="3.5" width="4" height="9" rx="0.5" /></svg> },
              { title: "Align Bottom", action: () => alignNodes("bottom"), icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="13.5" width="14" height="1.5" /><rect x="3" y="4" width="4" height="8" rx="0.5" /><rect x="9" y="7" width="4" height="5" rx="0.5" /></svg> },
            ].map((btn) => (
              <button
                key={btn.title}
                className="flex-1 py-1.5 flex items-center justify-center bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/80 rounded-md border border-white/[0.06] transition-colors"
                title={btn.title}
                onClick={btn.action}
              >
                {btn.icon}
              </button>
            ))}
          </div>
          {selectedNodes.length > 1 && (
            <div className="flex gap-1">
              <button
                className="flex-1 py-1.5 text-[10px] bg-white/[0.06] text-white/50 hover:bg-white/[0.1] rounded-md border border-white/[0.06] transition-colors"
                title="Distribute Horizontal Spacing"
                onClick={() => distributeNodes("horizontal")}
              >
                ⇔ Distribute H
              </button>
              <button
                className="flex-1 py-1.5 text-[10px] bg-white/[0.06] text-white/50 hover:bg-white/[0.1] rounded-md border border-white/[0.06] transition-colors"
                title="Distribute Vertical Spacing"
                onClick={() => distributeNodes("vertical")}
              >
                ⇕ Distribute V
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <ExportSection selectedNodes={selectedNodes} />
      </div>
    </div>
  );

  function alignNodes(direction: string) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of selectedNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }

    for (const n of selectedNodes) {
      switch (direction) {
        case "left":
          updateNode(n.id, { x: minX });
          break;
        case "right":
          updateNode(n.id, { x: maxX - n.width });
          break;
        case "centerH":
          updateNode(n.id, { x: (minX + maxX) / 2 - n.width / 2 });
          break;
        case "top":
          updateNode(n.id, { y: minY });
          break;
        case "bottom":
          updateNode(n.id, { y: maxY - n.height });
          break;
        case "centerV":
          updateNode(n.id, { y: (minY + maxY) / 2 - n.height / 2 });
          break;
      }
    }
    pushHistory(`Align ${direction}`);
  }

  function distributeNodes(direction: "horizontal" | "vertical") {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) =>
      direction === "horizontal" ? a.x - b.x : a.y - b.y
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (direction === "horizontal") {
      const totalSpace = (last.x + last.width) - first.x;
      const totalNodeWidth = sorted.reduce((sum, n) => sum + n.width, 0);
      const gap = (totalSpace - totalNodeWidth) / (sorted.length - 1);
      let currentX = first.x;
      for (const n of sorted) {
        updateNode(n.id, { x: currentX });
        currentX += n.width + gap;
      }
    } else {
      const totalSpace = (last.y + last.height) - first.y;
      const totalNodeHeight = sorted.reduce((sum, n) => sum + n.height, 0);
      const gap = (totalSpace - totalNodeHeight) / (sorted.length - 1);
      let currentY = first.y;
      for (const n of sorted) {
        updateNode(n.id, { y: currentY });
        currentY += n.height + gap;
      }
    }
    pushHistory(`Distribute ${direction}`);
  }
}
