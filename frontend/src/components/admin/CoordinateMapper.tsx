/**
 * CoordinateMapper — admin spatial authoring tool.
 *
 * Sidebar tabs:
 *   Unmapped — SAP locations not yet placed; drag onto floor plan to map
 *   Mapped   — already-placed locations; shows floor + position, with
 *              Un-map button and drag-to-reposition on the floor plan
 *
 * Floor plan canvas:
 *   - Background <img key> reloads on floor switch
 *   - Overlay SVG handles drops (new mappings) and shows existing markers
 *   - Existing markers are draggable to reposition them
 *   - Drop coordinates converted via getScreenCTM() into viewBox space
 *     (matching FloorPlan exactly so saved % values render in the right place)
 */

import React, { useCallback, useRef, useState } from 'react';
import { Tag, InlineNotification, Loading, Button, Tabs, Tab, TabList, TabPanels, TabPanel } from '@carbon/react';
import { TrashCan, Move } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import {
  useUnmappedLocations,
  useMappedLocations,
  useSaveCoordinate,
  useDeleteCoordinate,
} from '~/api/client';
import type { LocationMeta } from '~/types';
import floor1Url from '~/assets/floor1.svg?url';
import floor2Url from '~/assets/floor2.svg?url';
import floor3Url from '~/assets/floor3.svg?url';

const FLOOR_SVG: Record<string, string> = {
  F1: floor1Url,
  F2: floor2Url,
  F3: floor3Url,
};

const SVG_WIDTH = 1021.6;
const SVG_HEIGHT = 722.48;

const MARKER_R = 10;
const MARKER_COLOURS: Record<string, string> = {
  F1: '#0f62fe',
  F2: '#6929c4',
  F3: '#005d5d',
};

type DragSource =
  | { kind: 'unmapped'; funcLocId: string }
  | { kind: 'mapped'; funcLocId: string };

