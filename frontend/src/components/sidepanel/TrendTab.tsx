/**
 * TrendTab — sparkline chart of MIC results over time.
 * Built with a lightweight SVG polyline; no additional chart library needed.
 */

import React, { useMemo, useState } from 'react';
import { Select, SelectItem, Loading } from '@carbon/react';
import { useTrends, useLots } from '~/api/client';
import { useEM } from '~/context/EMContext';
import type { TimeWindow } from '~/types';

interface TrendTabProps {
  funcLocId: string;
}

const CHART_W = 340;
const CHART_H = 120;
const PAD = { top: 10, right: 10, bottom: 30, left: 40 };

const VALUATION_COLOUR: Record<string, string> = {
  A: '#24a148',
  R: '#da1e28',
  W: '#f1c21b',
};

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

export default function TrendTab({ funcLocId }: TrendTabProps) {
  const { timeWindow } = useEM();
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<TimeWindow>(timeWindow);

  // Derive available MIC names from lots data
  const { data: lots } = useLots(funcLocId, timeWindow);

  // Once we know which MIC is selected, fetch the trend
  const { data: trend, isLoading } = useTrends(funcLocId, selectedMic, windowDays);

  // Derive unique MIC names from lots (placeholder until unified view is wired)
  const micNames = useMemo<string[]>(() => {
    if (!lots || lots.length === 0) return [];
    // In real data, mic names come from the trend endpoint; use a placeholder list
    return ['Aerobic count', 'Yeast & mould', 'Enterobacteriaceae'];
  }, [lots]);

  if (isLoading) {
    return <Loading description="Loading trend…" withOverlay={false} small />;
  }

  const points = trend?.points ?? [];

  // Scale helpers
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const dates = points.map((p) => new Date(p.inspection_date).getTime());
  const values = points.map((p) => p.result_value ?? 0);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);

  const scaleX = (t: number) =>
    maxDate === minDate ? PAD.left : PAD.left + ((t - minDate) / (maxDate - minDate)) * innerW;
  const scaleY = (v: number) =>
    CHART_H - PAD.bottom - ((v - minVal) / (maxVal - minVal)) * innerH;

  const polylinePoints = points
    .map((p) => `${scaleX(new Date(p.inspection_date).getTime())},${scaleY(p.result_value ?? 0)}`)
    .join(' ');

  // Threshold lines from first point that has limits
  const limitPoint = points.find((p) => p.upper_limit !== null);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Select
          id="trend-mic"
          labelText="MIC"
          size="sm"
          value={selectedMic ?? ''}
          onChange={(e) => setSelectedMic(e.target.value || null)}
        >
          <SelectItem value="" text="Select MIC…" />
          {micNames.map((m) => (
            <SelectItem key={m} value={m} text={m} />
          ))}
        </Select>

        <Select
          id="trend-window"
          labelText="Window"
          size="sm"
          value={String(windowDays)}
          onChange={(e) => setWindowDays(Number(e.target.value) as TimeWindow)}
        >
          {WINDOWS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)} text={label} />
          ))}
        </Select>
      </div>

      {!selectedMic && (
        <p style={{ color: '#6f6f6f', fontSize: '0.875rem' }}>Select a MIC to view the trend.</p>
      )}

      {selectedMic && points.length === 0 && (
        <p style={{ color: '#6f6f6f', fontSize: '0.875rem' }}>No data in this window.</p>
      )}

      {selectedMic && points.length > 0 && (
        <svg width={CHART_W} height={CHART_H} style={{ overflow: 'visible' }}>
          {/* Upper limit line */}
          {limitPoint?.upper_limit !== undefined && limitPoint.upper_limit !== null && (
            <line
              x1={PAD.left}
              x2={CHART_W - PAD.right}
              y1={scaleY(limitPoint.upper_limit)}
              y2={scaleY(limitPoint.upper_limit)}
              stroke="#da1e28"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}

          {/* Trend polyline */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#0f62fe"
            strokeWidth={1.5}
          />

          {/* Data points coloured by valuation */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={scaleX(new Date(p.inspection_date).getTime())}
              cy={scaleY(p.result_value ?? 0)}
              r={3}
              fill={VALUATION_COLOUR[p.valuation ?? ''] ?? '#6f6f6f'}
            />
          ))}

          {/* X axis */}
          <line
            x1={PAD.left}
            x2={CHART_W - PAD.right}
            y1={CHART_H - PAD.bottom}
            y2={CHART_H - PAD.bottom}
            stroke="#e0e0e0"
          />
        </svg>
      )}
    </div>
  );
}
