/**
 * CoordinateMapper — admin spatial authoring tool.
 *
 * Sidebar:
 *   - Cascading dropdowns filter unmapped locations by hierarchy levels 1–4
 *     (functional location format: L1-L2-L3-L4-L5, e.g. Q225-0101-SEV3-Z0-90)
 *   - Unmapped tab: filtered list of level-5 locations to drag onto the floor plan
 *   - Mapped tab: all placed locations with floor badge, un-map button, drag to reposition
 *
 * Canvas:
 *   - Floor dropdown in canvas header
 *   - Background <img key> reloads on floor switch
 *   - SVG overlay: drop target for sidebar drags + pointer-based repositioning of
 *     existing markers (HTML5 draggable is unreliable on SVG elements).
 *   - Markers are coloured by their current heatmap status (PASS/FAIL/WARNING/…).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tag, InlineNotification, Loading, Button,
  Tabs, Tab, TabList, TabPanels, TabPanel,
  Select, SelectItem, Search,
} from '@carbon/react';
import { TrashCan, Move } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import {
  useUnmappedLocations,
  useMappedLocations,
  useSaveCoordinate,
  useDeleteCoordinate,
  useFloors,
  useHeatmap,
} from '~/api/client';

const MARKER_R = 10;
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

const STATUS_CLASS: Record<string, string> = {
  PASS:    'em-marker--pass',
  FAIL:    'em-marker--fail',
  WARNING: 'em-marker--warning',
  PENDING: 'em-marker--pending',
  NO_DATA: 'em-marker--no-data',
};

// CSS fill vars keyed by status class, for text labels
const STATUS_FILL: Record<string, string> = {
  'em-marker--pass':    'var(--cds-support-success)',
  'em-marker--fail':    'var(--cds-support-error)',
  'em-marker--warning': 'var(--cds-support-warning)',
  'em-marker--pending': 'var(--cds-support-info)',
  'em-marker--no-data': 'var(--cds-text-placeholder)',
};

type DragSource = { funcLocId: string };

/** Parse a functional location into its hierarchy parts */
function parseLevels(funcLocId: string): string[] {
  return funcLocId.split('-');
}

/** Get a unique sorted list of values at a given level (0-indexed) from a set of IDs */
function levelsAt(ids: string[], levelIdx: number): string[] {
  const values = new Set<string>();
  for (const id of ids) {
    const parts = parseLevels(id);
    if (parts[levelIdx]) values.add(parts[levelIdx]);
  }
  return Array.from(values).sort();
}

