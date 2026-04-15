/**
 * CoordinateMapper — admin spatial authoring tool.
 *
 * Left sidebar: list of unmapped SAP functional location IDs.
 * Right canvas: the active floor plan SVG.
 *
 * Drag an ID from the sidebar and drop it on the floor plan.
 * The app captures relative % coordinates and POSTs to /api/em/coordinates.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Tag, InlineNotification, Loading } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import { useUnmappedLocations, useSaveCoordinate } from '~/api/client';

const FLOOR_SVG: Record<string, string> = {
  F1: new URL('~/assets/floor1.svg', import.meta.url).href,
  F2: new URL('~/assets/floor2.svg', import.meta.url).href,
  F3: new URL('~/assets/floor3.svg', import.meta.url).href,
};

export default function CoordinateMapper() {
  const { activeFloor } = useEM();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: unmapped = [], isLoading } = useUnmappedLocations();
  const { mutate: saveCoordinate, isPending } = useSaveCoordinate();

  const handleDragStart = useCallback((funcLocId: string) => {
    setDraggingId(funcLocId);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!draggingId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x_pos = ((e.clientX - rect.left) / rect.width) * 100;
      const y_pos = ((e.clientY - rect.top) / rect.height) * 100;

      saveCoordinate(
        {
          func_loc_id: draggingId,
          floor_id: activeFloor,
          x_pos: Math.round(x_pos * 100) / 100,
          y_pos: Math.round(y_pos * 100) / 100,
        },
        {
          onSuccess: () => {
            setSuccessMsg(`Saved ${draggingId} at (${x_pos.toFixed(1)}%, ${y_pos.toFixed(1)}%)`);
            setDraggingId(null);
            setTimeout(() => setSuccessMsg(null), 3000);
          },
        },
      );
    },
    [draggingId, activeFloor, saveCoordinate],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
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

      {/* Drop canvas */}
      <div
        className="em-mapper-canvas"
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{ position: 'relative' }}
      >
        <img
          src={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
          alt={`Floor ${activeFloor} plan`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />

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

        {/* Drop hint overlay when dragging */}
        {draggingId && (
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px dashed #0f62fe',
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tag type="blue">Drop {draggingId} here</Tag>
          </div>
        )}
      </div>
    </div>
  );
}
