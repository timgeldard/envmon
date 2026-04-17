import { useEffect } from 'react';
import { Select, SelectItem, Toggle, Layer, Slider } from '@carbon/react';
import { useEM } from '~/context/EMContext';
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
  } = useEM();

  // Clamp or clear historicalDate when timeWindow shrinks
  useEffect(() => {
    if (historicalDate && computeDaysSinceToday(historicalDate) > timeWindow) {
      setHistoricalDate(null);
    }
  }, [timeWindow, historicalDate, setHistoricalDate]);

  const handleSliderChange = ({ value }: { value: number }) => {
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
    // Clamp to [0, timeWindow] to handle transient states during resize
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
        >
          {TIME_WINDOWS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)} text={label} />
          ))}
        </Select>

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
          <div style={{ flex: 1, maxWidth: '16rem', marginLeft: 'var(--cds-spacing-05)' }}>
            <Slider
              id="risk-sensitivity"
              labelText={`Risk sensitivity (Half-life: ${Math.round(Math.log(2) / decayLambda)}d)`}
              max={0.5}
              min={0.01}
              step={0.01}
              value={decayLambda}
              onChange={({ value }) => setDecayLambda(value)}
              hideTextInput
            />
          </div>
        )}

        <div style={{ flex: 1, maxWidth: '24rem', marginLeft: 'var(--cds-spacing-07)' }}>
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
