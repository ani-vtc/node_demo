import MapView from './components/MapView';
import './App.css';
import Chatbot from './components/chatbot';
import DataAnalysisTestPanel from './components/DataAnalysisTestPanel';
import { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'data-analysis'>('map');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center' }}>
        <h3>School Data Analysis Platform</h3>
        <nav style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              padding: '0.5rem 1rem',
              margin: '0 0.25rem',
              backgroundColor: activeTab === 'map' ? '#4a5568' : 'transparent',
              color: 'white',
              border: '1px solid #4a5568',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveTab('data-analysis')}
            style={{
              padding: '0.5rem 1rem',
              margin: '0 0.25rem',
              backgroundColor: activeTab === 'data-analysis' ? '#4a5568' : 'transparent',
              color: 'white',
              border: '1px solid #4a5568',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            Data Analysis Testing
          </button>
        </nav>
      </header>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f7fafc' }}>
        {activeTab === 'map' ? (
          <>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <MapView />
            </div>
            <div style={{ flexShrink: 0 }}>
              <Chatbot />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <DataAnalysisTestPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