export default function CoordinateMapper() {
  const { activeFloor } = useEM();
  const svgRef = useRef<SVGSVGElement>(null);

  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [notification, setNotification] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: unmapped = [], isLoading: loadingUnmapped } = useUnmappedLocations();
  const { data: mapped = [], isLoading: loadingMapped } = useMappedLocations();
  const { mutate: saveCoordinate, isPending: isSaving } = useSaveCoordinate();
  const { mutate: deleteCoordinate, isPending: isDeleting } = useDeleteCoordinate();

  // Mapped locations for the current floor (shown as markers on canvas)
  const floorMapped = mapped.filter((m) => m.floor_id === activeFloor);

  const notify = (kind: 'success' | 'error', message: string) => {
    setNotification({ kind, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Convert screen drop position → SVG viewBox % coordinates
  const screenToSvgPct = (clientX: number, clientY: number) => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return {
      x_pos: Math.round(Math.max(0, Math.min(100, (svgPt.x / SVG_WIDTH) * 100)) * 100) / 100,
      y_pos: Math.round(Math.max(0, Math.min(100, (svgPt.y / SVG_HEIGHT) * 100)) * 100) / 100,
    };
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!dragging) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (!pos) return;

      saveCoordinate(
        { func_loc_id: dragging.funcLocId, floor_id: activeFloor, ...pos },
        {
          onSuccess: () => {
            notify('success', `${dragging.funcLocId} → ${activeFloor} (${pos.x_pos.toFixed(1)}%, ${pos.y_pos.toFixed(1)}%)`);
            setDragging(null);
          },
          onError: (err) => {
            notify('error', err.message);
            setDragging(null);
          },
        },
      );
    },
    [dragging, activeFloor, saveCoordinate],
  );

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleUnmap = (funcLocId: string) => {
    deleteCoordinate(funcLocId, {
      onSuccess: () => notify('success', `${funcLocId} removed from map`),
      onError: (err) => notify('error', err.message),
    });
  };

  const markerColour = MARKER_COLOURS[activeFloor] ?? '#0f62fe';

  return (
    <div className="em-mapper-container">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-sidebar">
        <Tabs>
          <TabList aria-label="Coordinate mapping tabs" contained>
            <Tab>Unmapped ({unmapped.length})</Tab>
            <Tab>Mapped ({mapped.length})</Tab>
          </TabList>

          <TabPanels>
            {/* Unmapped tab */}
            <TabPanel>
              {loadingUnmapped && (
                <Loading description="Loading…" withOverlay={false} small />
              )}
              {!loadingUnmapped && unmapped.length === 0 && (
                <p style={{ color: '#6f6f6f', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                  All locations are mapped.
                </p>
              )}
              {unmapped.map((loc) => (
                <div
                  key={loc.func_loc_id}
                  className="em-draggable-id"
                  draggable
                  onDragStart={() => setDragging({ kind: 'unmapped', funcLocId: loc.func_loc_id })}
                  onDragEnd={() => setDragging(null)}
                  title="Drag onto floor plan to map"
                >
                  <Move size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle', flexShrink: 0 }} />
                  {loc.func_loc_id}
                </div>
              ))}
            </TabPanel>

            {/* Mapped tab */}
            <TabPanel>
              {loadingMapped && (
                <Loading description="Loading…" withOverlay={false} small />
              )}
              {!loadingMapped && mapped.length === 0 && (
                <p style={{ color: '#6f6f6f', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                  No locations mapped yet.
                </p>
              )}
              {mapped.map((loc) => (
                <div key={loc.func_loc_id} className="em-mapped-row">
                  <div
                    className="em-draggable-id em-mapped-draggable"
                    draggable
                    onDragStart={() => setDragging({ kind: 'mapped', funcLocId: loc.func_loc_id })}
                    onDragEnd={() => setDragging(null)}
                    title={`Floor ${loc.floor_id} — drag to reposition`}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Move size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{loc.func_loc_id}</span>
                    <span className="em-floor-badge">{loc.floor_id}</span>
                  </div>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={TrashCan}
                    iconDescription="Remove mapping"
                    tooltipPosition="left"
                    onClick={() => handleUnmap(loc.func_loc_id)}
                    disabled={isDeleting}
                    style={{ flexShrink: 0, color: '#da1e28' }}
                  />
                </div>
              ))}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Floor plan canvas                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-canvas">
        {/* Background floor plan — key forces reload on floor switch */}
        <img
          key={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
          src={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
          alt={`Floor ${activeFloor} plan`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            pointerEvents: 'none',
          }}
        />

        {/* SVG overlay — drop target + existing marker display */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            cursor: dragging ? 'crosshair' : 'default',
            overflow: 'visible',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Existing mapped markers for this floor */}
          {floorMapped.map((loc) => {
            const cx = ((loc.x_pos ?? 0) / 100) * SVG_WIDTH;
            const cy = ((loc.y_pos ?? 0) / 100) * SVG_HEIGHT;
            const isBeingDragged = dragging?.funcLocId === loc.func_loc_id;
            return (
              <g
                key={loc.func_loc_id}
                style={{ cursor: 'grab', opacity: isBeingDragged ? 0.35 : 1 }}
                draggable
                onDragStart={() => setDragging({ kind: 'mapped', funcLocId: loc.func_loc_id })}
                onDragEnd={() => setDragging(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={MARKER_R + 4}
                  fill={markerColour}
                  opacity={0.15}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={MARKER_R}
                  fill={markerColour}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={cy - MARKER_R - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill={markerColour}
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {loc.func_loc_id}
                </text>
              </g>
            );
          })}

          {/* Drop hint border while dragging */}
          {dragging && (
            <rect
              x={0}
              y={0}
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              fill="rgba(15,98,254,0.04)"
              stroke="#0f62fe"
              strokeWidth={8}
              strokeDasharray="24 12"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Saving spinner */}
        {(isSaving || isDeleting) && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <Loading description="Saving…" withOverlay={false} />
          </div>
        )}

        {/* Success / error notification */}
        {notification && (
          <div style={{
            position: 'absolute', top: '1rem',
            left: '1rem', right: '1rem', zIndex: 20,
          }}>
            <InlineNotification
              kind={notification.kind}
              title={notification.kind === 'success' ? 'Saved' : 'Error'}
              subtitle={notification.message}
              hideCloseButton
            />
          </div>
        )}

        {/* Drop hint label */}
        {dragging && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 20,
          }}>
            <Tag type="blue">
              {dragging.kind === 'mapped' ? 'Drop to reposition' : 'Drop to place'} {dragging.funcLocId}
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
}
