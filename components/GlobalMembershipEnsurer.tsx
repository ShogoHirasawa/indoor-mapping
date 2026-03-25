'use client';

import { useEffect } from 'react';

/**
 * Ensures logged-in users are members of the Global org (OSM-style shared map).
 * Calls API on mount - idempotent, no UI impact.
 */
export default function GlobalMembershipEnsurer() {
  useEffect(() => {
    fetch('/api/ensure-global-membership', { method: 'POST' }).catch(() => {
      // Ignore - user may not be logged in
    });
  }, []);
  return null;
}