export default function CoordinateMapper() {
  const { activeFloor, setActiveFloor, timeWindow } = useEM();
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: floors = [] } = useFloors();

  // Sync activeFloor if it's invalid (e.g. from a stale URL param)
  useEffect(() => {
    if (floors.length > 0) {
      const exists = floors.some((f) => f.floor_id === activeFloor);
      if (!exists) {
        setActiveFloor(floors[0].floor_id);
      }
    }
  }, [floors, activeFloor, setActiveFloor]);

  const currentFloor = useMemo(
    () => floors.find((f) => f.floor_id === activeFloor) || floors[0],
    [floors, activeFloor],
  );

  const viewWidth = currentFloor?.svg_width || DEFAULT_WIDTH;
  const viewHeight = currentFloor?.svg_height || DEFAULT_HEIGHT;

  // Heatmap status for alert colours on mapped markers
  const { data: heatmapData } = useHeatmap(activeFloor, 'deterministic', timeWindow);
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    heatmapData?.markers.forEach((marker) => m.set(marker.func_loc_id, marker.status));
    return m;
  }, [heatmapData]);

  // Hierarchy filter state (levels 1–4, 0-indexed as 0–3)
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');
  const [l4, setL4] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // HTML5 drag source (sidebar items → SVG drop)
  const [dragging, setDragging] = useState<DragSource | null>(null);

  // Pointer-based drag for repositioning existing SVG markers
  const [pointerDragging, setPointerDragging] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ cx: number; cy: number } | null>(null);

  const [notification, setNotification] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: unmapped = [], isLoading: loadingUnmapped } = useUnmappedLocations();
  const { data: mapped = [], isLoading: loadingMapped } = useMappedLocations();
  const { mutate: saveCoordinate, isPending: isSaving } = useSaveCoordinate();
  const { mutate: deleteCoordinate, isPending: isDeleting } = useDeleteCoordinate();

  const floorMapped = useMemo(
    () => mapped.filter((m) => m.floor_id === activeFloor),
    [mapped, activeFloor],
  );

  // ---------------------------------------------------------------------------
  // Cascading filter logic
  // ---------------------------------------------------------------------------

  const allIds = unmapped.map((u) => u.func_loc_id);

  const l1Options = useMemo(() => levelsAt(allIds, 0), [allIds]);

  const l2Ids = useMemo(
    () => (l1 ? allIds.filter((id) => parseLevels(id)[0] === l1) : allIds),
    [allIds, l1],
  );
  const l2Options = useMemo(() => levelsAt(l2Ids, 1), [l2Ids]);

  const l3Ids = useMemo(
    () => (l2 ? l2Ids.filter((id) => parseLevels(id)[1] === l2) : l2Ids),
    [l2Ids, l2],
  );
  const l3Options = useMemo(() => levelsAt(l3Ids, 2), [l3Ids]);

  const l4Ids = useMemo(
    () => (l3 ? l3Ids.filter((id) => parseLevels(id)[2] === l3) : l3Ids),
    [l3Ids, l3],
  );
  const l4Options = useMemo(() => levelsAt(l4Ids, 3), [l4Ids]);

  const filteredUnmapped = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return unmapped.filter((u) => {
      const parts = parseLevels(u.func_loc_id);
      if (l1 && parts[0] !== l1) return false;
      if (l2 && parts[1] !== l2) return false;
      if (l3 && parts[2] !== l3) return false;
      if (l4 && parts[3] !== l4) return false;
      if (lowerQuery && !u.func_loc_id.toLowerCase().includes(lowerQuery)) return false;
      return true;
    });
  }, [unmapped, l1, l2, l3, l4, searchQuery]);

  const filteredMapped = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return mapped.filter((m) => {
      if (lowerQuery && !m.func_loc_id.toLowerCase().includes(lowerQuery)) return false;
      return true;
    });
  }, [mapped, searchQuery]);

  const handleL1 = (v: string) => { setL1(v); setL2(''); setL3(''); setL4(''); };
  const handleL2 = (v: string) => { setL2(v); setL3(''); setL4(''); };
  const handleL3 = (v: string) => { setL3(v); setL4(''); };

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------

  const screenToSvgPct = useCallback(
    (clientX: number, clientY: number) => {
      const svgEl = svgRef.current;
      if (!svgEl) return null;
      const pt = svgEl.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return {
        x_pos: Math.round(Math.max(0, Math.min(100, (svgPt.x / viewWidth) * 100)) * 100) / 100,
        y_pos: Math.round(Math.max(0, Math.min(100, (svgPt.y / viewHeight) * 100)) * 100) / 100,
      };
    },
    [viewWidth, viewHeight],
  );

  const notify = (kind: 'success' | 'error', message: string) => {
    setNotification({ kind, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // HTML5 drag-and-drop — sidebar items dropped onto SVG canvas
  // ---------------------------------------------------------------------------

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
          onError: (err) => { notify('error', err.message); setDragging(null); },
        },
      );
    },
    [dragging, activeFloor, saveCoordinate, screenToSvgPct],
  );

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // ---------------------------------------------------------------------------
  // Pointer-based drag — repositioning existing SVG markers
  // HTML5 draggable is unreliable on SVG <g> elements; pointer events work
  // consistently across browsers and touch devices.
  // ---------------------------------------------------------------------------

  const handleMarkerPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, funcLocId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setPointerDragging(funcLocId);
      // Capture so pointermove/pointerup fire even when cursor leaves the element
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointerDragging) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (pos) {
        setPreviewPos({
          cx: (pos.x_pos / 100) * viewWidth,
          cy: (pos.y_pos / 100) * viewHeight,
        });
      }
    },
    [pointerDragging, screenToSvgPct, viewWidth, viewHeight],
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointerDragging) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (pos) {
        saveCoordinate(
          { func_loc_id: pointerDragging, floor_id: activeFloor, ...pos },
          {
            onSuccess: () => notify('success', `${pointerDragging} repositioned to (${pos.x_pos.toFixed(1)}%, ${pos.y_pos.toFixed(1)}%)`),
            onError: (err) => notify('error', err.message),
          },
        );
      }
      setPointerDragging(null);
      setPreviewPos(null);
    },
    [pointerDragging, activeFloor, saveCoordinate, screenToSvgPct],
  );

  const handleUnmap = (funcLocId: string) => {
    deleteCoordinate(funcLocId, {
      onSuccess: () => notify('success', `${funcLocId} removed from map`),
      onError: (err) => notify('error', err.message),
    });
  };

  const isAnyDragging = !!dragging || !!pointerDragging;

  return (
    <div className="em-mapper-container">
      <div className="em-mapper-sidebar">
        <Tabs>
          <TabList aria-label="Coordinate mapping tabs">
            <Tab>Unmapped ({filteredUnmapped.length})</Tab>
            <Tab>Mapped ({filteredMapped.length})</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className="em-hierarchy-filters">
                <Select
                  id="filter-l1"
                  labelText="Level 1"
                  size="sm"
                  value={l1}
                  onChange={(e) => handleL1(e.target.value)}
                >
                  <SelectItem value="" text="All" />
                  {l1Options.map((v) => <SelectItem key={v} value={v} text={v} />)}
                </Select>

                <Select
                  id="filter-l2"
                  labelText="Level 2"
                  size="sm"
                  value={l2}
                  onChange={(e) => handleL2(e.target.value)}
                  disabled={!l1}
                >
                  <SelectItem value="" text="All" />
                  {l2Options.map((v) => <SelectItem key={v} value={v} text={v} />)}
                </Select>

                <Select
                  id="filter-l3"
                  labelText="Level 3"
                  size="sm"
                  value={l3}
                  onChange={(e) => handleL3(e.target.value)}
                  disabled={!l2}
                >
                  <SelectItem value="" text="All" />
                  {l3Options.map((v) => <SelectItem key={v} value={v} text={v} />)}
                </Select>

                <Select
                  id="filter-l4"
                  labelText="Level 4"
                  size="sm"
                  value={l4}
                  onChange={(e) => setL4(e.target.value)}
                  disabled={!l3}
                >
                  <SelectItem value="" text="All" />
                  {l4Options.map((v) => <SelectItem key={v} value={v} text={v} />)}
                </Select>
              </div>

              <div className="em-mapper-search">
                <Search
                  id="mapper-search"
                  labelText="Search locations"
                  placeholder="Search by ID…"
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                />
              </div>

              <div className="em-hierarchy-count">
                {filteredUnmapped.length} location{filteredUnmapped.length !== 1 ? 's' : ''}
              </div>

              {loadingUnmapped && <Loading description="Loading…" withOverlay={false} small />}

              {!loadingUnmapped && filteredUnmapped.length === 0 && (
                <p style={{ color: 'var(--cds-text-secondary)', fontSize: 'var(--cds-label-01-font-size)' }}>
                  {unmapped.length === 0
                    ? 'All locations are mapped.'
                    : searchQuery
                      ? 'No locations match the selected filters or search.'
                      : 'No locations match the selected filters.'}
                </p>
              )}

              {filteredUnmapped.map((loc) => (
                <div
                  key={loc.func_loc_id}
                  className="em-draggable-id"
                  draggable
                  onDragStart={() => setDragging({ funcLocId: loc.func_loc_id })}
                  onDragEnd={() => setDragging(null)}
                  title="Drag onto floor plan to map"
                >
                  <Move size={12} style={{ marginRight: 'var(--cds-spacing-02)', verticalAlign: 'middle', flexShrink: 0 }} />
                  {loc.func_loc_id}
                </div>
              ))}
            </TabPanel>

            <TabPanel>
              {loadingMapped && <Loading description="Loading…" withOverlay={false} small />}

              {!loadingMapped && filteredMapped.length === 0 && (
                <p style={{ color: 'var(--cds-text-secondary)', fontSize: 'var(--cds-label-01-font-size)', marginTop: 'var(--cds-spacing-04)' }}>
                  {mapped.length === 0
                    ? 'No locations mapped yet.'
                    : searchQuery
                      ? 'No mapped locations match the search.'
                      : 'No mapped locations.'}
                </p>
              )}

              {filteredMapped.map((loc) => (
                <div key={loc.func_loc_id} className="em-mapped-row">
                  <div
                    className="em-draggable-id em-mapped-draggable"
                    draggable
                    onDragStart={() => setDragging({ funcLocId: loc.func_loc_id })}
                    onDragEnd={() => setDragging(null)}
                    title={`Floor ${loc.floor_id} — drag to reposition`}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Move size={12} style={{ marginRight: 'var(--cds-spacing-02)', verticalAlign: 'middle', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{loc.func_loc_id}</span>
                    <span className="em-floor-badge">{loc.floor_id}</span>
                  </div>
                  <Button
                    kind="danger--ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={TrashCan}
                    iconDescription="Remove mapping"
                    tooltipPosition="left"
                    onClick={() => handleUnmap(loc.func_loc_id)}
                    disabled={isDeleting}
                    style={{ flexShrink: 0 }}
                  />
                </div>
              ))}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      <div className="em-mapper-canvas">
        <div className="em-mapper-floor-bar">
          <Select
            id="mapper-floor-select"
            labelText="Select floor"
            hideLabel
            size="sm"
            value={activeFloor}
            onChange={(e) => setActiveFloor(e.target.value)}
            style={{ width: '140px' }}
          >
            {floors.map((f) => (
              <SelectItem key={f.floor_id} value={f.floor_id} text={f.floor_name} />
            ))}
          </Select>
          <span className="em-mapper-floor-count">
            {floorMapped.length} location{floorMapped.length !== 1 ? 's' : ''} on this floor
          </span>
        </div>

        {currentFloor?.svg_url && (
          <img
            key={currentFloor.svg_url}
            src={currentFloor.svg_url}
            alt={`${currentFloor.floor_name} plan`}
            style={{
              position: 'absolute',
              top: 'var(--cds-spacing-09)',
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: 'calc(100% - var(--cds-spacing-09))',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: 'var(--cds-spacing-09)',
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: 'calc(100% - var(--cds-spacing-09))',
            cursor: isAnyDragging ? 'crosshair' : 'default',
            overflow: 'visible',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
        >
          {floorMapped.map((loc) => {
            const cx = ((loc.x_pos ?? 0) / 100) * viewWidth;
            const cy = ((loc.y_pos ?? 0) / 100) * viewHeight;
            const isPointerMoving = pointerDragging === loc.func_loc_id;
            const status = statusMap.get(loc.func_loc_id) ?? 'NO_DATA';
            const markerClass = STATUS_CLASS[status] ?? STATUS_CLASS.NO_DATA;
            const labelFill = STATUS_FILL[markerClass] ?? 'var(--cds-text-placeholder)';

            return (
              <g
                key={loc.func_loc_id}
                style={{
                  cursor: isPointerMoving ? 'grabbing' : 'grab',
                  opacity: isPointerMoving ? 0.4 : 1,
                  touchAction: 'none',
                }}
                onPointerDown={(e) => handleMarkerPointerDown(e, loc.func_loc_id)}
              >
                {/* Transparent hit area for easier grabbing */}
                <circle cx={cx} cy={cy} r={MARKER_R + 6} fill="transparent" />
                {/* Halo */}
                <circle cx={cx} cy={cy} r={MARKER_R + 4} className={markerClass} opacity={0.18} />
                {/* Main circle */}
                <circle cx={cx} cy={cy} r={MARKER_R} className={markerClass} stroke="var(--cds-background)" strokeWidth={1.5} />
                {/* Label */}
                <text
                  x={cx}
                  y={cy - MARKER_R - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill={labelFill}
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {loc.func_loc_id}
                </text>
              </g>
            );
          })}

          {/* Preview ghost while pointer-dragging a marker */}
          {pointerDragging && previewPos && (
            <circle
              cx={previewPos.cx}
              cy={previewPos.cy}
              r={MARKER_R}
              fill="none"
              stroke="var(--cds-interactive-01)"
              strokeWidth={2}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}

          {/* Drop-zone hint for sidebar drags */}
          {dragging && (
            <rect
              x={0} y={0} width={viewWidth} height={viewHeight}
              fill="var(--cds-interactive-01)"
              opacity={0.05}
              stroke="var(--cds-interactive-01)"
              strokeWidth={8} strokeDasharray="24 12"
              pointerEvents="none"
            />
          )}
        </svg>

        {(isSaving || isDeleting) && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'var(--cds-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loading description="Saving…" withOverlay={false} />
          </div>
        )}

        {notification && (
          <div style={{
            position: 'absolute',
            top: 'calc(var(--cds-spacing-09) + var(--cds-spacing-04))',
            left: 'var(--cds-spacing-05)',
            right: 'var(--cds-spacing-05)',
            zIndex: 20,
          }}>
            <InlineNotification
              kind={notification.kind}
              title={notification.kind === 'success' ? 'Saved' : 'Error'}
              subtitle={notification.message}
              hideCloseButton
            />
          </div>
        )}

        {isAnyDragging && (
          <div style={{
            position: 'absolute', bottom: 'var(--cds-spacing-05)', left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 20,
          }}>
            <Tag type="blue">
              {dragging
                ? `Drop to place ${dragging.funcLocId} on ${currentFloor?.floor_name || activeFloor}`
                : `Drag to reposition ${pointerDragging}`}
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
}
