import MapView from './components/MapView';
import Toolbar from './components/Toolbar';
import Palette from './components/Palette';
import PropertiesPanel from './components/PropertiesPanel';
import FloorSlider from './components/FloorSlider';
import Toast from './components/Toast';
import { useKeyboard } from './hooks/useKeyboard';

export default function App() {
  useKeyboard();

  return (
    <>
      <div id="map">
        <MapView />
      </div>
      <Toolbar />
      <Palette />
      <PropertiesPanel />
      <FloorSlider />
      <Toast />
    </>
  );
}
