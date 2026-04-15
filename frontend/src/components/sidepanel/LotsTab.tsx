/**
 * LotsTab — list of inspection lots for the selected location.
 * Clicking a lot expands its MIC results.
 */

import React, { useState } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
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
  FAIL: 'red',
  PASS: 'green',
  PENDING: 'yellow',
  NO_DATA: 'gray',
};

function LotRow({ lot }: { lot: InspectionLot }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useLotDetail(expanded ? lot.lot_id : null);

  return (
    <>
      <TableRow
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
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
          <TableCell colSpan={3} style={{ background: '#f4f4f4', padding: '0.5rem 1rem' }}>
            {isLoading && <Loading description="Loading MIC results…" withOverlay={false} small />}
            {detail && detail.mic_results.length === 0 && (
              <p style={{ color: '#6f6f6f', fontSize: '0.8rem' }}>No MIC results.</p>
            )}
            {detail && detail.mic_results.length > 0 && (
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.25rem' }}>MIC</th>
                    <th style={{ textAlign: 'right', padding: '0.25rem' }}>Result</th>
                    <th style={{ textAlign: 'right', padding: '0.25rem' }}>Limit</th>
                    <th style={{ padding: '0.25rem' }}>Val.</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.mic_results.map((mic) => (
                    <tr key={mic.mic_id}>
                      <td style={{ padding: '0.25rem' }}>{mic.mic_name}</td>
                      <td style={{ textAlign: 'right', padding: '0.25rem' }}>
                        {mic.result_value ?? '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.25rem' }}>
                        {mic.upper_limit ?? '—'}
                      </td>
                      <td style={{ padding: '0.25rem' }}>
                        <Tag type={STATUS_KIND[mic.valuation === 'R' ? 'FAIL' : mic.valuation === 'A' ? 'PASS' : 'NO_DATA'] ?? 'gray'} size="sm">
                          {mic.valuation ?? '?'}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    return <Loading description="Loading lots…" withOverlay={false} small />;
  }

  if (lots.length === 0) {
    return (
      <p style={{ padding: '1rem', color: '#6f6f6f', fontSize: '0.875rem' }}>
        No inspection lots in this time window.
      </p>
    );
  }

  return (
    <DataTable rows={[]} headers={[]}>
      {() => (
        <Table size="sm" useZebraStyles>
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
      )}
    </DataTable>
  );
}
