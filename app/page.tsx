'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Toolbar from '@/components/Toolbar';
import Palette from '@/components/Palette';
import PropertiesPanel from '@/components/PropertiesPanel';
import FloorSlider from '@/components/FloorSlider';
import Toast from '@/components/Toast';
import Leaderboard from '@/components/Leaderboard';
import { useKeyboard } from '@/hooks/useKeyboard';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function Page() {
  useKeyboard();
  const [lbOpen, setLbOpen] = useState(false);
  const openLb = useCallback(() => setLbOpen(true), []);
  const closeLb = useCallback(() => setLbOpen(false), []);

  return (
    <>
      <div id="map">
        <MapView />
      </div>
      <Toolbar onOpenLeaderboard={openLb} />
      <Palette />
      <PropertiesPanel />
      <FloorSlider />
      <Toast />
      <Leaderboard open={lbOpen} onClose={closeLb} />
    </>
  );
}
