'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Toolbar from '@/components/Toolbar';
import Palette from '@/components/Palette';
import PropertiesPanel from '@/components/PropertiesPanel';
import FloorSlider from '@/components/FloorSlider';
import Toast from '@/components/Toast';
import Leaderboard from '@/components/Leaderboard';
import { useKeyboard } from '@/hooks/useKeyboard';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

function AuthCodeRedirect({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
    }
  }, [searchParams]);
  return <>{children}</>;
}

export default function Page() {
  useKeyboard();
  const [lbOpen, setLbOpen] = useState(false);
  const openLb = useCallback(() => setLbOpen(true), []);
  const closeLb = useCallback(() => setLbOpen(false), []);

  return (
    <Suspense fallback={null}>
      <AuthCodeRedirect>
        <div id="map">
          <MapView />
        </div>
        <Toolbar onOpenLeaderboard={openLb} />
        <Palette />
        <PropertiesPanel />
        <FloorSlider />
        <Toast />
        <Leaderboard open={lbOpen} onClose={closeLb} />
      </AuthCodeRedirect>
    </Suspense>
  );
}
