import MapView from './components/MapView';
import './App.css';
import Chatbot from './components/chatbot';

function App() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center' }}>
        <h3>School Catchment Areas Map</h3>
      </header>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MapView />
      </div>
      <Chatbot />
    </div>
  );
}

export default App;
