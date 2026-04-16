/**
 * LotsTab — inspection lots list with expandable MIC results.
 * Uses Carbon Table directly. MIC detail uses StructuredList.
 */

import React, { useState } from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  Tag,
  Loading,
} from '@carbon/react';
import { useLots, useLotDetail } from '~/api/client';
import { useEM } from '~/context/EMContext';
import type { InspectionLot } from '~/types';

interface LotsTabProps {
  funcLocId: string;
}

const STATUS_KIND: Record<string, 'red' | 'green' | 'yellow' | 'gray'> = {
  FAIL:    'red',
  PASS:    'green',
  PENDING: 'yellow',
  NO_DATA: 'gray',
};

const MIC_VALUATION_KIND: Record<string, 'red' | 'green' | 'yellow' | 'gray'> = {
  R: 'red',
  A: 'green',
  W: 'yellow',
};

function LotRow({ lot }: { lot: InspectionLot }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useLotDetail(expanded ? lot.lot_id : null);

  return (
    <>
      <TableRow
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <TableCell>{lot.lot_id}</TableCell>
        <TableCell>{lot.inspection_start_date ?? '—'}</TableCell>
        <TableCell>
          <Tag type={STATUS_KIND[lot.status] ?? 'gray'} size="sm">
            {lot.status}
          </Tag>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell
            colSpan={3}
            style={{
              background: 'var(--cds-layer-01)',
              padding: 'var(--cds-spacing-03) var(--cds-spacing-05)',
            }}
          >
            {isLoading && (
              <Loading description="Loading MIC results…" withOverlay={false} small />
            )}
            {detail && detail.mic_results.length === 0 && (
              <p className="cds--label" style={{ color: 'var(--cds-text-secondary)' }}>
                No MIC results.
              </p>
            )}
            {detail && detail.mic_results.length > 0 && (
              <StructuredListWrapper isCondensed aria-label="MIC results">
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head>MIC</StructuredListCell>
                    <StructuredListCell head>Result</StructuredListCell>
                    <StructuredListCell head>Limit</StructuredListCell>
                    <StructuredListCell head>Val.</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  {detail.mic_results.map((mic) => (
                    <StructuredListRow key={mic.mic_id}>
                      <StructuredListCell>{mic.mic_name}</StructuredListCell>
                      <StructuredListCell noWrap>{mic.result_value ?? '—'}</StructuredListCell>
                      <StructuredListCell noWrap>{mic.upper_limit ?? '—'}</StructuredListCell>
                      <StructuredListCell>
                        <Tag type={MIC_VALUATION_KIND[mic.valuation ?? ''] ?? 'gray'} size="sm">
                          {mic.valuation ?? '?'}
                        </Tag>
                      </StructuredListCell>
                    </StructuredListRow>
                  ))}
                </StructuredListBody>
              </StructuredListWrapper>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function LotsTab({ funcLocId }: LotsTabProps) {
  const { timeWindow } = useEM();
  const { data: lots = [], isLoading } = useLots(funcLocId, timeWindow);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--cds-spacing-05)' }}>
        <Loading description="Loading lots…" withOverlay={false} small />
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <p
        className="cds--body-short-01"
        style={{ padding: 'var(--cds-spacing-05)', color: 'var(--cds-text-secondary)' }}
      >
        No inspection lots in this time window.
      </p>
    );
  }

  return (
    <Table size="sm" useZebraStyles aria-label="Inspection lots">
      <TableHead>
        <TableRow>
          <TableHeader>Lot ID</TableHeader>
          <TableHeader>Start date</TableHeader>
          <TableHeader>Status</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {lots.map((lot) => (
          <LotRow key={lot.lot_id} lot={lot} />
        ))}
      </TableBody>
    </Table>
  );
}
