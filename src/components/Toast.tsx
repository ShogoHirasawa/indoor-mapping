import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';

export default function Toast() {
  const message = useMapStore((s) => s.toastMessage);
  const clearToast = useMapStore((s) => s.clearToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => clearToast(), 2500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, clearToast]);

  return (
    <div id="toast" className={message ? 'show' : ''}>
      {message}
    </div>
  );
}
