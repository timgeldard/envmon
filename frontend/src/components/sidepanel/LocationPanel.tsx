/**
 * LocationPanel — right-hand side panel shown when a marker is selected.
 * Contains Trend and Lots tabs per URS-D01.
 */

import React, { useState } from 'react';
import { Tabs, Tab, TabList, TabPanels, TabPanel, IconButton } from '@carbon/react';
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
            <div style={{ fontSize: '0.75rem', color: '#6f6f6f', marginBottom: '0.25rem' }}>
              Functional location
            </div>
            <div style={{ fontWeight: 600 }}>{selectedLocId}</div>
          </div>
          <IconButton
            label="Close"
            kind="ghost"
            size="sm"
            onClick={() => setSelectedLocId(null)}
          >
            <Close size={16} />
          </IconButton>
        </div>
      </div>

      <div className="em-side-panel__body">
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
      </div>
    </div>
  );
}
