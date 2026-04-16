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
 *   - SVG overlay: drop target + existing mapped markers (draggable to reposition)
 *   - Drop coordinates → viewBox % via getScreenCTM() (same space as FloorPlan)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
} from '~/api/client';
import floor1Url from '~/assets/floor1.svg?url';
import floor2Url from '~/assets/floor2.svg?url';
import floor3Url from '~/assets/floor3.svg?url';

const FLOOR_SVG: Record<string, string> = {
  F1: floor1Url,
  F2: floor2Url,
  F3: floor3Url,
};

const FLOOR_LABELS: Record<string, string> = {
  F1: 'Floor 1',
  F2: 'Floor 2',
  F3: 'Floor 3',
};

const SVG_WIDTH = 1021.6;
const SVG_HEIGHT = 722.48;
const MARKER_R = 10;
const MARKER_COLOURS: Record<string, string> = {
  F1: '#0f62fe',
  F2: '#8a3ffc',
  F3: '#007d79',
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
  const { activeFloor, setActiveFloor } = useEM();
  const svgRef = useRef<SVGSVGElement>(null);

  // Hierarchy filter state (levels 1–4, 0-indexed as 0–3)
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');
  const [l4, setL4] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [notification, setNotification] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: unmapped = [], isLoading: loadingUnmapped } = useUnmappedLocations();
  const { data: mapped = [], isLoading: loadingMapped } = useMappedLocations();
  const { mutate: saveCoordinate, isPending: isSaving } = useSaveCoordinate();
  const { mutate: deleteCoordinate, isPending: isDeleting } = useDeleteCoordinate();

  const floorMapped = mapped.filter((m) => m.floor_id === activeFloor);

  // ---------------------------------------------------------------------------
  // Cascading filter logic
  // ---------------------------------------------------------------------------

  const allIds = unmapped.map((u) => u.func_loc_id);

  // Level 1 options: all distinct values
  const l1Options = useMemo(() => levelsAt(allIds, 0), [allIds]);

  // Level 2 options: filtered by selected l1
  const l2Ids = useMemo(
    () => (l1 ? allIds.filter((id) => parseLevels(id)[0] === l1) : allIds),
    [allIds, l1],
  );
  const l2Options = useMemo(() => levelsAt(l2Ids, 1), [l2Ids]);

  // Level 3 options: filtered by l1 + l2
  const l3Ids = useMemo(
    () => (l2 ? l2Ids.filter((id) => parseLevels(id)[1] === l2) : l2Ids),
    [l2Ids, l2],
  );
  const l3Options = useMemo(() => levelsAt(l3Ids, 2), [l3Ids]);

  // Level 4 options: filtered by l1 + l2 + l3
  const l4Ids = useMemo(
    () => (l3 ? l3Ids.filter((id) => parseLevels(id)[2] === l3) : l3Ids),
    [l3Ids, l3],
  );
  const l4Options = useMemo(() => levelsAt(l4Ids, 3), [l4Ids]);

  // Final filtered list (level 5 locations after all filters applied)
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

  // Reset child filters when parent changes
  const handleL1 = (v: string) => { setL1(v); setL2(''); setL3(''); setL4(''); };
  const handleL2 = (v: string) => { setL2(v); setL3(''); setL4(''); };
  const handleL3 = (v: string) => { setL3(v); setL4(''); };

  // ---------------------------------------------------------------------------
  // Drop handling
  // ---------------------------------------------------------------------------

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

  const notify = (kind: 'success' | 'error', message: string) => {
    setNotification({ kind, message });
    setTimeout(() => setNotification(null), 3000);
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
          onError: (err) => { notify('error', err.message); setDragging(null); },
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
          <TabList aria-label="Coordinate mapping tabs">
            <Tab>Unmapped ({filteredUnmapped.length})</Tab>
            <Tab>Mapped ({filteredMapped.length})</Tab>
          </TabList>

          <TabPanels>
            {/* Unmapped tab */}
            <TabPanel>
              {/* Cascading hierarchy filters */}
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
                <p style={{ color: '#6f6f6f', fontSize: '0.8rem' }}>
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

            {/* Mapped tab */}
            <TabPanel>
              {loadingMapped && <Loading description="Loading…" withOverlay={false} small />}

              {!loadingMapped && filteredMapped.length === 0 && (
                <p style={{ color: '#6f6f6f', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                  {mapped.length === 0
                    ? 'No locations mapped yet.'
                    : 'No mapped locations match the search.'}
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

      {/* ------------------------------------------------------------------ */}
      {/* Floor plan canvas                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-canvas">
        {/* Floor selector */}
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
            {Object.entries(FLOOR_LABELS).map(([id, label]) => (
              <SelectItem key={id} value={id} text={label} />
            ))}
          </Select>
          <span className="em-mapper-floor-count">
            {floorMapped.length} location{floorMapped.length !== 1 ? 's' : ''} on this floor
          </span>
        </div>

        {/* Background floor plan — below the floor bar */}
        <img
          key={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
          src={FLOOR_SVG[activeFloor] ?? FLOOR_SVG['F1']}
          alt={`Floor ${activeFloor} plan`}
          style={{
            position: 'absolute',
            top: '2.5rem',
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: 'calc(100% - 2.5rem)',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            pointerEvents: 'none',
          }}
        />

        {/* SVG overlay — drop target + marker display */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: '2.5rem',
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: 'calc(100% - 2.5rem)',
            cursor: dragging ? 'crosshair' : 'default',
            overflow: 'visible',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {floorMapped.map((loc) => {
            const cx = ((loc.x_pos ?? 0) / 100) * SVG_WIDTH;
            const cy = ((loc.y_pos ?? 0) / 100) * SVG_HEIGHT;
            const isBeingDragged = dragging?.funcLocId === loc.func_loc_id;
            return (
              <g
                key={loc.func_loc_id}
                style={{ cursor: 'grab', opacity: isBeingDragged ? 0.3 : 1 }}
                {...({ draggable: true } as any)}
                onDragStart={() => setDragging({ funcLocId: loc.func_loc_id })}
                onDragEnd={() => setDragging(null)}
              >
                <circle cx={cx} cy={cy} r={MARKER_R + 4} fill={markerColour} opacity={0.15} />
                <circle cx={cx} cy={cy} r={MARKER_R} fill={markerColour} stroke="#ffffff" strokeWidth={1.5} />
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

          {dragging && (
            <rect
              x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT}
              fill="rgba(15,98,254,0.04)"
              stroke="#0f62fe" strokeWidth={8} strokeDasharray="24 12"
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
          <div style={{ position: 'absolute', top: '3.5rem', left: '1rem', right: '1rem', zIndex: 20 }}>
            <InlineNotification
              kind={notification.kind}
              title={notification.kind === 'success' ? 'Saved' : 'Error'}
              subtitle={notification.message}
              hideCloseButton
            />
          </div>
        )}

        {dragging && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none', zIndex: 20,
          }}>
            <Tag type="blue">Drop to place {dragging.funcLocId} on {FLOOR_LABELS[activeFloor]}</Tag>
          </div>
        )}
      </div>
    </div>
  );
}
