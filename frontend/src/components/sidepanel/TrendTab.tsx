/**
 * TrendTab — MIC result trend chart using Carbon design tokens throughout.
 */

import { useState } from 'react';
import { Select, SelectItem, Loading } from '@carbon/react';
import { useTrends, useMics } from '~/api/client';
import { useEM } from '~/context/EMContext';
import type { TimeWindow } from '~/types';

interface TrendTabProps {
  funcLocId: string;
}

const CHART_W = 320;
const CHART_H = 140;
const PAD = { top: 12, right: 12, bottom: 32, left: 44 };

/**
 * Valuation colour tokens:
 *   A = Accept  → support-success (green)
 *   R = Reject  → support-error   (red)
 *   W = Warning → support-warning (yellow)
 */
const VALUATION_TOKEN: Record<string, string> = {
  A: 'var(--cds-support-success)',
  R: 'var(--cds-support-error)',
  W: 'var(--cds-support-warning)',
};

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30,  label: '30 days' },
  { value: 60,  label: '60 days' },
  { value: 90,  label: '90 days' },
];

export default function TrendTab({ funcLocId }: TrendTabProps) {
  const { timeWindow } = useEM();
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [windowDays, setWindowDays]   = useState<TimeWindow>(timeWindow);

  const { data: micNames = [] } = useMics(funcLocId);
  const { data: trend, isLoading } = useTrends(funcLocId, selectedMic, windowDays);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--cds-spacing-05)' }}>
        <Loading description="Loading trend…" withOverlay={false} small />
      </div>
    );
  }

  const points = trend?.points ?? [];
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top  - PAD.bottom;

  const dates  = points.map((p) => new Date(p.inspection_date).getTime());
  const values = points.map((p) => p.result_value ?? 0);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minVal  = Math.min(...values, 0);
  const maxVal  = Math.max(...values, 1);

  const scaleX = (t: number) =>
    maxDate === minDate
      ? PAD.left + innerW / 2
      : PAD.left + ((t - minDate) / (maxDate - minDate)) * innerW;

  const scaleY = (v: number) =>
    CHART_H - PAD.bottom - ((v - minVal) / (maxVal - minVal)) * innerH;

  const polylinePoints = points
    .map((p) => `${scaleX(new Date(p.inspection_date).getTime())},${scaleY(p.result_value ?? 0)}`)
    .join(' ');

  const limitPoint = points.find((p) => p.upper_limit !== null);

  const tickDates = points.length > 1
    ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
    : points;

  return (
    <div style={{ padding: 'var(--cds-spacing-05)' }}>
      <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)', marginBottom: 'var(--cds-spacing-05)' }}>
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
        <p className="cds--body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
          Select a MIC to view the trend.
        </p>
      )}

      {selectedMic && points.length === 0 && (
        <p className="cds--body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
          No data in this window.
        </p>
      )}

      {selectedMic && points.length > 0 && (
        <svg
          width={CHART_W}
          height={CHART_H}
          aria-label={`Trend chart for ${selectedMic}`}
          role="img"
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* Upper limit line */}
          {limitPoint?.upper_limit != null && (
            <line
              x1={PAD.left} x2={CHART_W - PAD.right}
              y1={scaleY(limitPoint.upper_limit)}
              y2={scaleY(limitPoint.upper_limit)}
              stroke="var(--cds-support-error)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}

          {/* Trend line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="var(--cds-interactive)"
            strokeWidth={1.5}
          />

          {/* Data points coloured by valuation */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={scaleX(new Date(p.inspection_date).getTime())}
              cy={scaleY(p.result_value ?? 0)}
              r={3}
              fill={VALUATION_TOKEN[p.valuation ?? ''] ?? 'var(--cds-text-placeholder)'}
            />
          ))}

          {/* X axis */}
          <line
            x1={PAD.left} x2={CHART_W - PAD.right}
            y1={CHART_H - PAD.bottom} y2={CHART_H - PAD.bottom}
            stroke="var(--cds-border-subtle-01)"
          />

          {/* Y axis */}
          <line
            x1={PAD.left} x2={PAD.left}
            y1={PAD.top} y2={CHART_H - PAD.bottom}
            stroke="var(--cds-border-subtle-01)"
          />

          {/* Date ticks */}
          {tickDates.map((p, i) => {
            const tx = scaleX(new Date(p.inspection_date).getTime());
            const dateStr = new Date(p.inspection_date).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short',
            });
            return (
              <g key={i}>
                <line
                  x1={tx} x2={tx}
                  y1={CHART_H - PAD.bottom}
                  y2={CHART_H - PAD.bottom + 4}
                  stroke="var(--cds-border-subtle-01)"
                />
                <text
                  x={tx}
                  y={CHART_H - PAD.bottom + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--cds-text-secondary)"
                >
                  {dateStr}
                </text>
              </g>
            );
          })}

          {/* Y axis labels */}
          <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fontSize={9} fill="var(--cds-text-secondary)">
            {maxVal.toFixed(1)}
          </text>
          <text x={PAD.left - 4} y={CHART_H - PAD.bottom} textAnchor="end" fontSize={9} fill="var(--cds-text-secondary)">
            {minVal.toFixed(1)}
          </text>
        </svg>
      )}
    </div>
  );
}
