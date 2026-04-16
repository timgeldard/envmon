/**
 * LotsTab — inspection lots list with expandable MIC results.
 * Uses Carbon Table directly. MIC detail uses StructuredList.
 */

import { useState } from 'react';
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
  DataTableSkeleton,
  SkeletonText,
  Layer,
} from '@carbon/react';
import { useLots, useLotDetail } from '~/api/client';
import { useEM } from '~/context/EMContext';
import type { InspectionLot } from '~/types';

interface LotsTabProps {
  funcLocId: string;
}

const STATUS_KIND: Record<string, 'red' | 'green' | 'warm-gray' | 'gray'> = {
  FAIL:    'red',
  PASS:    'green',
  PENDING: 'warm-gray',
  NO_DATA: 'gray',
};

const MIC_VALUATION_KIND: Record<string, 'red' | 'green' | 'warm-gray' | 'gray'> = {
  R: 'red',
  A: 'green',
  W: 'warm-gray',
};

function LotRow({ lot }: { lot: InspectionLot }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useLotDetail(expanded ? lot.lot_id : null);

  return (
    <>
      <TableRow
        className="em-clickable-row"
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
          <TableCell colSpan={3} className="em-expanded-row-cell">
            <Layer>
              <div className="em-expanded-row-content">
                {isLoading && (
                  <div style={{ padding: 'var(--cds-spacing-03) 0' }}>
                    <SkeletonText paragraph lineCount={3} />
                  </div>
                )}
                {detail && detail.mic_results.length === 0 && (
                  <p className="cds--label em-side-panel__label">
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
              </div>
            </Layer>
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
      <div className="em-tab-content" style={{ paddingTop: 0 }}>
        <DataTableSkeleton
          columnCount={3}
          rowCount={5}
          headers={[
            { key: 'id', header: 'Lot ID' },
            { key: 'date', header: 'Start date' },
            { key: 'status', header: 'Status' },
          ]}
          size="sm"
        />
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <p className="cds--body-short-01 em-tab-content em-secondary-text">
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
