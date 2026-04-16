/**
 * CoordinateMapper — admin spatial authoring tool.
 *
 * Left sidebar: list of unmapped SAP functional location IDs.
 * Right canvas: the active floor plan SVG (same viewBox as FloorPlan).
 *
 * Drag an ID from the sidebar and drop it onto the SVG floor plan.
 * Drop coordinates are converted from screen space → SVG viewBox space via
 * getScreenCTM(), then stored as % of the viewBox so they match exactly how
 * FloorPlan renders markers (x_svg = x_pos/100 * SVG_WIDTH).
 */

import React, { useCallback, useRef, useState } from 'react';
import { Tag, InlineNotification, Loading } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import { useUnmappedLocations, useSaveCoordinate } from '~/api/client';
import floor1Url from '~/assets/floor1.svg?url';
import floor2Url from '~/assets/floor2.svg?url';
import floor3Url from '~/assets/floor3.svg?url';

const FLOOR_SVG: Record<string, string> = {
  F1: floor1Url,
  F2: floor2Url,
  F3: floor3Url,
};

// Must match FloorPlan.tsx
const SVG_WIDTH = 1021.6;
const SVG_HEIGHT = 722.48;

export default function CoordinateMapper() {
  const { activeFloor } = useEM();
  const svgRef = useRef<SVGSVGElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: unmapped = [], isLoading } = useUnmappedLocations();
  const { mutate: saveCoordinate, isPending } = useSaveCoordinate();

  const handleDragStart = useCallback((funcLocId: string) => {
    setDraggingId(funcLocId);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!draggingId || !svgRef.current) return;

      // Convert screen coordinates → SVG viewBox coordinates
      const svgEl = svgRef.current;
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());

      // Convert to % of viewBox (clamped) — matches FloorPlan marker rendering
      const x_pos = Math.max(0, Math.min(100, (svgPt.x / SVG_WIDTH) * 100));
      const y_pos = Math.max(0, Math.min(100, (svgPt.y / SVG_HEIGHT) * 100));

      const payload = {
        func_loc_id: draggingId,
        floor_id: activeFloor,
        x_pos: Math.round(x_pos * 100) / 100,
        y_pos: Math.round(y_pos * 100) / 100,
      };

      saveCoordinate(payload, {
        onSuccess: () => {
          setSuccessMsg(
            `Saved ${draggingId} at (${x_pos.toFixed(1)}%, ${y_pos.toFixed(1)}%)`
          );
          setDraggingId(null);
          setTimeout(() => setSuccessMsg(null), 3000);
        },
      });
    },
    [draggingId, activeFloor, saveCoordinate],
  );

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="em-mapper-container">
      {/* Unmapped locations sidebar */}
      <div className="em-mapper-sidebar">
        <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          Unmapped locations
        </div>

        {isLoading && <Loading description="Loading…" withOverlay={false} small />}

        {!isLoading && unmapped.length === 0 && (
          <p style={{ color: '#6f6f6f', fontSize: '0.8rem' }}>
            All locations are mapped.
          </p>
        )}

        {unmapped.map((loc) => (
          <div
            key={loc.func_loc_id}
            className="em-draggable-id"
            draggable
            onDragStart={() => handleDragStart(loc.func_loc_id)}
            title={loc.func_loc_name ?? loc.func_loc_id}
          >
            {loc.func_loc_id}
            {loc.func_loc_name && (
              <span style={{ color: '#6f6f6f', marginLeft: '0.25rem' }}>
                — {loc.func_loc_name}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Drop canvas — SVG matching FloorPlan viewBox so coordinates are identical */}
      <div className="em-mapper-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          style={{ display: 'block', cursor: draggingId ? 'crosshair' : 'default' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Floor plan image */}
          <image
            href={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
          />

          {/* Drop hint overlay when dragging */}
          {draggingId && (
            <rect
              x={0}
              y={0}
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              fill="none"
              stroke="#0f62fe"
              strokeWidth={8}
              strokeDasharray="24 12"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Overlays rendered outside SVG to avoid coordinate constraints */}
        {isPending && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loading description="Saving…" withOverlay={false} />
          </div>
        )}

        {successMsg && (
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem' }}>
            <InlineNotification
              kind="success"
              title="Coordinate saved"
              subtitle={successMsg}
              hideCloseButton
            />
          </div>
        )}

        {draggingId && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}>
            <Tag type="blue">Drop {draggingId} on the floor plan</Tag>
          </div>
        )}
      </div>
    </div>
  );
}
