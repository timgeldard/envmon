import React from 'react';
import { Select, SelectItem, Toggle } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import type { HeatmapMode, TimeWindow } from '~/types';

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 180 days' },
  { value: 365, label: 'Last 365 days' },
];

export default function FilterBar() {
  const { timeWindow, setTimeWindow, heatmapMode, setHeatmapMode } = useEM();

  return (
    <div className="em-filter-bar">
      <Select
        id="em-time-window"
        labelText="Time window"
        hideLabel
        size="sm"
        value={String(timeWindow)}
        onChange={(e) => setTimeWindow(Number(e.target.value) as TimeWindow)}
        style={{ minWidth: '160px' }}
      >
        {TIME_WINDOWS.map(({ value, label }) => (
          <SelectItem key={value} value={String(value)} text={label} />
        ))}
      </Select>

      <Toggle
        id="em-heatmap-mode"
        labelText="Heatmap mode"
        labelA="Worst-case"
        labelB="Risk density"
        toggled={heatmapMode === 'continuous'}
        onToggle={(checked: boolean) =>
          setHeatmapMode(checked ? 'continuous' : 'deterministic')
        }
        size="sm"
      />
    </div>
  );
}
