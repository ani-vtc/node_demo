import { MapContainer, TileLayer, GeoJSON, useMap} from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import StyleControlPanel, { StyleConfig } from './StyleControlPanel';
import './StyleControlPanel.css';
import { color, color_scale } from '../data_functions/data';
import colorbrewer from 'colorbrewer';
import { all } from 'axios';
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
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  
  // Initialize style configuration with default values
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    strokeBy: 'Constant',
    fillBy: 'Constant',
    schoolType: 'Secondary',
    schoolCategory: 'Public',
    strokePallette: 'Warm',
    fillPallette: 'Warm',
    strokeWeight: 3,
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
          const propertyNames = ['Constant', ...Object.keys(data.features[0].properties)];
          const filteredPropertyNames = propertyNames.filter(name => name.toLowerCase() !== 'code' 
                                                          && name.toLowerCase() !== 'level' 
                                                          && name.toLowerCase() !== 'province'
                                                          && name.toLowerCase() !== 'geometry_wkt'
                                                          && name.toLowerCase() !== 'bound_north'
                                                          && name.toLowerCase() !== 'bound_south'
                                                          && name.toLowerCase() !== 'bound_east'
                                                          && name.toLowerCase() !== 'bound_west'
                                                          && name.toLowerCase() !== 'centre_lat'
                                                          && name.toLowerCase() !== 'centre_lng'
                                                          && name.toLowerCase() !== 'grade_category'
                                                          );
          console.log('Column names:', filteredPropertyNames);
          setColumnNames(filteredPropertyNames);
        } else {
          console.log('No features found in the GeoJSON data.');
        }
        // Remove duplicates based on Code property
        const uniqueFeatures = data.features.reduce((acc: any[], current: any) => {
            const x = acc.find(item => item.properties.Code === current.properties.Code);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []);
        
        // Update the data with unique features
        data.features = uniqueFeatures;
        setGeoJsonData(data);
      } catch (error) {
        console.error('Error fetching polygons:', error);
      }
    };

    fetchPolygons();
  }, [styleConfig.schoolType]);

  

  // Function to dynamically style polygons based on Grade_Category and style configuration
  const getPolygonStyle = (feature: any) => {
    const fillBy = styleConfig.fillBy;
    const strokeBy = styleConfig.strokeBy;
    const fillPaletteName = color_scale[styleConfig.fillPallette as keyof typeof color_scale];
    const strokePaletteName = color_scale[styleConfig.strokePallette as keyof typeof color_scale];
    
    // Handle 'Constant' case
    let fillColor = '#cccccc'; // Default fill color
    let strokeColor = '#000000'; // Default stroke color
    
    // Generate colors for fill based on data values
    if (fillBy !== 'Constant' && feature.properties && feature.properties[fillBy] !== undefined) {
      const fillValue = parseFloat(feature.properties[fillBy]);
      
      if (!isNaN(fillValue) && geoJsonData && geoJsonData.features) {
        // Get all values for the selected property
        const allValues = geoJsonData.features
          .map((f: any) => parseFloat(f.properties[fillBy]))
          .filter((val: any) => !isNaN(val));
        
        if (allValues.length > 0) {
          const min = Math.min(...allValues);
          const max = Math.max(...allValues);
          
          // Normalize the value to 0-1 range
          const normalized = max > min ? (fillValue - min) / (max - min) : 0.5;
          
          // Get color scheme from colorbrewer
          // @ts-ignore - colorbrewer typing issue
          const colorScheme = colorbrewer[fillPaletteName];
          if (colorScheme) {
            // Use 5-class color scheme
            const colors = colorScheme[5] || colorScheme[Object.keys(colorScheme)[0]];
            // Select color based on normalized value (0-1)
            const colorIndex = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
            fillColor = colors[colorIndex];
          }
        }
      } else if (geoJsonData && geoJsonData.features) {
        const allValues = geoJsonData.features
          .map((f: any) => f.properties &&f.properties[fillBy])
          .filter((val: any) => val !== undefined && val !== null);
        console.log(allValues);
        if (allValues.length > 0) {
          const uniqueValues = [...new Set(allValues)];
          const colorScheme = colorbrewer[fillPaletteName as keyof typeof colorbrewer];
          
          if (colorScheme) {
            // Use an appropriate qualitative palette size that fits our categories
            // Pick palette size that can handle our unique values (up to 12 categories)
            const paletteSize = Math.min(Math.max(uniqueValues.length, 3), 12);
            const closestAvailableSize = Object.keys(colorScheme)
              .map(Number)
              .filter(size => !isNaN(size))
              .sort((a, b) => Math.abs(paletteSize - a) - Math.abs(paletteSize - b))[0];
            
            const colors: any = colorScheme[closestAvailableSize as keyof typeof colorScheme];
            
            // Get index of this value in unique values array
            const valueIndex = uniqueValues.indexOf(feature.properties[fillBy]);
            // Distribute colors evenly through palette
            if (valueIndex !== -1) {
              fillColor = colors[valueIndex % colors.length];
            }
          }
        }
      }
    }
    
    // Generate colors for stroke based on data values
    if (strokeBy !== 'Constant' && feature.properties && feature.properties[strokeBy] !== undefined) {
      const strokeValue = parseFloat(feature.properties[strokeBy]);
      
      if (!isNaN(strokeValue) && geoJsonData && geoJsonData.features) {
        // Get all values for the selected property
        const allValues = geoJsonData.features
          .map((f: any) => parseFloat(f.properties[strokeBy]))
          .filter((val: any) => !isNaN(val));
        
        if (allValues.length > 0) {
          const min = Math.min(...allValues);
          const max = Math.max(...allValues);
          
          // Normalize the value to 0-1 range
          const normalized = max > min ? (strokeValue - min) / (max - min) : 0.5;
          
          // Get color scheme from colorbrewer
          // @ts-ignore - colorbrewer typing issue
          const colorScheme = colorbrewer[strokePaletteName];
          if (colorScheme) {
            // Use 5-class color scheme
            const colors = colorScheme[5] || colorScheme[Object.keys(colorScheme)[0]];
            // Select color based on normalized value (0-1)
            const colorIndex = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
            strokeColor = colors[colorIndex];
          }
        }
      } else if (geoJsonData && geoJsonData.features) {
        const allValues = geoJsonData.features
          .map((f: any) => f.properties && f.properties[strokeBy])
          .filter((val: any) => val !== undefined && val !== null);
        if (allValues.length > 0) {
          const uniqueValues = [...new Set(allValues)];
          const colorScheme = colorbrewer[strokePaletteName as keyof typeof colorbrewer];
          
          if (colorScheme) {
            const paletteSize = Math.min(Math.max(uniqueValues.length, 3), 12);
            const closestAvailableSize = Object.keys(colorScheme)
              .map(Number)
              .filter(size => !isNaN(size))
              .sort((a, b) => Math.abs(paletteSize - a) - Math.abs(paletteSize - b))[0];
            
            const colors: any = colorScheme[closestAvailableSize as keyof typeof colorScheme];
            
            // Get index of this value in unique values array
            const valueIndex = uniqueValues.indexOf(feature.properties[strokeBy]);
            // Distribute colors evenly through palette
            if (valueIndex !== -1) {
              strokeColor = colors[valueIndex % colors.length];
            }
          }
        }
      }
    }
    
    return {
      color: strokeColor,
      weight: styleConfig.strokeWeight,
      fillColor: fillColor,
      fillOpacity: styleConfig.fillOpacity,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties && feature.properties.Level) {
      layer.on('mouseover', () => {
        // const { latlng } = event; // Get the mouse location
        layer.bindPopup(`Grade_Category: ${feature.properties.Grade_Category}`, {
          closeButton: false, // Disable the close button
          autoClose: false,   // Prevent the popup from closing automatically
        })
        .openPopup()// Open the popup
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
          columnNames={columnNames}
          onColumnNamesChange={setColumnNames}
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