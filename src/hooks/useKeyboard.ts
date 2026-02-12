import { useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';

/**
 * Global keyboard shortcuts:
 *  - Cmd/Ctrl+Z → undo
 *  - Delete / Backspace → remove selected object
 *  - Escape → deselect / cancel wall placement
 */
export function useKeyboard() {
  const undo = useMapStore((s) => s.undo);
  const removeObject = useMapStore((s) => s.removeObject);
  const selectObject = useMapStore((s) => s.selectObject);
  const setTool = useMapStore((s) => s.setTool);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        const selected = useMapStore.getState().getSelectedObject();
        if (selected) {
          e.preventDefault();
          removeObject(selected.id);
        }
        return;
      }

      // Escape — deselect + cancel tool
      if (e.key === 'Escape') {
        selectObject(null);
        setTool(null);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, removeObject, selectObject, setTool]);
}
