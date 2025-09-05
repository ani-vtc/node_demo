import React, { useRef, useEffect, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface AddressSearchBarProps {
  onPlaceSelected: (lat: number, lng: number, address: string) => void;
  apiKey: string;
  countryRestriction?: string;
}

const AddressSearchBar: React.FC<AddressSearchBarProps> = ({ 
  onPlaceSelected, 
  apiKey, 
  countryRestriction 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const initializeAutocomplete = async () => {
      if (!apiKey) {
        console.warn('Google Maps API key not provided');
        setHasError(true);
        return;
      }

      try {
        setHasError(false);
        
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.importLibrary('places');
        console.log('Google Maps API loaded successfully');

        if (inputRef.current) {
          // Create autocomplete instance
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            fields: ['formatted_address', 'geometry', 'name'],
          });

          // Set country restriction if provided
          if (countryRestriction) {
            autocomplete.setComponentRestrictions({
              country: [countryRestriction],
            });
          }

          // Add place change listener
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            console.log('🎯 Place selected:', place);

            if (place.geometry && place.geometry.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const address = place.formatted_address || place.name || 'Selected Location';
              
              console.log('📍 Coordinates:', { lat, lng, address });
              onPlaceSelected(lat, lng, address);
            } else {
              console.warn('❌ No geometry found in place');
            }
          });

          autocompleteRef.current = autocomplete;
          setIsLoaded(true);
          console.log('✅ Autocomplete initialized successfully');
        }
      } catch (error) {
        console.error('❌ Error loading Google Maps:', error);
        setHasError(true);
        setIsLoaded(false);
      }
    };

    initializeAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, countryRestriction, onPlaceSelected]);

  return (
    <div 
      className="address-search-container"
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        width: '300px',
        fontFamily: 'Roboto, Arial, sans-serif'
      }}
    >
      {!isLoaded && !hasError && (
        <div style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: '14px',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          backgroundColor: 'white',
          fontFamily: 'Roboto, Arial, sans-serif',
          color: '#666'
        }}>
          Loading Google Maps...
        </div>
      )}
      
      {hasError && (
        <div>
          <div style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            border: '2px solid #ea4335',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            backgroundColor: '#fdf2f2',
            fontFamily: 'Roboto, Arial, sans-serif',
            color: '#ea4335'
          }}>
            Error loading maps service
          </div>
          <div style={{
            fontSize: '12px',
            color: '#ea4335',
            marginTop: '4px',
            padding: '0 4px'
          }}>
            Failed to load Google Maps. Please check your API key.
          </div>
        </div>
      )}
      
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for an address..."
        style={{
          display: isLoaded && !hasError ? 'block' : 'none',
          width: '100%',
          padding: '12px 16px',
          fontSize: '14px',
          fontFamily: 'Roboto, Arial, sans-serif',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          backgroundColor: 'white',
          boxSizing: 'border-box',
          outline: 'none'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#4285f4';
          e.target.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.3)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(0,0,0,0.2)';
          e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        }}
      />
    </div>
  );
};

export default AddressSearchBar;