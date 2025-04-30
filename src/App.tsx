import MapView from './components/MapView';

function App() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center' }}>
        <h3>Leaflet + Cloud SQL Polygons in TS React w VITE</h3>
      </header>
      <div style={{ flex: 1 }}>
        <MapView />
      </div>
    </div>
  );
}

export default App;
