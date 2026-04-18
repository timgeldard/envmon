import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';
import ErrorBoundary from '~/components/common/ErrorBoundary';
import ExecShell from '~/mockup/ExecShell';

function isMockupMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mockup') === '1';
}

export default function App() {
  const mockup = isMockupMode();
  return (
    <ErrorBoundary>
      <EMProvider>
        {mockup ? <ExecShell /> : <AppShell />}
      </EMProvider>
    </ErrorBoundary>
  );
}
