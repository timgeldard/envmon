import React from 'react';
import { Select, SelectItem, ContentSwitcher, Switch } from '@carbon/react';
import { useEM } from '~/context/EMContext';
import type { TimeWindow } from '~/types';

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30,  label: 'Last 30 days' },
  { value: 60,  label: 'Last 60 days' },
  { value: 90,  label: 'Last 90 days' },
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
        size="sm"
        value={String(timeWindow)}
        onChange={(e) => setTimeWindow(Number(e.target.value) as TimeWindow)}
      >
        {TIME_WINDOWS.map(({ value, label }) => (
          <SelectItem key={value} value={String(value)} text={label} />
        ))}
      </Select>

      <ContentSwitcher
        size="sm"
        selectedIndex={heatmapMode === 'deterministic' ? 0 : 1}
        onChange={({ index }: { index: number }) =>
          setHeatmapMode(index === 0 ? 'deterministic' : 'continuous')
        }
      >
        <Switch name="deterministic" text="Worst-case" />
        <Switch name="continuous"    text="Risk density" />
      </ContentSwitcher>
    </div>
  );
}
