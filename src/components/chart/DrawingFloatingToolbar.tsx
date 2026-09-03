import React from 'react';
import {
  Trash2,
  Lock,
  Unlock,
  Check,
  X
} from 'lucide-react';
import { Drawing, LineStyleType } from '../../lib/drawingTypes';

interface DrawingFloatingToolbarProps {
  drawing: Drawing;
  position: { x: number; y: number };
  onUpdate: (patch: Partial<Drawing>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#a855f7', // Purple
  '#ffffff', // White
  '#94a3b8', // Slate
];

export const DrawingFloatingToolbar: React.FC<DrawingFloatingToolbarProps> = ({
  drawing,
  position,
  onUpdate,
  onDelete,
  onClose,
}) => {
  return (
    <div
      className="absolute z-30 flex items-center gap-1.5 p-1.5 bg-[#0d131f]/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl text-xs font-sans select-none animate-fade-in"
      style={{
        left: `${Math.max(10, Math.min(window.innerWidth - 380, position.x))}px`,
        top: `${Math.max(45, position.y - 45)}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Color Selector */}
      <div className="flex items-center gap-1 px-1 border-r border-slate-800 pr-2">
        {PRESET_COLORS.slice(0, 6).map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onUpdate({ color })}
            className={`w-5 h-5 rounded-full border transition-transform ${
              drawing.color.toLowerCase() === color.toLowerCase()
                ? 'scale-110 border-white shadow'
                : 'border-slate-700 hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        {/* Custom Color Input */}
        <input
          type="color"
          value={drawing.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 ml-0.5"
          title="Custom Color"
        />
      </div>

      {/* 2. Line Width Selector (1px, 2px, 3px, 4px) */}
      <div className="flex items-center gap-1 px-1 border-r border-slate-800 pr-2">
        {([1, 2, 3, 4] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onUpdate({ lineWidth: w })}
            className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono transition-all ${
              drawing.lineWidth === w
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={`${w}px width`}
          >
            {w}px
          </button>
        ))}
      </div>

      {/* 3. Line Style (Solid, Dashed, Dotted) */}
      <div className="flex items-center gap-1 px-1 border-r border-slate-800 pr-2">
        {(['solid', 'dashed', 'dotted'] as LineStyleType[]).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onUpdate({ lineStyle: st })}
            className={`px-1.5 py-0.5 rounded-md text-[10px] uppercase font-mono transition-all ${
              drawing.lineStyle === st
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={st}
          >
            {st === 'solid' ? '──' : st === 'dashed' ? '╌╌' : '··'}
          </button>
        ))}
      </div>

      {/* 4. Lock / Unlock */}
      <button
        type="button"
        onClick={() => onUpdate({ locked: !drawing.locked })}
        className={`p-1.5 rounded-lg transition-all ${
          drawing.locked
            ? 'text-yellow-400 bg-yellow-500/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title={drawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
      >
        {drawing.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>

      {/* 5. Delete Button */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
        title="Delete Drawing"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* 6. Close Selection Button */}
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors ml-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
