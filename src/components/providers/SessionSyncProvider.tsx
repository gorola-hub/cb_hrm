'use client';

import React, { useEffect } from 'react';

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleFocus = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const session = await res.json();
          // If session is empty or unauthenticated, redirect to login
          if (!session || !session.user) {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = '/login';
          }
        }
      } catch {}
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return <>{children}</>;
}
