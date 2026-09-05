import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronRight,
  Settings,
  ArrowLeftRight
} from 'lucide-react';
import { ChartCustomizationSettings } from '../../lib/chartSettingsStorage';

interface ChartScaleMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChartCustomizationSettings;
  onUpdateSettings: (patch: Partial<ChartCustomizationSettings>) => void;
  onOpenMoreSettings: () => void;
  position?: { x: number; y: number } | null;
}

export const ChartScaleMenu: React.FC<ChartScaleMenuProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenMoreSettings,
  position,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'labels' | 'lines' | null>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        onUpdateSettings({ invertScale: !settings.invertScale });
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onUpdateSettings({ scaleMode: 'percentage' });
      } else if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        onUpdateSettings({ scaleMode: settings.scaleMode === 'logarithmic' ? 'normal' : 'logarithmic' });
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, onUpdateSettings, settings]);

  if (!isOpen) return null;

  // Compute style coordinates: clamp precisely within viewport bounds
  const menuWidth = 260;
  const menuHeight = 440;
  
  const leftStyle = position
    ? position.x + menuWidth > window.innerWidth - 10
      ? Math.max(10, position.x - menuWidth)
      : Math.min(position.x, window.innerWidth - menuWidth - 10)
    : undefined;

  const topStyle = position
    ? position.y + menuHeight > window.innerHeight - 10
      ? Math.max(10, position.y - menuHeight)
      : Math.max(10, position.y)
    : undefined;

  const menuStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${leftStyle}px`,
        top: `${topStyle}px`,
      }
    : {
        position: 'absolute',
        right: '16px',
        bottom: '36px',
      };

  const flyoutSideClass = (position && position.x < 300) || settings.scalePosition === 'left'
    ? 'left-full ml-1'
    : 'right-full mr-1';

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="z-50 w-64 bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 select-none font-sans animate-fade-in backdrop-blur-md"
    >
      {/* 1. Auto (fits data to screen) */}
      <button
        type="button"
        onClick={() => {
          onUpdateSettings({ autoScale: !settings.autoScale });
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors group text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.autoScale && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span>Auto (fits data to screen)</span>
        </div>
      </button>

      {/* Lock price to bar ratio */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 text-slate-500 opacity-60 cursor-not-allowed">
        <div className="flex items-center gap-2.5">
          <div className="w-4" />
          <span>Lock price to bar ratio</span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">Auto</span>
      </div>

      {/* Scale price chart only */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors cursor-pointer">
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span>Scale price chart only</span>
        </div>
      </div>

      {/* Invert scale (Alt + I) */}
      <button
        type="button"
        onClick={() => {
          onUpdateSettings({ invertScale: !settings.invertScale });
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.invertScale && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span>Invert scale</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Alt + I</span>
      </button>

      {/* Divider */}
      <div className="h-px bg-[#2a2e39] my-1" />

      {/* Scale Modes: Regular, Percent, Indexed to 100, Logarithmic */}
      <button
        type="button"
        onClick={() => onUpdateSettings({ scaleMode: 'normal' })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.scaleMode === 'normal' && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span className={settings.scaleMode === 'normal' ? 'text-white font-medium' : ''}>Regular</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onUpdateSettings({ scaleMode: 'percentage' })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.scaleMode === 'percentage' && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span className={settings.scaleMode === 'percentage' ? 'text-white font-medium' : ''}>Percent</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Alt + P</span>
      </button>

      <button
        type="button"
        onClick={() => onUpdateSettings({ scaleMode: 'indexed' })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.scaleMode === 'indexed' && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span className={settings.scaleMode === 'indexed' ? 'text-white font-medium' : ''}>Indexed to 100</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onUpdateSettings({ scaleMode: 'logarithmic' })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.scaleMode === 'logarithmic' && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span className={settings.scaleMode === 'logarithmic' ? 'text-white font-medium' : ''}>Logarithmic</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Alt + L</span>
      </button>

      {/* Divider */}
      <div className="h-px bg-[#2a2e39] my-1" />

      {/* Move scale to left / right */}
      <button
        type="button"
        onClick={() => onUpdateSettings({ scalePosition: settings.scalePosition === 'right' ? 'left' : 'right' })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            <ArrowLeftRight className="w-3 h-3 text-slate-400" />
          </div>
          <span>{settings.scalePosition === 'right' ? 'Move scale to left' : 'Move scale to right'}</span>
        </div>
      </button>

      {/* Indicator name labels (EMA 50, EMA 200, etc.) */}
      <button
        type="button"
        onClick={() => onUpdateSettings({ showIndicatorNameLabels: !settings.showIndicatorNameLabels })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.showIndicatorNameLabels && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span>Indicator name labels (EMA, etc.)</span>
        </div>
      </button>

      {/* Indicator value labels */}
      <button
        type="button"
        onClick={() => onUpdateSettings({ showIndicatorLabels: !settings.showIndicatorLabels })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.showIndicatorLabels && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span>Indicator value labels</span>
        </div>
      </button>

      {/* Indicator price lines (dotted lines) */}
      <button
        type="button"
        onClick={() => onUpdateSettings({ showIndicatorPriceLines: !settings.showIndicatorPriceLines })}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            {settings.showIndicatorPriceLines && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </div>
          <span>Indicator price lines (dotted)</span>
        </div>
      </button>

      {/* Labels Submenu Flyout */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('labels')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-4" />
            <span>Labels</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {activeSubmenu === 'labels' && (
          <div className={`absolute ${flyoutSideClass} top-0 w-56 bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-fade-in`}>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showLastPriceLabel: !settings.showLastPriceLabel })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showLastPriceLabel && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Symbol Last Value label</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showHighLowLabels: !settings.showHighLowLabels })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showHighLowLabels && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>High and low price labels</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showIndicatorNameLabels: !settings.showIndicatorNameLabels })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showIndicatorNameLabels && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Indicator name labels</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showIndicatorLabels: !settings.showIndicatorLabels })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showIndicatorLabels && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Indicator value labels</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showCountdown: !settings.showCountdown })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showCountdown && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Countdown to bar close</span>
            </button>
          </div>
        )}
      </div>

      {/* Lines Submenu Flyout */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('lines')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-4" />
            <span>Lines</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {activeSubmenu === 'lines' && (
          <div className={`absolute ${flyoutSideClass} top-0 w-56 bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-fade-in`}>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showPriceLine: !settings.showPriceLine })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showPriceLine && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Symbol last price line</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showIndicatorPriceLines: !settings.showIndicatorPriceLines })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showIndicatorPriceLines && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Indicator price lines (dotted)</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showGridVert: !settings.showGridVert })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showGridVert && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Vertical grid lines</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ showGridHorz: !settings.showGridHorz })}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left"
            >
              <div className="w-4 flex items-center justify-center">
                {settings.showGridHorz && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span>Horizontal grid lines</span>
            </button>
          </div>
        )}
      </div>

      {/* Plus button */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#2a2e39] transition-colors cursor-pointer">
        <div className="flex items-center gap-2.5">
          <div className="w-4 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span>Plus button</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#2a2e39] my-1" />

      {/* ⚙ More settings... */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenMoreSettings();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#2a2e39] transition-colors text-left text-blue-300 hover:text-white"
      >
        <div className="w-4 flex items-center justify-center">
          <Settings className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <span className="font-medium">More settings...</span>
      </button>
    </div>
  );
};
