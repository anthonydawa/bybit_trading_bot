export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontalLine'
  | 'horizontalRay'
  | 'verticalLine'
  | 'rectangle'
  | 'fibonacci'
  | 'riskReward'
  | 'text'
  | 'measure'
  | 'eraser';

export interface ChartPoint {
  time: number; // unix timestamp in seconds
  price: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export interface BaseDrawing {
  id: string;
  type: DrawingToolType;
  points: ChartPoint[]; // 1, 2, or 3 points in time/price space
  color: string;
  lineWidth: number; // 1, 2, 3, 4
  lineStyle: LineStyleType;
  locked?: boolean;
  visible?: boolean;
  createdAt: number;
  extendLeft?: boolean;
  extendRight?: boolean;
}

export interface TrendlineDrawing extends BaseDrawing {
  type: 'trendline';
  showAngle?: boolean;
  showPriceChange?: boolean;
  extendLeft?: boolean;
  extendRight?: boolean;
}

export interface HorizontalLineDrawing extends BaseDrawing {
  type: 'horizontalLine';
  showPriceLabel?: boolean;
}

export interface HorizontalRayDrawing extends BaseDrawing {
  type: 'horizontalRay';
}

export interface VerticalLineDrawing extends BaseDrawing {
  type: 'verticalLine';
}

export interface RectangleDrawing extends BaseDrawing {
  type: 'rectangle';
  fillColor?: string;
  fillOpacity?: number; // 0.1 - 1
}

export interface FibonacciDrawing extends BaseDrawing {
  type: 'fibonacci';
  levels?: number[]; // [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  fillOpacity?: number;
}

export interface RiskRewardDrawing extends BaseDrawing {
  type: 'riskReward';
  positionSide: 'long' | 'short';
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  riskRewardRatio: number;
}

export interface TextDrawing extends BaseDrawing {
  type: 'text';
  text: string;
  fontSize?: number;
}

export interface MeasureDrawing extends BaseDrawing {
  type: 'measure';
  barsCount?: number;
  priceChange?: number;
  percentChange?: number;
}

export type Drawing =
  | TrendlineDrawing
  | HorizontalLineDrawing
  | HorizontalRayDrawing
  | VerticalLineDrawing
  | RectangleDrawing
  | FibonacciDrawing
  | RiskRewardDrawing
  | TextDrawing
  | MeasureDrawing
  | BaseDrawing;

export const DEFAULT_FIB_LEVELS = [
  { level: 0, color: '#94a3b8' },
  { level: 0.236, color: '#ef4444' },
  { level: 0.382, color: '#f97316' },
  { level: 0.5, color: '#10b981' },
  { level: 0.618, color: '#06b6d4' },
  { level: 0.786, color: '#3b82f6' },
  { level: 1.0, color: '#a855f7' },
];

/**
 * Calculate geometric angle in degrees between two screen points (0 to 360 deg)
 */
export function calculateScreenAngle(p1: PixelPoint, p2: PixelPoint): number {
  const dx = p2.x - p1.x;
  const dy = -(p2.y - p1.y); // Invert Y because canvas Y increases downwards
  let rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.round(deg * 10) / 10;
}

/**
 * Calculate distance between two screen points
 */
export function calculateDistance(p1: PixelPoint, p2: PixelPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Check if a pixel point is close to a line segment (hit testing for selection)
 */
export function isPointNearLine(
  pt: PixelPoint,
  p1: PixelPoint,
  p2: PixelPoint,
  threshold: number = 6
): boolean {
  const lineLen = calculateDistance(p1, p2);
  if (lineLen === 0) return calculateDistance(pt, p1) <= threshold;

  // Projection of pt onto line segment
  const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / (lineLen * lineLen)));
  const projX = p1.x + t * (p2.x - p1.x);
  const projY = p1.y + t * (p2.y - p1.y);

  return Math.hypot(pt.x - projX, pt.y - projY) <= threshold;
}

/**
 * Check if a pixel point is inside a rectangle
 */
export function isPointInsideRect(
  pt: PixelPoint,
  p1: PixelPoint,
  p2: PixelPoint,
  threshold: number = 5
): boolean {
  const minX = Math.min(p1.x, p2.x) - threshold;
  const maxX = Math.max(p1.x, p2.x) + threshold;
  const minY = Math.min(p1.y, p2.y) - threshold;
  const maxY = Math.max(p1.y, p2.y) + threshold;

  return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}
