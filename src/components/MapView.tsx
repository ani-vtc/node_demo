import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import StyleControlPanel, { StyleConfig } from './StyleControlPanel';
import './StyleControlPanel.css';
import { color_scale } from '../data_functions/data';
import colorbrewer from 'colorbrewer';
import placeholder from '../assets/placeholder.png';
import { icon } from 'leaflet';
import AddressSearchBar from './AddressSearchBar';
// import { all } from 'axios';
const defaultPosition: LatLngExpression = [49.2827, -123.1207]; // Default center

// Create a component to setup panes when the map is ready
// @param none - No parameters
// @returns: none
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

// Component to handle map center updates
// @param {LatLngExpression} center - The new center coordinates
// @returns: null
function MapCenterUpdater({ center }: { center: LatLngExpression }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

// Component for user location functionality
// @param {function} onLocationFound - Callback when location is found
// @param {boolean} snapOnStartup - Whether to snap to location on startup
// @returns: JSX element with location button
function LocationControl({ onLocationFound, snapOnStartup }: { onLocationFound: (lat: number, lng: number) => void, snapOnStartup: boolean }) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const snapToLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 15);
        onLocationFound(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMessage = 'Unable to get your location.';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        alert(errorMessage);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  useEffect(() => {
    if (snapOnStartup) {
      snapToLocation();
    }
  }, [snapOnStartup]);

  useEffect(() => {
    const button = document.createElement('button');
    button.innerHTML = isLocating ? '📍 Locating...' : '📍 My Location';
    button.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: ${isLocating ? 'default' : 'pointer'};
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      opacity: ${isLocating ? '0.6' : '1'};
    `;
    button.disabled = isLocating;
    button.onclick = snapToLocation;

    const mapContainer = map.getContainer();
    mapContainer.appendChild(button);

    return () => {
      if (mapContainer.contains(button)) {
        mapContainer.removeChild(button);
      }
    };
  }, [map, isLocating]);

  return null;
}

const MapView = () => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>(defaultPosition);
  const [snapOnStartup, setSnapOnStartup] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLngExpression | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [searchBounds, setSearchBounds] = useState<google.maps.LatLngBounds | undefined>(undefined);
  

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch(window.location.hostname === 'localhost' ? 'http://localhost:5000/api/config' : '/api/config');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          console.error('Failed to fetch API key:', response.status, errorData);
          return;
        }
        
        const data = await response.json();
        console.log('Successfully fetched API key:', !!data.apiKey);
        setGoogleMapsApiKey(data.apiKey || '');
      } catch (error) {
        console.error('Error fetching API key:', error);
      }
    };

    fetchApiKey();
  }, []);

  // Create bounds for better local search results (Vancouver area) when Google Maps is loaded
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(49.0, -123.5), // Southwest
        new google.maps.LatLng(49.5, -122.8)  // Northeast
      );
      setSearchBounds(bounds);
    }
  }, []);
  
  // Handle location found callback
  const handleLocationFound = (lat: number, lng: number) => {
    const location: LatLngExpression = [lat, lng];
    setMapCenter(location);
    setUserLocation(location);
    setSnapOnStartup(false); // Only snap automatically once
  };

  // Handle place selection from address search
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    if (place.geometry && place.geometry.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const location: LatLngExpression = [lat, lng];
      setMapCenter(location);
    }
  };
  
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

  // Set up window functions for chatbot integration
  useEffect(() => {
    // Define window functions that the chatbot can call to update style
    window.handleStrokeByChange = (strokeBy: string) => {
      console.log('Updating strokeBy to:', strokeBy);
      setStyleConfig(prev => ({ ...prev, strokeBy }));
      return true;
    };

    window.handleStrokePalletteChange = (strokePallette: string) => {
      console.log('Updating strokePallette to:', strokePallette);
      setStyleConfig(prev => ({ ...prev, strokePallette }));
      return true;
    };

    window.handleStrokeWeightChange = (strokeWeight: number) => {
      console.log('Updating strokeWeight to:', strokeWeight);
      setStyleConfig(prev => ({ ...prev, strokeWeight }));
      return true;
    };

    window.handleFillByChange = (fillBy: string) => {
      console.log('Updating fillBy to:', fillBy);
      setStyleConfig(prev => ({ ...prev, fillBy }));
      return true;
    };

    window.handleFillPalletteChange = (fillPallette: string) => {
      console.log('Updating fillPallette to:', fillPallette);
      setStyleConfig(prev => ({ ...prev, fillPallette }));
      return true;
    };

    window.handleFillOpacityChange = (fillOpacity: number) => {
      console.log('Updating fillOpacity to:', fillOpacity);
      setStyleConfig(prev => ({ ...prev, fillOpacity }));
      return true;
    };

    window.handleSchoolTypeChange = (schoolType: string) => {
      console.log('Updating schoolType to:', schoolType);
      setStyleConfig(prev => ({ ...prev, schoolType }));
      return true;
    };

    window.handleSchoolCategoryChange = (schoolCategory: string) => {
      console.log('Updating schoolCategory to:', schoolCategory);
      setStyleConfig(prev => ({ ...prev, schoolCategory }));
      return true;
    };

    window.handleLatLngChange = (lat: number, lng: number) => {
      console.log('Updating map center to:', lat, lng);
      setMapCenter([lat, lng]);
      return true;
    };

    // Cleanup function to remove window functions when component unmounts
    return () => {
      delete window.handleStrokeByChange;
      delete window.handleStrokePalletteChange;
      delete window.handleStrokeWeightChange;
      delete window.handleFillByChange;
      delete window.handleFillPalletteChange;
      delete window.handleFillOpacityChange;
      delete window.handleSchoolTypeChange;
      delete window.handleSchoolCategoryChange;
      delete window.handleLatLngChange;
    };
  }, []);

  // Fetches the polygons from the server
  // @param: none
  // @returns: none
  useEffect(() => {
    // Fetches the polygons from the server
    // @param: none
    // @returns: none
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
  // @param: {any} feature - The feature to style
  // @returns: none
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

  // @param: {any} feature - The feature to style
  // @param: {any} layer - The layer to style
  // @returns: none
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
        />
      </div>
      <div className="map-wrapper" style={{ flex: 1, position: 'relative' }}>
        {googleMapsApiKey && (
          <AddressSearchBar
            onPlaceSelected={handlePlaceSelected}
            apiKey={googleMapsApiKey}
            bounds={searchBounds}
            countryRestriction="ca"
          />
        )}
        <MapContainer
          center={defaultPosition}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <SetupMapPanes />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <MapCenterUpdater center={mapCenter} />
          <LocationControl onLocationFound={handleLocationFound} snapOnStartup={snapOnStartup} />
          {userLocation && (
            <Marker 
              icon={icon({
                iconUrl: placeholder,
                iconSize: [40, 40], // Width, Height in pixels
                iconAnchor: [20, 40], // Point that corresponds to marker's location [x, y] - bottom center
                popupAnchor: [0, -40] // Point from which popup opens relative to iconAnchor
              })} 
              position={userLocation}
            >
              <Popup>
                <div>
                  <strong>Your Location</strong>
                  <br />
                  Lat: {Array.isArray(userLocation) ? userLocation[0].toFixed(6) : ''}
                  <br />
                  Lng: {Array.isArray(userLocation) ? userLocation[1].toFixed(6) : ''}
                </div>
              </Popup>
            </Marker>
          )}
          {geoJsonData && (
            <GeoJSON data={geoJsonData} style={getPolygonStyle} onEachFeature={onEachFeature} />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;