import React from 'react';
import type { MarkerData, HeatmapMode } from '~/types';

interface MarkerProps {
  marker: MarkerData;
  mode: HeatmapMode;
  svgWidth: number;
  svgHeight: number;
  onClick: (marker: MarkerData) => void;
  onMouseEnter: (marker: MarkerData, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/** Map status to CSS class using Carbon support tokens (defined in index.css) */
const STATUS_CLASS: Record<string, string> = {
  PASS:    'em-marker--pass',
  FAIL:    'em-marker--fail',
  WARNING: 'em-marker--warning',
  PENDING: 'em-marker--pending',
  NO_DATA: 'em-marker--no-data',
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
  const statusClass = STATUS_CLASS[marker.status] ?? 'em-marker--no-data';

  let radius = BASE_RADIUS;
  let glowOpacity = 0;
  if (mode === 'continuous' && marker.risk_score !== null) {
    const clamped = Math.min(marker.risk_score ?? 0, 5);
    radius = BASE_RADIUS + (clamped / 5) * (MAX_GLOW_RADIUS - BASE_RADIUS);
    glowOpacity = Math.min(clamped / 5, 0.6);
  }

  // Blast radius scales with SVG dimensions (approx 6% of minimum dimension)
  const blastRadius = Math.min(svgWidth, svgHeight) * 0.06;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(marker);
    }
  };

  return (
    <g
      className="em-marker-group"
      onClick={() => onClick(marker)}
      onMouseEnter={(e) => onMouseEnter(marker, e)}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Location ${marker.func_loc_id}: ${marker.status}${marker.risk_score !== null ? `, Risk score: ${marker.risk_score.toFixed(2)}` : ''}`}
    >
      {/* Blast Radius visualization for failed points */}
      {marker.status === 'FAIL' && (
        <circle
          cx={cx}
          cy={cy}
          r={blastRadius}
          className="em-blast-radius"
        />
      )}

      {/* Glow halo for continuous mode */}
      {mode === 'continuous' && glowOpacity > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 6}
          className={statusClass}
          opacity={glowOpacity}
        />
      )}

      {/* Main marker circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        className={statusClass}
        stroke="var(--cds-background)"
        strokeWidth={1.5}
      />

      {/* Fail / Warning indicator */}
      {(marker.status === 'FAIL' || marker.status === 'WARNING') && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={12}
          fill="var(--cds-text-on-color)"
          fontWeight="600"
          className="em-marker-label"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          !
        </text>
      )}
    </g>
  );
}
