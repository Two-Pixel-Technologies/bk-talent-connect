/**
 * CANDIDATE PORTAL PROTOTYPE — layout root.
 * Mounted only at /prototype/candidate/* (dev-only route, see router.tsx).
 * Wraps every prototype page in the shared mock-data provider and portal
 * shell so state (applications, notifications, profile edits) persists
 * while clicking between pages, exactly like a real logged-in session would
 * — but reset on refresh, since nothing here is backed by the API.
 */

import { Outlet } from 'react-router-dom';
import { PrototypeProvider, usePrototype } from './PrototypeContext.js';
import { PortalShell } from './components/PortalShell.js';

function ShellWithState() {
  const { unreadCount, candidate } = usePrototype();
  return (
    <PortalShell unreadCount={unreadCount} candidateName={candidate.fullName}>
      <Outlet />
    </PortalShell>
  );
}

export function PrototypeLayout() {
  return (
    <PrototypeProvider>
      <ShellWithState />
    </PrototypeProvider>
  );
}
