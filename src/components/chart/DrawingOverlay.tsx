import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  Drawing,
  DrawingToolType,
  ChartPoint,
  PixelPoint,
  TrendlineDrawing,
  calculateScreenAngle,
  calculateDistance,
  DEFAULT_FIB_LEVELS,
  isPointNearLine,
  isPointInsideRect,
} from '../../lib/drawingTypes';
import { Candle } from '../../lib/types';
import { DrawingFloatingToolbar } from './DrawingFloatingToolbar';
import { formatMarketPrice } from '../../lib/marketUtils';

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
  const [dragInitialPoints, setDragInitialPoints] = useState<ChartPoint[]>([]);

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

  // Coordinate conversion helpers with robust multi-timeframe continuous logical interpolation
  const pointToPixel = useCallback(
    (pt: ChartPoint): PixelPoint | null => {
      if (!chart || !series || !pt || isNaN(pt.time) || isNaN(pt.price)) return null;
      try {
        const n = candles.length;
        if (n === 0) return null;

        let x: number | null = null;
        const timeScale = chart.timeScale();

        if (n === 1) {
          x = timeScale.timeToCoordinate(candles[0].time as any);
        } else {
          const firstTime = candles[0].time;
          const lastTime = candles[n - 1].time;

          if (pt.time >= firstTime && pt.time <= lastTime) {
            // Binary search to find idx where candles[idx].time <= pt.time <= candles[idx + 1].time
            let low = 0;
            let high = n - 1;
            while (low <= high) {
              const mid = (low + high) >> 1;
              if (candles[mid].time <= pt.time) {
                low = mid + 1;
              } else {
                high = mid - 1;
              }
            }
            const idx = Math.max(0, Math.min(n - 2, high));
            const tA = candles[idx].time;
            const tB = candles[idx + 1].time;
            const dt = tB - tA;
            const fraction = dt > 0 ? (pt.time - tA) / dt : 0;
            const logical = idx + fraction;
            x = timeScale.logicalToCoordinate(logical as any);
          } else if (pt.time > lastTime) {
            // Future whitespace beyond the last candle
            const prevTime = candles[Math.max(0, n - 2)].time;
            const dt = Math.max(1, lastTime - prevTime);
            const logicalDiff = (pt.time - lastTime) / dt;
            const logical = (n - 1) + logicalDiff;
            x = timeScale.logicalToCoordinate(logical as any);
          } else {
            // Past whitespace before the first loaded candle
            const nextTime = candles[Math.min(n - 1, 1)].time;
            const dt = Math.max(1, nextTime - firstTime);
            const logicalDiff = (pt.time - firstTime) / dt;
            const logical = logicalDiff;
            x = timeScale.logicalToCoordinate(logical as any);
          }
        }

        const y = series.priceToCoordinate(pt.price);
        if (x === null || y === null || isNaN(x) || isNaN(y)) return null;
        return { x, y };
      } catch (e) {
        return null;
      }
    },
    [chart, series, candles]
  );

  const pixelToPoint = useCallback(
    (px: PixelPoint): ChartPoint | null => {
      if (!chart || !series) return null;
      try {
        const n = candles.length;
        if (n === 0) return null;

        let time: number | null = null;
        const timeScale = chart.timeScale();
        const logical = timeScale.coordinateToLogical(px.x);

        if (logical !== null && !isNaN(logical)) {
          if (logical >= 0 && logical < n - 1) {
            const idx = Math.floor(logical);
            const fraction = logical - idx;
            const tA = candles[idx].time;
            const tB = candles[idx + 1].time;
            time = Math.round(tA + fraction * (tB - tA));
          } else if (logical >= n - 1) {
            const lastCandle = candles[n - 1];
            const prevCandle = candles[Math.max(0, n - 2)];
            const dt = Math.max(1, lastCandle.time - prevCandle.time);
            time = Math.round(lastCandle.time + (logical - (n - 1)) * dt);
          } else {
            const firstCandle = candles[0];
            const nextCandle = candles[Math.min(n - 1, 1)];
            const dt = Math.max(1, nextCandle.time - firstCandle.time);
            time = Math.round(firstCandle.time + logical * dt);
          }
        } else {
          time = timeScale.coordinateToTime(px.x) as number | null;
        }

        const price = series.coordinateToPrice(px.y);
        if (time === null || price === null || isNaN(time) || isNaN(price)) return null;

        // Magnet Snap to nearest candle OHLC if enabled
        if (isMagnetEnabled && candles.length > 0) {
          const nearestCandle = candles.reduce((prev, curr) =>
            Math.abs(curr.time - time!) < Math.abs(prev.time - time!) ? curr : prev
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

  // Pointer Events: Down on SVG Canvas (creating new drawings)
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
        const newId = `draw-${Date.now()}`;
        onAddDrawing({
          id: newId,
          type: 'horizontalLine',
          points: [pt],
          color: '#3b82f6',
          lineWidth: 1,
          lineStyle: 'solid',
          createdAt: Date.now(),
        });
        setSelectedDrawingId(newId);
        onResetTool();
        return;
      }

      if (activeTool === 'verticalLine') {
        const newId = `draw-${Date.now()}`;
        onAddDrawing({
          id: newId,
          type: 'verticalLine',
          points: [pt],
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: 'dashed',
          createdAt: Date.now(),
        });
        setSelectedDrawingId(newId);
        onResetTool();
        return;
      }

      // Two-click tools (Trendline, Rectangle, Fib, RiskReward, Measure, Text)
      if (inProgressPoints.length === 0) {
        setInProgressPoints([pt]);
      } else {
        const p1 = inProgressPoints[0];
        const p2 = pt;
        const newId = `draw-${Date.now()}`;

        if (activeTool === 'trendline') {
          onAddDrawing({
            id: newId,
            type: 'trendline',
            points: [p1, p2],
            color: '#3b82f6',
            lineWidth: 1,
            lineStyle: 'solid',
            showAngle: true,
            extendLeft: false,
            extendRight: false,
            createdAt: Date.now(),
          });
        } else if (activeTool === 'horizontalRay') {
          onAddDrawing({
            id: newId,
            type: 'horizontalRay',
            points: [p1, p2],
            color: '#06b6d4',
            lineWidth: 1,
            lineStyle: 'solid',
            createdAt: Date.now(),
          });
        } else if (activeTool === 'rectangle') {
          onAddDrawing({
            id: newId,
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
            id: newId,
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
            id: newId,
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
            id: newId,
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
              id: newId,
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

        setSelectedDrawingId(newId);
        setInProgressPoints([]);
        onResetTool();
      }
      return;
    }
  };

  // Persistent refs for smooth dragging without listener re-attachment
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

  const selectedDrawingIdRef = useRef(selectedDrawingId);
  selectedDrawingIdRef.current = selectedDrawingId;

  const draggedPointIndexRef = useRef(draggedPointIndex);
  draggedPointIndexRef.current = draggedPointIndex;

  const isDraggingShapeRef = useRef(isDraggingShape);
  isDraggingShapeRef.current = isDraggingShape;

  const dragStartPosRef = useRef(dragStartPos);
  dragStartPosRef.current = dragStartPos;

  const dragInitialPointsRef = useRef(dragInitialPoints);
  dragInitialPointsRef.current = dragInitialPoints;

  // Pointer Down on an existing drawing shape
  const handleDrawingPointerDown = (e: React.PointerEvent, drawing: Drawing) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onDeleteDrawing(drawing.id);
      return;
    }
    if (activeTool === 'cursor') {
      setSelectedDrawingId(drawing.id);
      selectedDrawingIdRef.current = drawing.id;
      if (!drawing.locked && !areDrawingsLocked && draggedPointIndexRef.current === null) {
        setIsDraggingShape(true);
        isDraggingShapeRef.current = true;
        const pos = getPointerPos(e as any);
        setDragStartPos(pos);
        dragStartPosRef.current = pos;
        setDragInitialPoints([...drawing.points]);
        dragInitialPointsRef.current = [...drawing.points];
      }
    }
  };

  // Pointer Move on SVG canvas (live preview during drawing)
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pos = getPointerPos(e);
    setCursorPos(pos);

    if (inProgressPoints.length > 0) {
      const p1Pixel = pointToPixel(inProgressPoints[0]);
      if (p1Pixel) {
        const angle = calculateScreenAngle(p1Pixel, pos);
        setCurrentAngle(angle);

        const p2Point = pixelToPoint(pos);
        if (p2Point && chart) {
          const priceDiff = p2Point.price - inProgressPoints[0].price;
          const percentDiff = inProgressPoints[0].price > 0 ? (priceDiff / inProgressPoints[0].price) * 100 : 0;
          const l1 = chart.timeScale().coordinateToLogical(p1Pixel.x) ?? 0;
          const l2 = chart.timeScale().coordinateToLogical(pos.x) ?? 0;
          setCurrentDelta({
            price: Number(priceDiff.toFixed(2)),
            percent: Number(percentDiff.toFixed(2)),
            bars: Math.abs(Math.round(l2 - l1)),
          });
        }
      }
    }
  };

  const handlePointerUp = () => {
    setIsDraggingShape(false);
    isDraggingShapeRef.current = false;
    setDraggedPointIndex(null);
    draggedPointIndexRef.current = null;
    setDragStartPos(null);
    dragStartPosRef.current = null;
    setDragInitialPoints([]);
    dragInitialPointsRef.current = [];
  };

  // Window-level listeners for dragging shape or individual handles smoothly without tear-down
  useEffect(() => {
    let rafId: number | null = null;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!isDraggingShapeRef.current && draggedPointIndexRef.current === null) return;
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos: PixelPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const selId = selectedDrawingIdRef.current;
        if (!selId) return;
        const currentDrawings = drawingsRef.current;
        const sel = currentDrawings.find((d) => d.id === selId);
        if (!sel || sel.locked) return;

        const ptIdx = draggedPointIndexRef.current;
        if (ptIdx !== null) {
          if (sel.type === 'horizontalLine') {
            const newPrice = series?.coordinateToPrice(pos.y);
            if (newPrice !== null && newPrice !== undefined && !isNaN(newPrice)) {
              onUpdateDrawing(selId, {
                points: [{ ...sel.points[0], price: newPrice }],
              });
            }
          } else {
            const pt = pixelToPoint(pos);
            if (pt) {
              const newPoints = [...sel.points];
              newPoints[ptIdx] = pt;
              onUpdateDrawing(selId, { points: newPoints });
            }
          }
        } else if (isDraggingShapeRef.current && dragStartPosRef.current && dragInitialPointsRef.current.length > 0) {
          if (sel.type === 'horizontalLine') {
            const currentPrice = series?.coordinateToPrice(pos.y);
            if (currentPrice !== null && currentPrice !== undefined && !isNaN(currentPrice)) {
              onUpdateDrawing(selId, {
                points: [{ ...dragInitialPointsRef.current[0], price: currentPrice }],
              });
            }
          } else {
            const startPoint = pixelToPoint(dragStartPosRef.current);
            const currentPoint = pixelToPoint(pos);
            if (startPoint && currentPoint) {
              const timeDiff = currentPoint.time - startPoint.time;
              const priceDiff = currentPoint.price - startPoint.price;
              const newPoints = dragInitialPointsRef.current.map((p) => ({
                time: p.time + timeDiff,
                price: p.price + priceDiff,
              }));
              onUpdateDrawing(selId, { points: newPoints });
            }
          }
        }
      });
    };

    const handleWindowPointerUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (isDraggingShapeRef.current || draggedPointIndexRef.current !== null) {
        setIsDraggingShape(false);
        isDraggingShapeRef.current = false;
        setDraggedPointIndex(null);
        draggedPointIndexRef.current = null;
        setDragStartPos(null);
        dragStartPosRef.current = null;
        setDragInitialPoints([]);
        dragInitialPointsRef.current = [];
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [pixelToPoint, onUpdateDrawing, series]);

  // Keyboard Shortcuts: Delete/Backspace to delete selected drawing, Escape to deselect/cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDrawingId(null);
        setInProgressPoints([]);
        onResetTool();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        onDeleteDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDrawingId, onDeleteDrawing, onResetTool]);

  // Deselect when clicking empty space on chart canvas
  useEffect(() => {
    if (!chart) return;
    const handleChartClick = () => {
      if (activeTool === 'cursor') {
        setSelectedDrawingId(null);
      }
    };
    chart.subscribeClick(handleChartClick);
    return () => {
      chart.unsubscribeClick(handleChartClick);
    };
  }, [chart, activeTool]);

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const selectedPixels = selectedDrawing ? (selectedDrawing.points.map(pointToPixel).filter(Boolean) as PixelPoint[]) : [];

  // Floating toolbar anchor position helper
  const getToolbarPos = (): { x: number; y: number } | null => {
    if (!selectedDrawing) return null;
    if (selectedDrawing.type === 'horizontalLine') {
      const y = series ? series.priceToCoordinate(selectedDrawing.points[0]?.price) : null;
      if (y === null || isNaN(y)) return null;
      const x = containerRef.current ? Math.min(containerRef.current.clientWidth - 480, 240) : 240;
      return { x: Math.max(20, x), y: Math.max(50, y) };
    }
    if (selectedPixels.length > 0) {
      const p1 = selectedPixels[0];
      const p2 = selectedPixels[1] || p1;
      return {
        x: (p1.x + p2.x) / 2,
        y: Math.min(p1.y, p2.y),
      };
    }
    return null;
  };
  const toolbarPos = getToolbarPos();

  const isDrawingToolActive = activeTool !== 'cursor';

  return (
    <svg
      ref={containerRef}
      className={`absolute inset-0 w-full h-full z-10 select-none ${
        isDrawingToolActive
          ? activeTool === 'eraser'
            ? 'cursor-not-allowed pointer-events-auto'
            : 'cursor-crosshair pointer-events-auto'
          : isDraggingShape || draggedPointIndex !== null
          ? 'cursor-move pointer-events-auto'
          : 'pointer-events-none'
      }`}
      onPointerDown={isDrawingToolActive ? handlePointerDown : undefined}
      onPointerMove={isDrawingToolActive ? handlePointerMove : undefined}
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

          // 1. Trendline (with Extend Left / Extend Right ray math)
          if (drawing.type === 'trendline' && pixels.length >= 2) {
            const svgWidth = containerRef.current?.clientWidth || 1200;
            const svgHeight = containerRef.current?.clientHeight || 800;
            let startX = pixels[0].x;
            let startY = pixels[0].y;
            let endX = pixels[1].x;
            let endY = pixels[1].y;

            const dx = pixels[1].x - pixels[0].x;
            const dy = pixels[1].y - pixels[0].y;

            if (drawing.extendLeft || drawing.extendRight) {
              if (Math.abs(dx) >= 0.5) {
                const slope = dy / dx;
                if (drawing.extendLeft) {
                  const targetX = -200;
                  if (pixels[0].x <= pixels[1].x) {
                    startX = targetX;
                    startY = pixels[0].y + slope * (targetX - pixels[0].x);
                  } else {
                    endX = targetX;
                    endY = pixels[1].y + slope * (targetX - pixels[1].x);
                  }
                }
                if (drawing.extendRight) {
                  const targetX = svgWidth + 200;
                  if (pixels[1].x >= pixels[0].x) {
                    endX = targetX;
                    endY = pixels[1].y + slope * (targetX - pixels[1].x);
                  } else {
                    startX = targetX;
                    startY = pixels[0].y + slope * (targetX - pixels[0].x);
                  }
                }
              } else {
                if (drawing.extendLeft) {
                  startY = dy >= 0 ? -200 : svgHeight + 200;
                }
                if (drawing.extendRight) {
                  endY = dy >= 0 ? svgHeight + 200 : -200;
                }
              }
            }

            const angle = calculateScreenAngle(pixels[0], pixels[1]);
            const midX = (pixels[0].x + pixels[1].x) / 2;
            const midY = (pixels[0].y + pixels[1].y) / 2;

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                {/* Hit test wider transparent stroke */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="transparent"
                  strokeWidth={18}
                />
                {/* Visual Line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
                {/* Angle & Info Badge */}
                {isSelected && (
                  <g transform={`translate(${midX}, ${midY - 14})`}>
                    <rect x="-35" y="-10" width="70" height="20" rx="6" fill="#0d131f" stroke="#3b82f6" strokeWidth="1" />
                    <text x="0" y="4" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      {angle}°
                    </text>
                  </g>
                )}
              </g>
            );
          }

          // 2. Horizontal Line (Support / Resistance Across Full Chart Width)
          if (drawing.type === 'horizontalLine' && pixels.length >= 1) {
            const yCoord = series ? (series.priceToCoordinate(drawing.points[0]?.price) ?? pixels[0].y) : pixels[0].y;
            const priceStr = formatMarketPrice(drawing.points[0]?.price);
            const svgWidth = containerRef.current?.clientWidth || 1000;
            const badgeX = Math.min(Math.max(pixels[0].x, 80), svgWidth - 120);

            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                {/* Hit test wider area */}
                <line
                  x1={0}
                  y1={yCoord}
                  x2="100%"
                  y2={yCoord}
                  stroke="transparent"
                  strokeWidth={18}
                />
                {/* Visual line */}
                <line
                  x1={0}
                  y1={yCoord}
                  x2="100%"
                  y2={yCoord}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray={strokeDash}
                />
                {/* Price scale badge */}
                <g transform={`translate(${badgeX}, ${yCoord - 10})`}>
                  <rect x="0" y="0" width="72" height="20" rx="4" fill="#0d131f" stroke={drawing.color} strokeWidth="1" />
                  <text x="36" y="14" fill={drawing.color} fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    ${priceStr}
                  </text>
                </g>
              </g>
            );
          }

          // 3. Horizontal Ray
          if (drawing.type === 'horizontalRay' && pixels.length >= 1) {
            const yCoord = series ? (series.priceToCoordinate(drawing.points[0]?.price) ?? pixels[0].y) : pixels[0].y;
            return (
              <g
                key={drawing.id}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                <line
                  x1={pixels[0].x}
                  y1={yCoord}
                  x2="100%"
                  y2={yCoord}
                  stroke="transparent"
                  strokeWidth={18}
                />
                <line
                  x1={pixels[0].x}
                  y1={yCoord}
                  x2="100%"
                  y2={yCoord}
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                <line
                  x1={pixels[0].x}
                  y1={0}
                  x2={pixels[0].x}
                  y2="100%"
                  stroke="transparent"
                  strokeWidth={18}
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                {/* Background hit test rect */}
                <rect
                  x={minX}
                  y={highY}
                  width={Math.max(maxX - minX, 20)}
                  height={Math.max(diffY, 10)}
                  fill="transparent"
                />
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
                        strokeWidth={fib.level === 0.618 ? 2 : 1}
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
              >
                <rect x="0" y="-18" width={noteText.length * 8 + 16} height="24" rx="6" fill="#0d131f" stroke={drawing.color} strokeWidth={isSelected ? 2 : 1} />
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
                onPointerDown={(e) => handleDrawingPointerDown(e, drawing)}
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

      {/* RENDER IN-PROGRESS LIVE DRAWING PREVIEW (pointerEvents: none prevents blocking second click) */}
      {inProgressPoints.length > 0 && cursorPos && (
        <g style={{ pointerEvents: 'none' }}>
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
        (selectedDrawing.type === 'horizontalLine' ? (
          (() => {
            const y = series ? (series.priceToCoordinate(selectedDrawing.points[0]?.price) ?? selectedPixels[0]?.y) : selectedPixels[0]?.y;
            if (y === undefined || y === null || isNaN(y)) return null;
            const svgWidth = containerRef.current?.clientWidth || 800;
            const isDraggingThis = draggedPointIndex === 0;
            return (
              <g
                key="handle-hline-center"
                className="cursor-ns-resize select-none"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingShape(false);
                  isDraggingShapeRef.current = false;
                  setDragStartPos(null);
                  dragStartPosRef.current = null;
                  setDragInitialPoints([]);
                  dragInitialPointsRef.current = [];
                  draggedPointIndexRef.current = 0;
                  setDraggedPointIndex(0);
                }}
              >
                {/* Wide invisible hit area (28px) */}
                <circle
                  cx={svgWidth / 2}
                  cy={y}
                  r={14}
                  fill="transparent"
                  className="pointer-events-auto cursor-ns-resize"
                />
                {/* Crisp visual control point */}
                <circle
                  cx={svgWidth / 2}
                  cy={y}
                  r={isDraggingThis ? 6.5 : 5}
                  fill={isDraggingThis ? '#3b82f6' : '#ffffff'}
                  stroke={isDraggingThis ? '#ffffff' : '#2563eb'}
                  strokeWidth={2}
                  className="pointer-events-none drop-shadow"
                />
              </g>
            );
          })()
        ) : (
          selectedDrawing.points.map((pt, idx) => {
            const pixel = pointToPixel(pt);
            if (!pixel) return null;
            const isDraggingThis = draggedPointIndex === idx;
            return (
              <g
                key={`handle-${idx}`}
                className="cursor-move select-none"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingShape(false);
                  isDraggingShapeRef.current = false;
                  setDragStartPos(null);
                  dragStartPosRef.current = null;
                  setDragInitialPoints([]);
                  dragInitialPointsRef.current = [];
                  draggedPointIndexRef.current = idx;
                  setDraggedPointIndex(idx);
                }}
              >
                {/* Wide invisible hit area (28px) */}
                <circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r={14}
                  fill="transparent"
                  className="pointer-events-auto cursor-move"
                />
                {/* Crisp visual control point */}
                <circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r={isDraggingThis ? 6.5 : 5}
                  fill={isDraggingThis ? '#3b82f6' : '#ffffff'}
                  stroke={isDraggingThis ? '#ffffff' : '#2563eb'}
                  strokeWidth={2}
                  className="pointer-events-none drop-shadow"
                />
              </g>
            );
          })
        ))}

      {/* FLOATING ACTION TOOLBAR FOR SELECTED DRAWING (Hidden during active drag for clean UX) */}
      {selectedDrawing && toolbarPos && !isDraggingShape && draggedPointIndex === null && (
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
              position={toolbarPos}
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
