import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import { Map as LeafletMap } from 'leaflet';

const position: LatLngExpression = [49.2827, -123.1207]; // Adjust to your desired center

const MapView = () => {
  const [geoJsonData, setGeoJsonData] = useState(null);

  useEffect(() => {
    const fetchPolygons = async () => {
      try {
        const response = await fetch('http://localhost:5000/polygons');
        const data = await response.json();

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
  }, []);

  // Function to dynamically style polygons based on Grade_Category
  const getPolygonStyle = (feature) => {
    const { Grade_Category, Level } = feature.properties;
  
    if (Grade_Category === 'Secondary') {
      return { color: 'red', weight: 3, fillOpacity: 0, pane: 'secondaryPane' };
    }
  
  
    if (Grade_Category === 'Elementary') {
      return { color: 'goldenrod', weight: 2, fillColor: 'yellow', fillOpacity: 0.7, pane: 'elementaryPane' };
    }
  
    if (Level === 'District Level') {
      return { color: 'black', weight: 5, fillOpacity: 0, pane: 'districtPane' };
    }
  
    // Default style for other cases
    return { color: 'gray', weight: 2, fillColor: 'lightgray', fillOpacity: 0.5, pane: 'defaultPane' };
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties && feature.properties.Level) {
      layer.on('mouseover', (event) => {
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
<MapContainer
  center={position}
  zoom={13}
  style={{ height: '100%', width: '100%' }}
  whenReady={({ target }: { target: LeafletMap }) => {
    if (!target.getPane('secondaryPane')) {
      target.createPane('secondaryPane').style.zIndex = '650';
    }
    if (!target.getPane('elementaryPane')) {
      target.createPane('elementaryPane').style.zIndex = '640';
    }
    if (!target.getPane('districtPane')) {
        target.createPane('districtPane').style.zIndex = '680';
    }
    if (!target.getPane('defaultPane')) {
      target.createPane('defaultPane').style.zIndex = '630';
    }
  }}
>

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {geoJsonData && (
        <GeoJSON data={geoJsonData} style={getPolygonStyle} onEachFeature={onEachFeature} />
      )}
    </MapContainer>
  );
};

export default MapView;