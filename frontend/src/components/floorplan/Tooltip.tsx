import { Tag } from '@carbon/react';
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

const TAG_TYPE: Record<string, 'green' | 'red' | 'magenta' | 'gray'> = {
  PASS:    'green',
  FAIL:    'red',
  PENDING: 'magenta',
  NO_DATA: 'gray',
};

export default function Tooltip({ marker, x, y }: TooltipProps) {
  const label = marker.func_loc_name ?? marker.func_loc_id;
  const status = STATUS_LABEL[marker.status] ?? marker.status;
  const tagType = TAG_TYPE[marker.status] ?? 'gray';

  return (
    <div
      className="em-tooltip"
      style={{ left: x + 12, top: y - 8 }}
      role="tooltip"
      aria-live="polite"
    >
      <div style={{ marginBottom: 'var(--cds-spacing-02)', fontWeight: 'var(--cds-font-weight-semibold, 600)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03)', marginBottom: 'var(--cds-spacing-03)' }}>
        <span style={{ color: 'var(--cds-text-inverse-placeholder)' }}>Status:</span>
        <Tag type={tagType} size="sm" style={{ margin: 0 }}>{status}</Tag>
      </div>
      {marker.total_count > 0 && (
        <div style={{ color: 'var(--cds-text-inverse)' }}>
          {marker.fail_count} fail / {marker.total_count} total
        </div>
      )}
      {marker.risk_score !== null && (
        <div style={{ marginTop: 'var(--cds-spacing-01)', color: 'var(--cds-text-inverse-placeholder)' }}>
          Risk score: {marker.risk_score?.toFixed(2)}
        </div>
      )}
    </div>
  );
}
