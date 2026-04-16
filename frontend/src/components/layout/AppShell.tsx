import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderMenuButton,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Content,
} from '@carbon/react';
import { Settings, Map, Sun, Moon } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import { useFloors } from '~/api/client';
import FilterBar from '~/components/controls/FilterBar';
import FloorPlan from '~/components/floorplan/FloorPlan';
import LocationPanel from '~/components/sidepanel/LocationPanel';
import CoordinateMapper from '~/components/admin/CoordinateMapper';

export default function AppShell() {
  const {
    activeFloor, setActiveFloor, selectedLocId,
    adminMode, setAdminMode,
    theme, setTheme,
  } = useEM();
  const { data: floors = [] } = useFloors();
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(true);

  const floorList = floors.length > 0
    ? floors
    : ['F1', 'F2', 'F3'].map((id) => ({
        floor_id: id,
        floor_name: `Floor ${id.replace('F', '')}`,
        location_count: 0,
      }));

  return (
    <div
      className={`em-app ${theme === 'g100' ? 'cds--g100' : ''}`}
      style={{
        '--shell-header-height': 'var(--cds-spacing-09, 3rem)',
        '--admin-banner-height': 'var(--cds-spacing-07, 2rem)',
        '--side-nav-width': isSideNavExpanded && !adminMode ? '16rem' : '0rem',
      } as React.CSSProperties}
    >
      <SkipToContent href="#main-content" />

      <Header aria-label="Environmental Monitoring">
        {!adminMode && (
          <HeaderMenuButton
            aria-label={isSideNavExpanded ? 'Close navigation' : 'Open navigation'}
            isActive={isSideNavExpanded}
            onClick={() => setIsSideNavExpanded((v) => !v)}
          />
        )}
        <HeaderName prefix="Kerry">Environmental Monitoring</HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={theme === 'g100' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'g100' ? 'white' : 'g100')}
            tooltipAlignment="end"
          >
            {theme === 'g100' ? <Sun size={20} /> : <Moon size={20} />}
          </HeaderGlobalAction>
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

      {adminMode && (
        <div className="em-admin-banner" role="status">
          Admin mode — Coordinate Mapping
        </div>
      )}

      {!adminMode && (
        <SideNav
          aria-label="Floor navigation"
          expanded={isSideNavExpanded}
          isFixedNav
        >
          <SideNavItems>
            {floorList.map((floor) => (
              <SideNavLink
                key={floor.floor_id}
                renderIcon={Map}
                isActive={activeFloor === floor.floor_id}
                onClick={() => setActiveFloor(floor.floor_id)}
              >
                {floor.floor_name}
                {floor.location_count > 0 && (
                  <span className="em-side-nav-count">
                    ({floor.location_count})
                  </span>
                )}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>
      )}

      <Content
        id="main-content"
        className="em-main-content"
        data-admin-mode={adminMode}
      >
        {!adminMode && <FilterBar />}

        <div className="em-content-body">
          {adminMode ? (
            <CoordinateMapper />
          ) : (
            <FloorPlan />
          )}

          {selectedLocId && !adminMode && (
            <LocationPanel />
          )}
        </div>
      </Content>
    </div>
  );
}
