import { useEffect, useState, useRef } from 'react';
import {
  Select, SelectItem, Toggle, Layer, Slider,
  IconButton, MultiSelect
} from '@carbon/react';
import { Play, Pause, Download } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import { useMics, useHeatmap } from '~/api/client';
import type { TimeWindow } from '~/types';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30,  label: 'Last 30 days' },
  { value: 60,  label: 'Last 60 days' },
  { value: 90,  label: 'Last 90 days' },
  { value: 180, label: 'Last 180 days' },
  { value: 365, label: 'Last 365 days' },
];

/** Compute days between a YYYY-MM-DD string and today (local time) */
function computeDaysSinceToday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const hDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - hDate.getTime()) / (1000 * 60 * 60 * 24));
}

export default function FilterBar() {
  const {
    activeFloor,
    timeWindow, setTimeWindow,
    heatmapMode, setHeatmapMode,
    historicalDate, setHistoricalDate,
    decayLambda, setDecayLambda,
    selectedMics, setSelectedMics,
  } = useEM();

  const { data: allMics = [] } = useMics();
  const { data: heatmapData } = useHeatmap(activeFloor, heatmapMode, timeWindow, historicalDate, decayLambda, selectedMics);

  const handleExport = () => {
    const markers = heatmapData?.markers;
    if (!markers?.length) return;
    const headers = ['Functional Location', 'Status', 'Risk Score', 'Fail Count', 'Total Lots', 'X%', 'Y%'];
    const rows = markers.map((m) => [m.func_loc_id, m.status, m.risk_score ?? '', m.fail_count, m.total_count, m.x_pos.toFixed(2), m.y_pos.toFixed(2)]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `em_heatmap_${activeFloor}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
  };
  const [isPlaying, setIsPlaying] = useState(false);

  // Mirror filter state in a ref so the playback interval always reads the
  // latest values without being recreated on every change.
  const stateRef = useRef({ timeWindow, historicalDate });
  stateRef.current = { timeWindow, historicalDate };

  // Clamp or clear historicalDate when timeWindow shrinks
  useEffect(() => {
    if (historicalDate && computeDaysSinceToday(historicalDate) > timeWindow) {
      setHistoricalDate(null);
    }
  }, [timeWindow, historicalDate, setHistoricalDate]);

  // Historical Playback Animation — interval depends only on isPlaying.
  useEffect(() => {
    if (!isPlaying) return;

    const { timeWindow: initialWindow, historicalDate: initialHd } = stateRef.current;
    let currentDays = initialHd
      ? Math.min(computeDaysSinceToday(initialHd), initialWindow)
      : initialWindow;
    if (currentDays <= 0) currentDays = initialWindow;

    const id = setInterval(() => {
      const currentWindow = stateRef.current.timeWindow;
      currentDays -= 1;
      if (currentDays > currentWindow) currentDays = currentWindow;
      if (currentDays < 0) {
        setIsPlaying(false);
        setHistoricalDate(null);
        return;
      }
      const d = new Date();
      d.setDate(d.getDate() - currentDays);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setHistoricalDate(`${year}-${month}-${day}`);
    }, 600);

    return () => clearInterval(id);
  }, [isPlaying, setHistoricalDate]);

  const handleSliderChange = ({ value }: { value: number }) => {
    if (isPlaying) setIsPlaying(false);
    if (value === 0) {
      setHistoricalDate(null);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - value);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setHistoricalDate(`${year}-${month}-${day}`);
    }
  };

  const getSliderValue = () => {
    if (!historicalDate) return 0;
    const diff = computeDaysSinceToday(historicalDate);
    return Math.min(Math.max(diff, 0), timeWindow);
  };

  return (
    <div className="em-filter-bar" role="region" aria-label="Heatmap filters">
      <Layer style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-05)', flex: 1 }}>
        <Select
          id="em-time-window"
          labelText="Time window"
          size="sm"
          inline
          value={String(timeWindow)}
          onChange={(e) => setTimeWindow(Number(e.target.value) as TimeWindow)}
          style={{ width: 'auto', minWidth: '10rem' }}
        >
          {TIME_WINDOWS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)} text={label} />
          ))}
        </Select>

        <div style={{ width: '14rem' }}>
          <MultiSelect
            id="em-mic-filter"
            label="All characteristic types"
            titleText=""
            items={allMics}
            selectedItems={selectedMics}
            onChange={({ selectedItems }) => setSelectedMics(selectedItems ?? [])}
            size="sm"
            type="inline"
          />
        </div>

        <Toggle
          id="em-heatmap-mode"
          labelText="Heatmap mode"
          labelA="Deterministic"
          labelB="Continuous"
          toggled={heatmapMode === 'continuous'}
          onToggle={(checked: boolean) =>
            setHeatmapMode(checked ? 'continuous' : 'deterministic')
          }
          size="sm"
        />

        {heatmapMode === 'continuous' && (
          <div className="em-filter-bar__slider" style={{ flex: 1, maxWidth: '14rem', marginLeft: 'var(--cds-spacing-05)' }}>
            <Slider
              id="risk-sensitivity"
              labelText={`Sensitivity (HL: ${Math.round(Math.log(2) / decayLambda)}d)`}
              max={0.5}
              min={0.01}
              step={0.01}
              value={decayLambda}
              onChange={({ value }) => setDecayLambda(value)}
              hideTextInput
            />
          </div>
        )}

        <div className="em-filter-bar__slider" style={{ flex: 1, maxWidth: '24rem', marginLeft: 'var(--cds-spacing-07)', display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03)' }}>
          <IconButton
            label={isPlaying ? 'Pause playback' : 'Play time-lapse'}
            kind="ghost"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause /> : <Play />}
          </IconButton>
          <Slider
            id="time-travel-scrub"
            labelText={historicalDate ? `Viewing: ${historicalDate}` : 'Scrub history (Today)'}
            max={timeWindow}
            min={0}
            step={1}
            value={getSliderValue()}
            onChange={handleSliderChange}
            hideTextInput
          />
        </div>

        <IconButton
          label="Export markers to CSV"
          kind="ghost"
          size="sm"
          align="bottom"
          onClick={handleExport}
          disabled={!heatmapData?.markers?.length}
        >
          <Download size={16} />
        </IconButton>
      </Layer>
    </div>
  );
}
