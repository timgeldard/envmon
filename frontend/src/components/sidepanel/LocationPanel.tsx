/**
 * LocationPanel — right-hand side panel shown when a marker is selected.
 */

import { Tabs, Tab, TabList, TabPanels, TabPanel, IconButton, Layer } from '@carbon/react';
import { Close, Maximize, Minimize } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import TrendTab from './TrendTab';
import LotsTab from './LotsTab';

export default function LocationPanel() {
  const { selectedLocId, setSelectedLocId, sidePanelExpanded, setSidePanelExpanded } = useEM();

  if (!selectedLocId) return null;

  return (
    <div
      className={`em-side-panel ${sidePanelExpanded ? 'em-side-panel--expanded' : ''}`}
      role="complementary"
      aria-label="Location detail"
    >
      <Layer>
        <div className="em-side-panel__header">
          <div className="em-side-panel__header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-04)' }}>
              <div>
                <p className="cds--label em-side-panel__label">
                  Functional location
                </p>
                <p className="cds--heading-compact-01">{selectedLocId}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)' }}>
              <IconButton
                label={sidePanelExpanded ? 'Collapse panel' : 'Expand panel'}
                kind="ghost"
                size="sm"
                onClick={() => setSidePanelExpanded(!sidePanelExpanded)}
              >
                {sidePanelExpanded ? <Minimize size={16} /> : <Maximize size={16} />}
              </IconButton>
              <IconButton
                label="Close panel"
                kind="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLocId(null);
                  setSidePanelExpanded(false);
                }}
              >
                <Close size={16} />
              </IconButton>
            </div>
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
      </Layer>
    </div>
  );
}
