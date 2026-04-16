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
      className="em-app"
      style={{
        '--shell-header-height': '3rem',
        '--admin-banner-height': '2rem',
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
                  <span style={{
                    marginLeft: 'var(--cds-spacing-03)',
                    fontSize: 'var(--cds-label-01-font-size, 0.75rem)',
                    opacity: 0.7,
                  }}>
                    ({floor.location_count})
                  </span>
                )}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>
      )}

      {/* Main content — offset to clear fixed header + optional side nav */}
      <main
        id="main-content"
        tabIndex={-1}
        style={{
          marginTop: adminMode
            ? 'calc(var(--shell-header-height) + var(--admin-banner-height))'
            : 'var(--shell-header-height)',
          marginLeft: adminMode ? '0' : (isSideNavExpanded ? '16rem' : '0'),
          height: adminMode
            ? 'calc(100vh - (var(--shell-header-height) + var(--admin-banner-height)))'
            : 'calc(100vh - var(--shell-header-height))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: `margin-left 110ms var(--cds-motion-easing-standard, ease)`,
        }}
      >
        {!adminMode && <FilterBar />}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {adminMode ? (
            <CoordinateMapper />
          ) : (
            <FloorPlan />
          )}

          {selectedLocId && !adminMode && (
            <LocationPanel />
          )}
        </div>
      </main>
    </div>
  );
}
