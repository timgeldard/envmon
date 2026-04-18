/**
 * FloorPlan — renders the SVG floor plan for the active floor and overlays
 * heatmap markers.
 *
 * Layout:
 *   <div.em-floorplan-container>
 *     <svg viewBox="0 0 W H">            single SVG: background + markers
 *       <image href=svgUrl ... />        floor plan background
 *       <Marker … />                     heatmap overlay
 *
 * The background image and markers share one coordinate system and one
 * preserveAspectRatio, so % coordinates map correctly to the visible floor
 * plan at any container size, and there is no two-layer alignment race.
 *
 * The background image is preloaded off-DOM via image.decode() before the
 * new floor's markers are rendered — prevents flicker when switching floors.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Loading, InlineNotification } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import { useHeatmap, useFloors } from '~/api/client';
import Marker from './Marker';
import Tooltip from './Tooltip';
import type { MarkerData } from '~/types';

// Default aspect ratio if not provided by backend
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

export default function FloorPlan() {
  const { activeFloor, heatmapMode, timeWindow, setSelectedLocId, historicalDate, theme, decayLambda, selectedMics } = useEM();
  const { data: floors = [] } = useFloors();

  const currentFloor = useMemo(
    () => floors.find((f) => f.floor_id === activeFloor) || floors[0],
    [floors, activeFloor],
  );

  const [tooltip, setTooltip] = useState<{
    marker: MarkerData;
    x: number;
    y: number;
  } | null>(null);

  const { data, isLoading, isError, error } = useHeatmap(
    activeFloor,
    heatmapMode,
    timeWindow,
    historicalDate,
    decayLambda,
    selectedMics,
  );

  const handleMarkerClick = useCallback(
    (marker: MarkerData) => setSelectedLocId(marker.func_loc_id),
    [setSelectedLocId],
  );

  const handleMouseEnter = useCallback(
    (marker: MarkerData, e: React.MouseEvent) =>
      setTooltip({ marker, x: e.clientX, y: e.clientY }),
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const svgUrl = currentFloor?.svg_url ?? null;
  const viewWidth = currentFloor?.svg_width || DEFAULT_WIDTH;
  const viewHeight = currentFloor?.svg_height || DEFAULT_HEIGHT;

  // Preload background before rendering markers for the new floor. We hold
  // `readyUrl` == svgUrl off-DOM via image.decode(), which avoids the
  // flash where markers briefly render on top of the previous floor's
  // background while the browser decodes the new one.
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [svgError, setSvgError] = useState(false);

  useEffect(() => {
    if (!svgUrl) {
      setReadyUrl(null);
      setSvgError(false);
      return;
    }
    let cancelled = false;
    setSvgError(false);
    const img = new Image();
    img.src = svgUrl;
    const done = typeof img.decode === 'function'
      ? img.decode()
      : new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image load failed'));
        });
    done
      .then(() => { if (!cancelled) setReadyUrl(svgUrl); })
      .catch(() => { if (!cancelled) setSvgError(true); });
    return () => { cancelled = true; };
  }, [svgUrl]);

  const imageReady = svgUrl !== null && readyUrl === svgUrl;
  const showLoading = !svgError && svgUrl !== null && (!imageReady || isLoading);

  return (
    <div className="em-floorplan-container">

      {/* Loading spinner — shown while background decodes or heatmap loads */}
      {showLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme === 'g100' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
        }}>
          <Loading description="Loading floor plan..." withOverlay={false} />
        </div>
      )}

      {/* Error banner (heatmap) */}
      {isError && (
        <div style={{ position: 'absolute', top: 'var(--cds-spacing-05)', left: 'var(--cds-spacing-05)', right: 'var(--cds-spacing-05)', zIndex: 10 }}>
          <InlineNotification
            kind="error"
            title="Failed to load heatmap"
            subtitle={(error as Error).message}
            hideCloseButton
          />
        </div>
      )}

      {/* Error banner (floor plan image) */}
      {svgError && (
        <div style={{ position: 'absolute', top: 'var(--cds-spacing-05)', left: 'var(--cds-spacing-05)', right: 'var(--cds-spacing-05)', zIndex: 10 }}>
          <InlineNotification
            kind="error"
            title="Failed to load floor plan image"
            subtitle={svgUrl ?? ''}
            hideCloseButton
          />
        </div>
      )}

      {/* Empty state */}
      {!svgUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--cds-text-placeholder)',
        }}>
          No floor plan image available.
        </div>
      )}

      {/* Single SVG — background image and markers share one coordinate system */}
      {svgUrl && (
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Floor plan and heatmap markers for ${activeFloor}`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <image
            href={svgUrl}
            x={0}
            y={0}
            width={viewWidth}
            height={viewHeight}
            preserveAspectRatio="xMidYMid meet"
            style={{
              opacity: imageReady ? 1 : 0,
              transition: 'opacity 150ms ease-out',
            }}
          />
          {imageReady && data?.markers.map((marker) => (
            <Marker
              key={marker.func_loc_id}
              marker={marker}
              mode={heatmapMode}
              svgWidth={viewWidth}
              svgHeight={viewHeight}
              onClick={handleMarkerClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </svg>
      )}

      {/* Tooltip — outside SVG so it's not clipped */}
      {tooltip && (
        <Tooltip marker={tooltip.marker} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}
