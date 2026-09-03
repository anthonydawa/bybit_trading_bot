import React, { useState } from 'react';
import {
  MousePointer,
  TrendingUp,
  Minus,
  MoveRight,
  SplitSquareVertical,
  Square,
  Activity,
  Target,
  Type,
  Ruler,
  Eraser,
  Magnet,
  Trash2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock
} from 'lucide-react';
import { DrawingToolType } from '../../lib/drawingTypes';

interface DrawingToolbarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  isMagnetEnabled: boolean;
  onToggleMagnet: () => void;
  onClearAllDrawings: () => void;
  drawingsCount: number;
  areDrawingsHidden: boolean;
  onToggleHideDrawings: () => void;
  areDrawingsLocked: boolean;
  onToggleLockDrawings: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  isMagnetEnabled,
  onToggleMagnet,
  onClearAllDrawings,
  drawingsCount,
  areDrawingsHidden,
  onToggleHideDrawings,
  areDrawingsLocked,
  onToggleLockDrawings,
}) => {
  const tools = [
    { type: 'cursor' as DrawingToolType, label: 'Crosshair / Pointer', icon: MousePointer, shortcut: 'V' },
    { type: 'trendline' as DrawingToolType, label: 'Trendline (with Angle & %)', icon: TrendingUp, shortcut: 'Alt+T' },
    { type: 'horizontalLine' as DrawingToolType, label: 'Horizontal Line (Support/Resistance)', icon: Minus, shortcut: 'Alt+H' },
    { type: 'horizontalRay' as DrawingToolType, label: 'Horizontal Ray', icon: MoveRight, shortcut: 'Alt+J' },
    { type: 'verticalLine' as DrawingToolType, label: 'Vertical Line (Time)', icon: SplitSquareVertical, shortcut: 'Alt+V' },
    { type: 'rectangle' as DrawingToolType, label: 'Rectangle Box (Supply / Demand Zone)', icon: Square, shortcut: 'Alt+B' },
    { type: 'fibonacci' as DrawingToolType, label: 'Fibonacci Retracement (Golden Ratio)', icon: Activity, shortcut: 'Alt+F' },
    { type: 'riskReward' as DrawingToolType, label: 'Long/Short Position (Risk:Reward Box)', icon: Target, shortcut: 'Alt+R' },
    { type: 'text' as DrawingToolType, label: 'Text Annotation Note', icon: Type, shortcut: 'Alt+N' },
    { type: 'measure' as DrawingToolType, label: 'Measure Ruler (Bars & Delta)', icon: Ruler, shortcut: 'Shift' },
    { type: 'eraser' as DrawingToolType, label: 'Eraser', icon: Eraser, shortcut: 'E' },
  ];

  return (
    <div className="absolute left-2.5 top-12 z-20 flex flex-col items-center bg-[#0d131f]/90 backdrop-blur-md border border-slate-800 rounded-2xl p-1 shadow-2xl space-y-1 select-none font-sans">
      {/* Drawing Tool Buttons */}
      {tools.map((t) => {
        const Icon = t.icon;
        const isActive = activeTool === t.type;

        return (
          <button
            key={t.type}
            type="button"
            onClick={() => onSelectTool(t.type)}
            className={`p-2 rounded-xl transition-all relative group ${
              isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={`${t.label} (${t.shortcut})`}
          >
            <Icon className="w-4 h-4" />
            {/* Tooltip */}
            <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
              {t.label}
              <span className="text-[10px] text-slate-400 ml-1.5 font-mono">[{t.shortcut}]</span>
            </div>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-6 h-px bg-slate-800 my-0.5" />

      {/* Magnet Snap Mode */}
      <button
        type="button"
        onClick={onToggleMagnet}
        className={`p-2 rounded-xl transition-all relative group ${
          isMagnetEnabled
            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-md'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Magnet Mode (Snap to Candle OHLC)"
      >
        <Magnet className="w-4 h-4" />
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
          {isMagnetEnabled ? 'Magnet: Enabled (Snapping to OHLC)' : 'Magnet: Disabled'}
        </div>
      </button>

      {/* Lock/Unlock All Drawings */}
      <button
        type="button"
        onClick={onToggleLockDrawings}
        className={`p-2 rounded-xl transition-all relative group ${
          areDrawingsLocked
            ? 'text-yellow-400 bg-yellow-500/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title={areDrawingsLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}
      >
        {areDrawingsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
          {areDrawingsLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}
        </div>
      </button>

      {/* Hide/Show All Drawings */}
      <button
        type="button"
        onClick={onToggleHideDrawings}
        className={`p-2 rounded-xl transition-all relative group ${
          areDrawingsHidden
            ? 'text-slate-500 bg-slate-800/80'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title={areDrawingsHidden ? 'Show All Drawings' : 'Hide All Drawings'}
      >
        {areDrawingsHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
          {areDrawingsHidden ? 'Show All Drawings' : 'Hide All Drawings'}
        </div>
      </button>

      {/* Clear All Drawings Button */}
      {drawingsCount > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete all ${drawingsCount} chart drawings for this symbol?`)) {
              onClearAllDrawings();
            }
          }}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all relative group"
          title={`Remove All ${drawingsCount} Drawings`}
        >
          <Trash2 className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-rose-300 font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
            Delete All Drawings ({drawingsCount})
          </div>
        </button>
      )}
    </div>
  );
};
