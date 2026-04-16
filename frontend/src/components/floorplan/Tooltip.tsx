import React from 'react';
import type { MarkerData } from '~/types';

interface TooltipProps {
  marker: MarkerData;
  x: number;
  y: number;
}

const STATUS_LABEL: Record<string, string> = {
  PASS:    'Pass',
  FAIL:    'Fail',
  PENDING: 'Pending',
  NO_DATA: 'No data',
};

export default function Tooltip({ marker, x, y }: TooltipProps) {
  const label = marker.func_loc_name ?? marker.func_loc_id;
  const status = STATUS_LABEL[marker.status] ?? marker.status;

  return (
    <div
      className="em-tooltip"
      style={{ left: x + 12, top: y - 8 }}
      role="tooltip"
      aria-live="polite"
    >
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div>Status: {status}</div>
      {marker.total_count > 0 && (
        <div>
          {marker.fail_count} fail / {marker.total_count} total
        </div>
      )}
      {marker.risk_score !== null && (
        <div>Risk score: {marker.risk_score?.toFixed(2)}</div>
      )}
    </div>
  );
}
