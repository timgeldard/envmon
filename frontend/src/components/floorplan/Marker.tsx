import React from 'react';
import type { MarkerData, HeatmapMode } from '~/types';

interface MarkerProps {
  marker: MarkerData;
  mode: HeatmapMode;
  /** SVG viewport dimensions — used to convert % → SVG units */
  svgWidth: number;
  svgHeight: number;
  onClick: (marker: MarkerData) => void;
  onMouseEnter: (marker: MarkerData, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const STATUS_COLOUR: Record<string, string> = {
  PASS: '#24a148',
  FAIL: '#da1e28',
  PENDING: '#f1c21b',
  NO_DATA: '#8d8d8d',
};

const BASE_RADIUS = 10;
const MAX_GLOW_RADIUS = 22;

export default function Marker({
  marker,
  mode,
  svgWidth,
  svgHeight,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: MarkerProps) {
  const cx = (marker.x_pos / 100) * svgWidth;
  const cy = (marker.y_pos / 100) * svgHeight;
  const colour = STATUS_COLOUR[marker.status] ?? '#8d8d8d';

  // Continuous mode: scale radius and add glow based on risk score
  let radius = BASE_RADIUS;
  let glowOpacity = 0;
  if (mode === 'continuous' && marker.risk_score !== null) {
    const clamped = Math.min(marker.risk_score ?? 0, 5);
    radius = BASE_RADIUS + (clamped / 5) * (MAX_GLOW_RADIUS - BASE_RADIUS);
    glowOpacity = Math.min(clamped / 5, 0.6);
  }

  return (
    <g
      style={{ cursor: 'pointer', pointerEvents: 'all' }}
      onClick={() => onClick(marker)}
      onMouseEnter={(e) => onMouseEnter(marker, e)}
      onMouseLeave={onMouseLeave}
      role="button"
      aria-label={`Location ${marker.func_loc_id}: ${marker.status}`}
    >
      {/* Glow halo for continuous mode */}
      {mode === 'continuous' && glowOpacity > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 6}
          fill={colour}
          opacity={glowOpacity}
        />
      )}

      {/* Main marker circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={colour}
        stroke="#ffffff"
        strokeWidth={1.5}
      />

      {/* Fail indicator — exclamation mark */}
      {marker.status === 'FAIL' && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={12}
          fill="#ffffff"
          fontWeight="bold"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          !
        </text>
      )}
    </g>
  );
}
