import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';
import ErrorBoundary from '~/components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <EMProvider>
        <AppShell />
      </EMProvider>
    </ErrorBoundary>
  );
}
