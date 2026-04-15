import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  SkipToContent,
} from '@carbon/react';
import { Settings, Map } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import { useFloors } from '~/api/client';
import FilterBar from '~/components/controls/FilterBar';
import FloorPlan from '~/components/floorplan/FloorPlan';
import LocationPanel from '~/components/sidepanel/LocationPanel';
import CoordinateMapper from '~/components/admin/CoordinateMapper';

export default function AppShell() {
  const { activeFloor, setActiveFloor, selectedLocId, adminMode, setAdminMode } = useEM();
  const { data: floors = [] } = useFloors();
  const [sideNavExpanded, setSideNavExpanded] = useState(true);

  return (
    <div className="em-app">
      <SkipToContent />

      <Header aria-label="Environmental Monitoring">
        <HeaderName prefix="Kerry Seville">Environmental Monitoring</HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={adminMode ? 'Exit admin mode' : 'Admin: coordinate mapping'}
            isActive={adminMode}
            onClick={() => setAdminMode(!adminMode)}
            tooltipAlignment="end"
          >
            <Settings size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <div style={{ display: 'flex', height: 'calc(100vh - 3rem)', marginTop: '3rem' }}>
        <SideNav
          aria-label="Floor navigation"
          expanded={sideNavExpanded}
          isFixedNav
          style={{ width: '200px' }}
        >
          <SideNavItems>
            {floors.length === 0 && (
              <>
                {['F1', 'F2', 'F3'].map((id) => (
                  <SideNavLink
                    key={id}
                    renderIcon={Map}
                    isActive={activeFloor === id}
                    onClick={() => setActiveFloor(id)}
                  >
                    Floor {id.replace('F', '')}
                  </SideNavLink>
                ))}
              </>
            )}
            {floors.map((floor) => (
              <SideNavLink
                key={floor.floor_id}
                renderIcon={Map}
                isActive={activeFloor === floor.floor_id}
                onClick={() => setActiveFloor(floor.floor_id)}
              >
                {floor.floor_name}
                {floor.location_count > 0 && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.7 }}>
                    ({floor.location_count})
                  </span>
                )}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!adminMode && <FilterBar />}

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {adminMode ? (
              <CoordinateMapper />
            ) : (
              <FloorPlan />
            )}

            {selectedLocId && !adminMode && <LocationPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
