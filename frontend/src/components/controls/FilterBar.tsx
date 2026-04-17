import { useEffect, useState, useRef } from 'react';
import {
  Select, SelectItem, Toggle, Layer, Slider,
  IconButton, MultiSelect
} from '@carbon/react';
import { Play, Pause } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import { useMics } from '~/api/client';
import type { TimeWindow } from '~/types';

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
    timeWindow, setTimeWindow,
    heatmapMode, setHeatmapMode,
    historicalDate, setHistoricalDate,
    decayLambda, setDecayLambda,
    selectedMics, setSelectedMics,
  } = useEM();

  const { data: allMics = [] } = useMics();
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clamp or clear historicalDate when timeWindow shrinks
  useEffect(() => {
    if (historicalDate && computeDaysSinceToday(historicalDate) > timeWindow) {
      setHistoricalDate(null);
    }
  }, [timeWindow, historicalDate, setHistoricalDate]);

  // Historical Playback Animation
  useEffect(() => {
    if (isPlaying) {
      // Start from current position or max if at 0
      let currentDays = historicalDate ? computeDaysSinceToday(historicalDate) : timeWindow;
      if (currentDays <= 0) currentDays = timeWindow;

      playbackRef.current = setInterval(() => {
        currentDays -= 1;
        if (currentDays < 0) {
          setIsPlaying(false);
          setHistoricalDate(null);
        } else {
          const d = new Date();
          d.setDate(d.getDate() - currentDays);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setHistoricalDate(`${year}-${month}-${day}`);
        }
      }, 600); // Speed of animation
    } else {
      if (playbackRef.current) clearInterval(playbackRef.current);
    }
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, timeWindow, setHistoricalDate, historicalDate]);

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
      </Layer>
    </div>
  );
}
