import React from 'react';
import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';

export default function App() {
  return (
    <EMProvider>
      <AppShell />
    </EMProvider>
  );
}
