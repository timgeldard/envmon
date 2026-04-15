/**
 * FloorPlan — renders the SVG floor plan for the active floor and overlays
 * heatmap markers as an absolutely-positioned SVG layer.
 *
 * The SVG floor plan images have viewBox="0 0 1021.6 722.48".
 * Markers are positioned using relative % coordinates stored in the DB,
 * which are converted to SVG units at render time so they stay anchored
 * regardless of browser zoom.
 */

import React, { useRef, useState, useCallback } from 'react';
import { Loading, InlineNotification } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import { useHeatmap } from '~/api/client';
import Marker from './Marker';
import Tooltip from './Tooltip';
import type { MarkerData } from '~/types';

// SVG viewBox dimensions (same for all three floor plans)
const SVG_WIDTH = 1021.6;
const SVG_HEIGHT = 722.48;

// Dynamically import SVG floor plans as URLs (not inline) to keep the bundle light.
// vite-plugin-svgr is configured but we use ?url imports for the background layer.
const FLOOR_SVG: Record<string, string> = {
  F1: new URL('~/assets/floor1.svg', import.meta.url).href,
  F2: new URL('~/assets/floor2.svg', import.meta.url).href,
  F3: new URL('~/assets/floor3.svg', import.meta.url).href,
};

export default function FloorPlan() {
  const { activeFloor, heatmapMode, timeWindow, setSelectedLocId } = useEM();
  const containerRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<{
    marker: MarkerData;
    x: number;
    y: number;
  } | null>(null);

  const { data, isLoading, isError, error } = useHeatmap(
    activeFloor,
    heatmapMode,
    timeWindow,
  );

  const handleMarkerClick = useCallback(
    (marker: MarkerData) => {
      setSelectedLocId(marker.func_loc_id);
    },
    [setSelectedLocId],
  );

  const handleMouseEnter = useCallback(
    (marker: MarkerData, e: React.MouseEvent) => {
      setTooltip({ marker, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const svgUrl = FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1'];

  return (
    <div className="em-floorplan-container" ref={containerRef}>
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Loading description="Loading heatmap…" withOverlay={false} />
        </div>
      )}

      {isError && (
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', zIndex: 10 }}>
          <InlineNotification
            kind="error"
            title="Failed to load heatmap"
            subtitle={(error as Error).message}
            hideCloseButton
          />
        </div>
      )}

      {/* Floor plan SVG as background image */}
      <svg
        className="em-floorplan-svg"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Floor plan for floor ${activeFloor}`}
      >
        <image
          href={svgUrl}
          x={0}
          y={0}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
        />

        {/* Marker layer — rendered inside the same SVG coordinate space */}
        {data?.markers.map((marker) => (
          <Marker
            key={marker.func_loc_id}
            marker={marker}
            mode={heatmapMode}
            svgWidth={SVG_WIDTH}
            svgHeight={SVG_HEIGHT}
            onClick={handleMarkerClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </svg>

      {/* Tooltip — rendered outside SVG to avoid SVG coordinate constraints */}
      {tooltip && (
        <Tooltip
          marker={tooltip.marker}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}
