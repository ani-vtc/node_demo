import { MapContainer, TileLayer, GeoJSON, useMap} from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import StyleControlPanel, { StyleConfig } from './StyleControlPanel';
import './StyleControlPanel.css';

const position: LatLngExpression = [49.2827, -123.1207]; // Adjust to your desired center

// Create a component to setup panes when the map is ready
function SetupMapPanes() {
  const map = useMap();
  
  useEffect(() => {
    if (!map.getPane('secondaryPane')) {
      map.createPane('secondaryPane').style.zIndex = '650';
    }
    if (!map.getPane('elementaryPane')) {
      map.createPane('elementaryPane').style.zIndex = '640';
    }
    if (!map.getPane('districtPane')) {
      map.createPane('districtPane').style.zIndex = '680';
    }
    if (!map.getPane('defaultPane')) {
      map.createPane('defaultPane').style.zIndex = '630';
    }
  }, [map]);
  
  return null;
}

const MapView = () => {
  const [geoJsonData, setGeoJsonData] = useState(null);
  
  // Initialize style configuration with default values
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    colorBy: 'Constant',
    schoolType: 'Secondary',
    schoolCategory: 'Public',
    strokeColor: '#ff0000',
    strokeWeight: 3,
    fillColor: '#ff0000',
    fillOpacity: 0,
  });

  useEffect(() => {
    const fetchPolygons = async () => {
      try {
        const response = await fetch(window.location.hostname === 'localhost' ? `http://localhost:5000/api/polygons/${styleConfig.schoolType}` : `/api/polygons/${styleConfig.schoolType}`);
        const data = await response.json();
        console.log(data);
        // Log the column names from the first feature's properties
        if (data.features && data.features.length > 0) {
            console.log('Column names:', Object.keys(data.features[0].properties));
            } else {
            console.log('No features found in the GeoJSON data.');
            }

        setGeoJsonData(data);
      } catch (error) {
        console.error('Error fetching polygons:', error);
      }
    };

    fetchPolygons();
  }, [styleConfig.schoolType]);

  

  // Function to dynamically style polygons based on Grade_Category and style configuration
  const getPolygonStyle = (feature: any) => {
    
    return {
      color: styleConfig.strokeColor,
      weight: styleConfig.strokeWeight,
      fillColor: styleConfig.fillColor,
      fillOpacity: styleConfig.fillOpacity,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.Level) {
      layer.on('mouseover', (event: any) => {
        const { latlng } = event; // Get the mouse location
        layer.bindPopup(`Grade_Category: ${feature.properties.Grade_Category}`, {
          closeButton: false, // Disable the close button
          autoClose: false,   // Prevent the popup from closing automatically
        })
        .setLatLng(latlng) // Set the popup location to the mouse position
        .openPopup(); // Open the popup
      });
  
      layer.on('mouseout', () => {
        layer.closePopup(); // Close the popup when the mouse leaves the polygon
      });
    }
  };

  return (
    <div className="map-container" style={{ display: 'flex', height: '100%' }}>
      <div className="control-sidebar" style={{ width: '400px', overflow: 'auto' }}>
        <StyleControlPanel 
          styleConfig={styleConfig} 
          onStyleChange={setStyleConfig} 
          
        />
      </div>
      <div className="map-wrapper" style={{ flex: 1 }}>
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <SetupMapPanes />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {geoJsonData && (
            <GeoJSON data={geoJsonData} style={getPolygonStyle} onEachFeature={onEachFeature} />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;