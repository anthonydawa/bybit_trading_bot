import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  Drawing,
  DrawingToolType,
  ChartPoint,
  PixelPoint,
  calculateScreenAngle,
  calculateDistance,
  DEFAULT_FIB_LEVELS,
  isPointNearLine,
  isPointInsideRect,
} from '../../lib/drawingTypes';
import { Candle } from '../../lib/types';
import { DrawingFloatingToolbar } from './DrawingFloatingToolbar';

interface DrawingOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  candles: Candle[];
  drawings: Drawing[];
  onAddDrawing: (drawing: Drawing) => void;
  onUpdateDrawing: (id: string, patch: Partial<Drawing>) => void;
  onDeleteDrawing: (id: string) => void;
  activeTool: DrawingToolType;
  onResetTool: () => void;
  isMagnetEnabled: boolean;
  areDrawingsHidden: boolean;
  areDrawingsLocked: boolean;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  chart,
  series,
  candles,
  drawings,
  onAddDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  activeTool,
  onResetTool,
  isMagnetEnabled,
  areDrawingsHidden,
  areDrawingsLocked,
}) => {
  const containerRef = useRef<SVGSVGElement>(null);

  // Drawing creation state
  const [inProgressPoints, setInProgressPoints] = useState<ChartPoint[]>([]);
  const [cursorPos, setCursorPos] = useState<PixelPoint | null>(null);
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const [currentDelta, setCurrentDelta] = useState<{ price: number; percent: number; bars: number } | null>(null);

  // Selection & dragging state
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<PixelPoint | null>(null);

  // Trigger re-render on chart pan, zoom, or tick
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => (t + 1) % 100000), []);

  useEffect(() => {
    if (!chart) return;
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(forceUpdate);
    timeScale.subscribeVisibleLogicalRangeChange(forceUpdate);

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(forceUpdate);
      timeScale.unsubscribeVisibleLogicalRangeChange(forceUpdate);
    };
  }, [chart, forceUpdate]);

  // Coordinate conversion helpers
  const pointToPixel = useCallback(
    (pt: ChartPoint): PixelPoint | null => {
      if (!chart || !series) return null;
      try {
        const x = chart.timeScale().timeToCoordinate(pt.time as any);
        const y = series.priceToCoordinate(pt.price);
        if (x === null || y === null) return null;
        return { x, y };
      } catch (e) {
        return null;
      }
    },
    [chart, series]
  );

  const pixelToPoint = useCallback(
    (px: PixelPoint): ChartPoint | null => {
      if (!chart || !series) return null;
      try {
        const time = chart.timeScale().coordinateToTime(px.x) as number;
        const price = series.coordinateToPrice(px.y);
        if (time === null || price === null || isNaN(time) || isNaN(price)) return null;

        // Magnet Snap to nearest candle OHLC
        if (isMagnetEnabled && candles.length > 0) {
          const nearestCandle = candles.reduce((prev, curr) =>
            Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
          );
          if (nearestCandle) {
            const ohlc = [nearestCandle.open, nearestCandle.high, nearestCandle.low, nearestCandle.close];
            const snappedPrice = ohlc.reduce((prev, curr) =>
              Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
            );
            return { time: nearestCandle.time, price: snappedPrice };
          }
        }

        return { time, price };
      } catch (e) {
        return null;
      }
    },
    [chart, series, isMagnetEnabled, candles]
  );

  // Pointer position helper relative to SVG canvas
  const getPointerPos = (e: React.PointerEvent<SVGSVGElement>): PixelPoint => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Pointer Events: Down, Move, Up
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (areDrawingsHidden) return;
    const pos = getPointerPos(e);
    const pt = pixelToPoint(pos);
    if (!pt) return;

    // 1. Eraser Mode: Click to delete drawing
    if (activeTool === 'eraser') {
      for (const d of drawings) {
        if (d.locked) continue;
        const pixels = d.points.map(pointToPixel).filter(Boolean) as PixelPoint[];
        if (pixels.length >= 2 && isPointNearLine(pos, pixels[0], pixels[1], 10)) {
          onDeleteDrawing(d.id);
          return;
        }
      }
      return;
    }

    // 2. If a Drawing Tool is active:
    if (activeTool !== 'cursor') {
      // Single-click tools (Horizontal line, Vertical line)
      if (activeTool === 'horizontalLine') {
        onAddDrawing({
          id: `draw-${Date.now()}`,
          type: 'horizontalLine',
          points: [pt],
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: 'solid',
          createdAt: Date.now(),
        });
        onResetTool();
        return;
      }

      if (activeTool === 'verticalLine') {
        onAddDrawing({
          id: `draw-${Date.now()}`,
          type: 'verticalLine',
          points: [pt],
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: 'dashed',
          createdAt: Date.now(),
        });
        onResetTool();
        return;
      }

      // Two-click tools (Trendline, Rectangle, Fib, RiskReward, Measure, Text)
      if (inProgressPoints.length === 0) {
        setInProgressPoints([pt]);
      } else {
        const p1 = inProgressPoints[0];
        const p2 = pt;

        if (activeTool === 'trendline') {
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'trendline',
            points: [p1, p2],
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 'solid',
            showAngle: true,
            createdAt: Date.now(),
          });
        } else if (activeTool === 'horizontalRay') {
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'horizontalRay',
            points: [p1, p2],
            color: '#06b6d4',
            lineWidth: 2,
            lineStyle: 'solid',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'rectangle') {
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'rectangle',
            points: [p1, p2],
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            lineWidth: 1,
            lineStyle: 'solid',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'fibonacci') {
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'fibonacci',
            points: [p1, p2],
            color: '#a855f7',
            lineWidth: 1,
            lineStyle: 'solid',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'riskReward') {
          const isLong = p2.price > p1.price;
          const stopPrice = isLong ? p1.price - Math.abs(p2.price - p1.price) * 0.5 : p1.price + Math.abs(p2.price - p1.price) * 0.5;
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'riskReward',
            positionSide: isLong ? 'long' : 'short',
            entryPrice: p1.price,
            targetPrice: p2.price,
            stopPrice,
            riskRewardRatio: 2.0,
            points: [p1, p2, { time: p2.time, price: stopPrice }],
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 'solid',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'measure') {
          onAddDrawing({
            id: `draw-${Date.now()}`,
            type: 'measure',
            points: [p1, p2],
            color: '#38bdf8',
            lineWidth: 1,
            lineStyle: 'dashed',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'text') {
          const userText = window.prompt('Enter chart note text:', 'Key Level / Breakout');
          if (userText) {
            onAddDrawing({
              id: `draw-${Date.now()}`,
              type: 'text',
              text: userText,
              points: [pt],
              color: '#facc15',
              lineWidth: 1,
              lineStyle: 'solid',
              createdAt: Date.now(),
            });
          }
        }

        setInProgressPoints([]);
        onResetTool();
      }
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pos = getPointerPos(e);
    setCursorPos(pos);

    // Update in-progress live preview angle & delta
    if (inProgressPoints.length > 0) {
      const p1Pixel = pointToPixel(inProgressPoints[0]);
      if (p1Pixel) {
        const angle = calculateScreenAngle(p1Pixel, pos);
        setCurrentAngle(angle);

        const p2Point = pixelToPoint(pos);
        if (p2Point) {
          const priceDiff = p2Point.price - inProgressPoints[0].price;
          const percentDiff = inProgressPoints[0].price > 0 ? (priceDiff / inProgressPoints[0].price) * 100 : 0;
          setCurrentDelta({
            price: Number(priceDiff.toFixed(2)),
            percent: Number(percentDiff.toFixed(2)),
            bars: Math.abs(Math.round((p2Point.time - inProgressPoints[0].time) / 900)),
          });
        }
      }
    }

    // Handle Dragging an individual Control Point
    if (selectedDrawingId && draggedPointIndex !== null) {
      const pt = pixelToPoint(pos);
      if (pt) {
        const sel = drawings.find((d) => d.id === selectedDrawingId);
        if (sel) {
          const newPoints = [...sel.points];
          newPoints[draggedPointIndex] = pt;
          onUpdateDrawing(selectedDrawingId, { points: newPoints });
        }
      }
    }
  };

  const handlePointerUp = () => {
    setDraggedPointIndex(null);
    setIsDraggingShape(false);
    setDragStartPos(null);
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const selectedPixels = selectedDrawing ? (selectedDrawing.points.map(pointToPixel).filter(Boolean) as PixelPoint[]) : [];

  const isDrawingToolActive = activeTool !== 'cursor';

  return (
    <svg
      ref={containerRef}
      className={`absolute inset-0 w-full h-full z-10 select-none ${
        isDrawingToolActive
          ? activeTool === 'eraser'
            ? 'cursor-not-allowed pointer-events-auto'
            : 'cursor-crosshair pointer-events-auto'
          : 'pointer-events-none'
      }`}
      onPointerDown={isDrawingToolActive ? handlePointerDown : undefined}
      onPointerMove={isDrawingToolActive || draggedPointIndex !== null ? handlePointerMove : undefined}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setCursorPos(null);
        setCurrentAngle(null);
      }}
    >
      {/* RENDER ALL SAVED DRAWINGS */}
      {!areDrawingsHidden &&
        drawings.map((drawing) => {
          const pixels = drawing.points.map(pointToPixel).filter(Boolean) as PixelPoint[];
          if (pixels.length === 0) return null;

          const isSelected = selectedDrawingId === drawing.id;
          const strokeDash =
            drawing.lineStyle === 'dashed' ? '6,4' : drawing.lineStyle === 'dotted' ? '2,3' : undefined;

          // 1. Trendline
          if (drawing.type === 'trendline' && pixels.length >= 2) {
            const angle = calculateScreenAngle(pixels[0], pixels[1]);
            const midX = (pixels[0].x + pixels[1].x) / 2;
            const midY = (pixels[0].y + pixels[1].y) / 2;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                {/* Hit test wider transparent stroke */}
                <line
                  x1={pixels[0].x}
                  y1={pixels[0].y}
                  x2={pixels[1].x}
                  y2={pixels[1].y}
                  stroke="transparent"
                  strokeWidth={14}
                />
                {/* Visual Line */}
                <line
                  x1={pixels[0].x}
                  y1={pixels[0].y}
                  x2={pixels[1].x}
                  y2={pixels[1].y}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
                {/* Angle & Info Badge */}
                {isSelected && (
                  <g transform={`translate(${midX}, ${midY - 12})`}>
                    <rect x="-35" y="-10" width="70" height="20" rx="6" fill="#0d131f" stroke="#334155" strokeWidth="1" />
                    <text x="0" y="3" fill="#cbd5e1" fontSize="10" fontFamily="monospace" textAnchor="middle">
                      {angle}°
                    </text>
                  </g>
                )}
              </g>
            );
          }

          // 2. Horizontal Line (Support / Resistance Across Full Chart)
          if (drawing.type === 'horizontalLine' && pixels.length >= 1) {
            const priceStr = drawing.points[0].price.toFixed(2);
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                {/* Hit test wider area */}
                <line
                  x1={0}
                  y1={pixels[0].y}
                  x2="100%"
                  y2={pixels[0].y}
                  stroke="transparent"
                  strokeWidth={14}
                />
                {/* Visual line */}
                <line
                  x1={0}
                  y1={pixels[0].y}
                  x2="100%"
                  y2={pixels[0].y}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
                {/* Price scale badge */}
                <g transform={`translate(${pixels[0].x + 10}, ${pixels[0].y - 10})`}>
                  <rect x="0" y="0" width="65" height="18" rx="4" fill="#0d131f" stroke={drawing.color} strokeWidth="1" />
                  <text x="32" y="12" fill={drawing.color} fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    ${priceStr}
                  </text>
                </g>
              </g>
            );
          }

          // 3. Horizontal Ray
          if (drawing.type === 'horizontalRay' && pixels.length >= 1) {
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                <line
                  x1={pixels[0].x}
                  y1={pixels[0].y}
                  x2="100%"
                  y2={pixels[0].y}
                  stroke="transparent"
                  strokeWidth={14}
                />
                <line
                  x1={pixels[0].x}
                  y1={pixels[0].y}
                  x2="100%"
                  y2={pixels[0].y}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
              </g>
            );
          }

          // 4. Vertical Line
          if (drawing.type === 'verticalLine' && pixels.length >= 1) {
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                <line
                  x1={pixels[0].x}
                  y1={0}
                  x2={pixels[0].x}
                  y2="100%"
                  stroke="transparent"
                  strokeWidth={14}
                />
                <line
                  x1={pixels[0].x}
                  y1={0}
                  x2={pixels[0].x}
                  y2="100%"
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
              </g>
            );
          }

          // 5. Rectangle Box (Supply / Demand Order Block)
          if (drawing.type === 'rectangle' && pixels.length >= 2) {
            const minX = Math.min(pixels[0].x, pixels[1].x);
            const minY = Math.min(pixels[0].y, pixels[1].y);
            const width = Math.abs(pixels[1].x - pixels[0].x);
            const height = Math.abs(pixels[1].y - pixels[0].y);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                <rect
                  x={minX}
                  y={minY}
                  width={width}
                  height={height}
                  fill={drawing.color}
                  fillOpacity={0.15}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                  rx={4}
                />
              </g>
            );
          }

          // 6. Fibonacci Retracement
          if (drawing.type === 'fibonacci' && pixels.length >= 2) {
            const highY = Math.min(pixels[0].y, pixels[1].y);
            const lowY = Math.max(pixels[0].y, pixels[1].y);
            const diffY = lowY - highY;
            const minX = Math.min(pixels[0].x, pixels[1].x);
            const maxX = Math.max(pixels[0].x, pixels[1].x);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                {DEFAULT_FIB_LEVELS.map((fib) => {
                  const levelY = highY + diffY * fib.level;
                  return (
                    <g key={`fib-${fib.level}`}>
                      <line
                        x1={minX}
                        y1={levelY}
                        x2={maxX}
                        y2={levelY}
                        stroke={fib.color}
                        strokeWidth={1}
                        strokeDasharray={fib.level === 0.618 ? undefined : '3,3'}
                      />
                      <text x={minX + 4} y={levelY - 3} fill={fib.color} fontSize="9" fontFamily="monospace" fontWeight="bold">
                        {fib.level} ({fib.level === 0.618 ? 'Golden Ratio' : ''})
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }

          // 7. Long / Short Risk:Reward Box
          if (drawing.type === 'riskReward' && pixels.length >= 2) {
            const p1 = pixels[0]; // Entry
            const p2 = pixels[1]; // Target
            const minX = Math.min(p1.x, p2.x);
            const width = Math.max(80, Math.abs(p2.x - p1.x));
            const isLong = p2.y < p1.y;

            const targetHeight = Math.abs(p2.y - p1.y);
            const stopHeight = targetHeight * 0.5;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                {/* Target Profit Zone (Green) */}
                <rect
                  x={minX}
                  y={isLong ? p2.y : p1.y}
                  width={width}
                  height={targetHeight}
                  fill="#10b981"
                  fillOpacity={0.2}
                  stroke="#10b981"
                  strokeWidth={1}
                />
                {/* Stop Loss Zone (Red) */}
                <rect
                  x={minX}
                  y={isLong ? p1.y : p1.y}
                  width={width}
                  height={stopHeight}
                  fill="#ef4444"
                  fillOpacity={0.2}
                  stroke="#ef4444"
                  strokeWidth={1}
                />
                {/* Entry Center Line */}
                <line x1={minX} y1={p1.y} x2={minX + width} y2={p1.y} stroke="#94a3b8" strokeWidth={2} />
                {/* Central R:R Badge */}
                <g transform={`translate(${minX + width / 2 - 35}, ${p1.y - 11})`}>
                  <rect x="0" y="0" width="70" height="22" rx="6" fill="#0d131f" stroke="#10b981" strokeWidth="1" />
                  <text x="35" y="14" fill="#10b981" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    R:R 2.00
                  </text>
                </g>
              </g>
            );
          }

          // 8. Text Note
          if (drawing.type === 'text' && pixels.length >= 1) {
            const noteText = (drawing as any).text || 'Note';
            return (
              <g
                key={drawing.id}
                transform={`translate(${pixels[0].x}, ${pixels[0].y})`}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                <rect x="0" y="-18" width={noteText.length * 8 + 16} height="24" rx="6" fill="#0d131f" stroke={drawing.color} strokeWidth="1" />
                <text x="8" y="-2" fill={drawing.color} fontSize="11" fontFamily="sans-serif" fontWeight="bold">
                  {noteText}
                </text>
              </g>
            );
          }

          // 9. Measure Ruler
          if (drawing.type === 'measure' && pixels.length >= 2) {
            const minX = Math.min(pixels[0].x, pixels[1].x);
            const minY = Math.min(pixels[0].y, pixels[1].y);
            const width = Math.abs(pixels[1].x - pixels[0].x);
            const height = Math.abs(pixels[1].y - pixels[0].y);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteDrawing(drawing.id);
                  } else if (activeTool === 'cursor' && !areDrawingsLocked) {
                    setSelectedDrawingId(drawing.id);
                  }
                }}
              >
                <rect x={minX} y={minY} width={width} height={height} fill="#38bdf8" fillOpacity={0.15} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3,3" />
                <g transform={`translate(${minX + width / 2 - 45}, ${minY + height / 2 - 12})`}>
                  <rect x="0" y="0" width="90" height="24" rx="6" fill="#0d131f" stroke="#38bdf8" strokeWidth="1" />
                  <text x="45" y="15" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    Δ Range Box
                  </text>
                </g>
              </g>
            );
          }

          return null;
        })}

      {/* RENDER IN-PROGRESS LIVE DRAWING PREVIEW */}
      {inProgressPoints.length > 0 && cursorPos && (
        <g>
          {(() => {
            const p1 = pointToPixel(inProgressPoints[0]);
            if (!p1) return null;

            if (activeTool === 'trendline' || activeTool === 'horizontalRay' || activeTool === 'measure') {
              return (
                <g>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                  {/* Floating Live Angle & Delta Tooltip */}
                  <g transform={`translate(${cursorPos.x + 15}, ${cursorPos.y - 15})`}>
                    <rect x="0" y="0" width="115" height="36" rx="8" fill="#0d131f" stroke="#3b82f6" strokeWidth="1" />
                    <text x="8" y="14" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      Angle: {currentAngle ?? 0}°
                    </text>
                    <text x="8" y="28" fill="#cbd5e1" fontSize="9" fontFamily="monospace">
                      Δ {currentDelta?.percent ?? 0}% ({currentDelta?.bars ?? 0} bars)
                    </text>
                  </g>
                </g>
              );
            }

            if (activeTool === 'rectangle') {
              const minX = Math.min(p1.x, cursorPos.x);
              const minY = Math.min(p1.y, cursorPos.y);
              const width = Math.abs(cursorPos.x - p1.x);
              const height = Math.abs(cursorPos.y - p1.y);

              return (
                <rect
                  x={minX}
                  y={minY}
                  width={width}
                  height={height}
                  fill="#3b82f6"
                  fillOpacity={0.15}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              );
            }

            return null;
          })()}
        </g>
      )}

      {/* SELECTION CONTROL HANDLES FOR ACTIVE DRAWING */}
      {selectedDrawing &&
        !areDrawingsLocked &&
        selectedPixels.map((pt, idx) => (
          <circle
            key={`handle-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r={6}
            fill="#ffffff"
            stroke="#3b82f6"
            strokeWidth={2}
            className="pointer-events-auto cursor-move hover:scale-125 transition-transform"
            onPointerDown={(e) => {
              e.stopPropagation();
              setDraggedPointIndex(idx);
            }}
          />
        ))}

      {/* FLOATING ACTION TOOLBAR FOR SELECTED DRAWING */}
      {selectedDrawing && selectedPixels.length > 0 && (
        <foreignObject
          x={0}
          y={0}
          width="100%"
          height="100%"
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <DrawingFloatingToolbar
              drawing={selectedDrawing}
              position={{
                x: selectedPixels[0].x,
                y: selectedPixels[0].y,
              }}
              onUpdate={(patch) => onUpdateDrawing(selectedDrawing.id, patch)}
              onDelete={() => {
                onDeleteDrawing(selectedDrawing.id);
                setSelectedDrawingId(null);
              }}
              onClose={() => setSelectedDrawingId(null)}
            />
          </div>
        </foreignObject>
      )}
    </svg>
  );
};
