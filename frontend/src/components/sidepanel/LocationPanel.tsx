/**
 * LocationPanel — right-hand side panel shown when a marker is selected.
 */

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
      <Layer>
        <div className="em-side-panel__header">
          <div className="em-side-panel__header-content">
            <div>
              <p className="cds--label em-side-panel__label">
                Functional location
              </p>
              <p className="cds--heading-compact-01">{selectedLocId}</p>
            </div>
            <IconButton
              label="Close panel"
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
      </Layer>
    </div>
  );
}
