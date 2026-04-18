/**
 * Fabricated plant dataset for the exec-grid mockup.
 *
 * Values are hand-crafted to exercise the tier rule set (GREEN/AMBER/RED)
 * across the decision-driving scenarios the user called out:
 *   - data silence (coverage drop is what you want to catch)
 *   - leading indicator deterioration (SPC rising)
 *   - lagging lagging indicator (active fails)
 *
 * The only plant with a real floor plan is Seville (P225). All others are
 * POC stubs — clicking them shows a "no floor plan uploaded" state.
 */

export type Tier = 'GREEN' | 'AMBER' | 'RED';

export interface LastFail {
  mic: string;
  location: string;
  days_ago: number;
}

export interface MockPlant {
  id: string;
  name: string;
  region: string;
  country: string;
  tier: Tier;
  headline: string;
  coverage_pct: number;
  spc_warnings_active: number;
  spc_warnings_delta_7d: number;
  active_fails: number;
  last_inspection: string;
  last_fail?: LastFail;
  hasFloorplan: boolean;
}

// Tier thresholds — kept here so they're easy to tune while judging the mockup.
export const THRESHOLDS = {
  coverage_red: 30,    // coverage % below this -> RED
  coverage_amber: 70,  // coverage % below this -> AMBER (if not already RED)
  fails_red: 2,        // active fails at/above this -> RED
} as const;

export const MOCK_PLANTS: MockPlant[] = [
  {
    id: 'P118',
    name: 'Cork',
    region: 'Munster',
    country: 'Ireland',
    tier: 'RED',
    headline: '14 days without inspections',
    coverage_pct: 8,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: 0,
    active_fails: 0,
    last_inspection: '14 days ago',
    last_fail: { mic: 'Salmonella', location: 'Packing Line 2', days_ago: 42 },
    hasFloorplan: false,
  },
  {
    id: 'P142',
    name: 'Naas',
    region: 'Leinster',
    country: 'Ireland',
    tier: 'RED',
    headline: 'Listeria rising at 3 locations',
    coverage_pct: 94,
    spc_warnings_active: 4,
    spc_warnings_delta_7d: 3,
    active_fails: 1,
    last_inspection: '2 hours ago',
    last_fail: { mic: 'Listeria', location: 'Cold Store Drain', days_ago: 2 },
    hasFloorplan: false,
  },
  {
    id: 'P225',
    name: 'Seville',
    region: 'Andalucía',
    country: 'Spain',
    tier: 'AMBER',
    headline: '2 active SPC warnings (stable)',
    coverage_pct: 86,
    spc_warnings_active: 2,
    spc_warnings_delta_7d: 0,
    active_fails: 0,
    last_inspection: '4 hours ago',
    last_fail: { mic: 'ATP', location: 'Mixer 3 — Contact Surface', days_ago: 11 },
    hasFloorplan: true,
  },
  {
    id: 'P310',
    name: 'Listowel',
    region: 'Munster',
    country: 'Ireland',
    tier: 'AMBER',
    headline: '1 active fail awaiting retest',
    coverage_pct: 91,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: 0,
    active_fails: 1,
    last_inspection: '1 hour ago',
    last_fail: { mic: 'Listeria', location: 'Raw Material Intake', days_ago: 1 },
    hasFloorplan: false,
  },
  {
    id: 'P408',
    name: 'Charleville',
    region: 'Munster',
    country: 'Ireland',
    tier: 'AMBER',
    headline: 'Coverage 62% — inspection backlog',
    coverage_pct: 62,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: -1,
    active_fails: 0,
    last_inspection: '9 hours ago',
    last_fail: { mic: 'APC', location: 'Conveyor B Drain', days_ago: 19 },
    hasFloorplan: false,
  },
  {
    id: 'P502',
    name: 'Tralee',
    region: 'Munster',
    country: 'Ireland',
    tier: 'GREEN',
    headline: 'No active alerts',
    coverage_pct: 98,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: -2,
    active_fails: 0,
    last_inspection: '1 hour ago',
    last_fail: { mic: 'ATP', location: 'Mixer 1 — Housing', days_ago: 63 },
    hasFloorplan: false,
  },
  {
    id: 'P611',
    name: 'Killorglin',
    region: 'Munster',
    country: 'Ireland',
    tier: 'GREEN',
    headline: 'Baseline still calibrating',
    coverage_pct: 100,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: 0,
    active_fails: 0,
    last_inspection: '3 hours ago',
    hasFloorplan: false,
  },
  {
    id: 'P720',
    name: 'Portlaoise',
    region: 'Leinster',
    country: 'Ireland',
    tier: 'GREEN',
    headline: 'No active alerts',
    coverage_pct: 95,
    spc_warnings_active: 0,
    spc_warnings_delta_7d: 0,
    active_fails: 0,
    last_inspection: '30 minutes ago',
    last_fail: { mic: 'Listeria', location: 'Cold Store Drain', days_ago: 87 },
    hasFloorplan: false,
  },
];

const TIER_ORDER: Record<Tier, number> = { RED: 0, AMBER: 1, GREEN: 2 };

export function sortPlantsForExec(plants: MockPlant[]): MockPlant[] {
  return [...plants].sort((a, b) => {
    const t = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (t !== 0) return t;
    // Within tier: rank by severity proxy — more SPC deterioration + more
    // fails + lower coverage surface first.
    const sevA = a.spc_warnings_delta_7d * 3 + a.active_fails * 2 + (100 - a.coverage_pct) / 10;
    const sevB = b.spc_warnings_delta_7d * 3 + b.active_fails * 2 + (100 - b.coverage_pct) / 10;
    return sevB - sevA;
  });
}
