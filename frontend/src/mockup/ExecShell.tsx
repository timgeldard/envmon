import { useMemo, useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Content,
  SkipToContent,
  InlineNotification,
} from '@carbon/react';
import { Sun, Moon } from '@carbon/icons-react';
import { useEM } from '~/context/EMContext';
import { MOCK_PLANTS, sortPlantsForExec, type MockPlant } from './data';
import PlantCard from './PlantCard';

/**
 * ExecShell — mockup landing view for the exec persona.
 *
 * Not wired to the backend; data comes from ./data.ts. Only the Seville card
 * click-throughs to the real floor-plan app (by clearing ?mockup=1 from URL
 * and reloading). Other cards show a transient "not yet uploaded" notice.
 */
export default function ExecShell() {
  const { theme, setTheme } = useEM();
  const [notice, setNotice] = useState<string | null>(null);

  const sorted = useMemo(() => sortPlantsForExec(MOCK_PLANTS), []);
  const redCount = sorted.filter((p) => p.tier === 'RED').length;
  const amberCount = sorted.filter((p) => p.tier === 'AMBER').length;

  const handleOpen = (plant: MockPlant) => {
    if (plant.hasFloorplan) {
      const url = new URL(window.location.href);
      url.searchParams.delete('mockup');
      window.location.href = url.toString();
      return;
    }
    setNotice(`Floor plans have not been uploaded for ${plant.name} yet.`);
    window.setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className={`em-app em-exec-shell ${theme === 'g100' ? 'cds--g100' : ''}`}>
      <SkipToContent href="#exec-main" />

      <Header aria-label="Environmental Monitoring — Global">
        <HeaderName prefix="Kerry">Environmental Monitoring — Global</HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={theme === 'g100' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'g100' ? 'white' : 'g100')}
            tooltipAlignment="end"
          >
            {theme === 'g100' ? <Sun size={20} /> : <Moon size={20} />}
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <Content id="exec-main" className="em-exec-main">
        <div className="em-exec-heading">
          <h1 className="em-exec-title">Global environmental monitoring</h1>
          <p className="em-exec-subtitle">
            {redCount > 0 && (
              <>
                <strong>{redCount}</strong> plant{redCount === 1 ? '' : 's'} need
                {redCount === 1 ? 's' : ''} attention today
                {amberCount > 0 && (
                  <>
                    {' · '}
                    <span>{amberCount} to monitor</span>
                  </>
                )}
              </>
            )}
            {redCount === 0 && amberCount > 0 && (
              <>
                <strong>{amberCount}</strong> plant{amberCount === 1 ? '' : 's'} to monitor
              </>
            )}
            {redCount === 0 && amberCount === 0 && 'All plants healthy'}
          </p>
        </div>

        {notice && (
          <div className="em-exec-notice">
            <InlineNotification
              kind="info"
              title="POC stub"
              subtitle={notice}
              onCloseButtonClick={() => setNotice(null)}
            />
          </div>
        )}

        <div className="em-exec-grid">
          {sorted.map((plant) => (
            <PlantCard key={plant.id} plant={plant} onOpen={handleOpen} />
          ))}
        </div>

        <p className="em-exec-footnote">
          Mockup — fabricated data. Only Seville drills through to the real floor plan.
        </p>
      </Content>
    </div>
  );
}
