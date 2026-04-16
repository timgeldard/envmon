/**
 * LocationPanel — right-hand side panel shown when a marker is selected.
 */

import React from 'react';
import { Tabs, Tab, TabList, TabPanels, TabPanel, IconButton, Layer } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import TrendTab from './TrendTab';
import LotsTab from './LotsTab';

export default function LocationPanel() {
  const { selectedLocId, setSelectedLocId } = useEM();

  if (!selectedLocId) return null;

  return (
    <div className="em-side-panel" role="complementary" aria-label="Location detail">
      <div className="em-side-panel__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p
              className="cds--label"
              style={{ marginBottom: 'var(--cds-spacing-02)', color: 'var(--cds-text-secondary)' }}
            >
              Functional location
            </p>
            <p className="cds--heading-compact-01">{selectedLocId}</p>
          </div>
          <IconButton
            label="Close panel"
            renderIcon={Close}
            kind="ghost"
            size="sm"
            onClick={() => setSelectedLocId(null)}
          />
        </div>
      </div>

      <div className="em-side-panel__body">
        <Layer>
          <Tabs>
            <TabList aria-label="Location detail tabs">
              <Tab>Trend</Tab>
              <Tab>Lots</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <TrendTab funcLocId={selectedLocId} />
              </TabPanel>
              <TabPanel>
                <LotsTab funcLocId={selectedLocId} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Layer>
      </div>
    </div>
  );
}
