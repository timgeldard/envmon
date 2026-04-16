/**
 * Global filter state for the EM app.
 * Synced to URL search params so filters survive page refresh / sharing.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { HeatmapMode, TimeWindow } from '~/types';

interface EMState {
  activeFloor: string;
  timeWindow: TimeWindow;
  heatmapMode: HeatmapMode;
  selectedLocId: string | null;
  adminMode: boolean;
  sidePanelExpanded: boolean;
  theme: 'white' | 'g100';
  historicalDate: string | null;
}

interface EMActions {
  setActiveFloor: (floor: string) => void;
  setTimeWindow: (tw: TimeWindow) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setSelectedLocId: (id: string | null) => void;
  setAdminMode: (on: boolean) => void;
  setSidePanelExpanded: (on: boolean) => void;
  setTheme: (theme: 'white' | 'g100') => void;
  setHistoricalDate: (date: string | null) => void;
}

const EMContext = createContext<(EMState & EMActions) | null>(null);

function readSearchParam<T extends string>(key: string, fallback: T, valid: T[]): T {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get(key) as T | null;
  return v && valid.includes(v) ? v : fallback;
}

export function EMProvider({ children }: { children: React.ReactNode }) {
  const [activeFloor, setActiveFloorRaw] = useState<string>(
    () => new URLSearchParams(window.location.search).get('floor') ?? 'F1',
  );
  const [timeWindow, setTimeWindowRaw] = useState<TimeWindow>(
    () =>
      readSearchParam<string>('tw', '90', ['30', '60', '90', '180', '365']) as unknown as TimeWindow
      ?? 90,
  );
  const [heatmapMode, setHeatmapModeRaw] = useState<HeatmapMode>(
    () => readSearchParam<HeatmapMode>('mode', 'deterministic', ['deterministic', 'continuous']),
  );
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [sidePanelExpanded, setSidePanelExpanded] = useState(false);
  const [theme, setThemeRaw] = useState<'white' | 'g100'>(
    () => (readSearchParam<string>('theme', 'white', ['white', 'g100']) as 'white' | 'g100') ?? 'white',
  );
  const [historicalDate, setHistoricalDateRaw] = useState<string | null>(null);

  const pushParam = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set(key, value);
    window.history.replaceState(null, '', `?${sp}`);
  }, []);

  const setActiveFloor = useCallback(
    (floor: string) => {
      setActiveFloorRaw(floor);
      setSelectedLocId(null);
      pushParam('floor', floor);
    },
    [pushParam],
  );

  const setTimeWindow = useCallback(
    (tw: TimeWindow) => {
      setTimeWindowRaw(tw);
      pushParam('tw', String(tw));
    },
    [pushParam],
  );

  const setHeatmapMode = useCallback(
    (mode: HeatmapMode) => {
      setHeatmapModeRaw(mode);
      pushParam('mode', mode);
    },
    [pushParam],
  );

  const setTheme = useCallback(
    (newTheme: 'white' | 'g100') => {
      setThemeRaw(newTheme);
      pushParam('theme', newTheme);
    },
    [pushParam],
  );

  const setHistoricalDate = useCallback((date: string | null) => {
    setHistoricalDateRaw(date);
  }, []);

  const value = useMemo(
    () => ({
      activeFloor,
      timeWindow,
      heatmapMode,
      selectedLocId,
      adminMode,
      sidePanelExpanded,
      theme,
      historicalDate,
      setActiveFloor,
      setTimeWindow,
      setHeatmapMode,
      setSelectedLocId,
      setAdminMode,
      setSidePanelExpanded,
      setTheme,
      setHistoricalDate,
    }),
    [
      activeFloor, timeWindow, heatmapMode, selectedLocId, adminMode, sidePanelExpanded, theme, historicalDate,
      setActiveFloor, setTimeWindow, setHeatmapMode, setSelectedLocId, setAdminMode, setSidePanelExpanded, setTheme, setHistoricalDate,
    ],
  );

  return <EMContext.Provider value={value}>{children}</EMContext.Provider>;
}

export function useEM(): EMState & EMActions {
  const ctx = useContext(EMContext);
  if (!ctx) throw new Error('useEM must be used inside <EMProvider>');
  return ctx;
}
