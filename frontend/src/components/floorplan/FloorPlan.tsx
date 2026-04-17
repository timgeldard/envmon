/**
 * FloorPlan — renders the SVG floor plan for the active floor and overlays
 * heatmap markers.
 *
 * Layout:
 *   <div.em-floorplan-container>          position:absolute inset:0
 *     <img key={svgUrl}>                  floor plan background, object-fit:contain
 *     <svg viewBox="0 0 W H">             marker overlay, same aspect ratio
 *       <Marker … />
 *
 * Both the <img> and the <svg> use the same viewBox aspect ratio and
 * xMidYMid meet alignment, so % coordinates from the DB map correctly to
 * the visible floor plan area regardless of container size.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Loading, InlineNotification, IconButton } from '@carbon/react';
import { Download } from '@carbon/icons-react';
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

  const handleExport = () => {
    if (!data?.markers.length) return;
    const headers = ['Functional Location', 'Status', 'Risk Score', 'Fail Count', 'Total Lots', 'X%', 'Y%'];
    const rows = data.markers.map((m) => [
      m.func_loc_id,
      m.status,
      m.risk_score ?? '',
      m.fail_count,
      m.total_count,
      m.x_pos.toFixed(2),
      m.y_pos.toFixed(2),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `em_heatmap_${activeFloor}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const svgUrl = currentFloor?.svg_url;
  const viewWidth = currentFloor?.svg_width || DEFAULT_WIDTH;
  const viewHeight = currentFloor?.svg_height || DEFAULT_HEIGHT;

  return (
    <div className="em-floorplan-container">
      {/* Action bar */}
      <div style={{
        position: 'absolute', top: 'var(--cds-spacing-05)', right: 'var(--cds-spacing-05)',
        zIndex: 20, display: 'flex', gap: 'var(--cds-spacing-03)',
      }}>
        <IconButton
          label="Export markers to CSV"
          kind="ghost"
          size="md"
          align="bottom-left"
          onClick={handleExport}
          disabled={!data?.markers.length}
        >
          <Download size={20} />
        </IconButton>
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme === 'g100' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
        }}>
          <Loading description="Loading heatmap..." withOverlay={false} />
        </div>
      )}

      {/* Error banner */}
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

      {/* Floor plan background */}
      {svgUrl ? (
        <img
          key={svgUrl}
          src={svgUrl}
          alt={`Floor plan for ${activeFloor}`}
          role="img"
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
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--cds-text-placeholder)',
        }}>
          No floor plan image available.
        </div>
      )}

      {/* Marker overlay SVG */}
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
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
            svgWidth={viewWidth}
            svgHeight={viewHeight}
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
