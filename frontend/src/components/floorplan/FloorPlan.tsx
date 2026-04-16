/**
 * FloorPlan — renders the SVG floor plan for the active floor and overlays
 * heatmap markers.
 *
 * Layout:
 *   <div.em-floorplan-container>          position:absolute inset:0
 *     <img key={svgUrl}>                  floor plan background, object-fit:contain
 *     <svg viewBox="0 0 1021.6 722.48">   marker overlay, same aspect ratio
 *       <Marker … />
 *
 * Both the <img> and the <svg> use the same viewBox aspect ratio and
 * xMidYMid meet alignment, so % coordinates from the DB map correctly to
 * the visible floor plan area regardless of container size.
 *
 * The <img key={svgUrl}> forces a fresh browser fetch on every floor change,
 * avoiding the browser issue where updating href on an SVG <image> element
 * in place does not trigger a reload.
 */

import React, { useState, useCallback } from 'react';
import { Loading, InlineNotification } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import { useHeatmap } from '~/api/client';
import Marker from './Marker';
import Tooltip from './Tooltip';
import type { MarkerData } from '~/types';

import floor1Url from '~/assets/floor1.svg?url';
import floor2Url from '~/assets/floor2.svg?url';
import floor3Url from '~/assets/floor3.svg?url';

const FLOOR_SVG: Record<string, string> = {
  F1: floor1Url,
  F2: floor2Url,
  F3: floor3Url,
};

// ViewBox dimensions — must match the floor plan SVGs
const SVG_WIDTH = 1021.6;
const SVG_HEIGHT = 722.48;

export default function FloorPlan() {
  const { activeFloor, heatmapMode, timeWindow, setSelectedLocId } = useEM();

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
    (marker: MarkerData) => setSelectedLocId(marker.func_loc_id),
    [setSelectedLocId],
  );

  const handleMouseEnter = useCallback(
    (marker: MarkerData, e: React.MouseEvent) =>
      setTooltip({ marker, x: e.clientX, y: e.clientY }),
    [],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const svgUrl = FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1'];

  return (
    <div className="em-floorplan-container">
      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Loading description="Loading heatmap…" withOverlay={false} />
        </div>
      )}

      {/* Error banner */}
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

      {/*
        Floor plan background — standard <img> with key={svgUrl} so the
        browser unmounts and reloads the image on every floor switch.
        object-fit:contain letterboxes the image; the SVG overlay below
        uses the same aspect ratio so markers stay aligned.
      */}
      <img
        key={svgUrl}
        src={svgUrl}
        alt={`Floor ${activeFloor} plan`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          display: 'block',
        }}
      />

      {/*
        Marker overlay SVG — same viewBox + preserveAspectRatio as the
        floor plan image, so SVG coordinates map 1:1 to the visible image.
      */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Heatmap markers for floor ${activeFloor}`}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
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

      {/* Tooltip — outside SVG so it's not clipped */}
      {tooltip && (
        <Tooltip marker={tooltip.marker} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}
