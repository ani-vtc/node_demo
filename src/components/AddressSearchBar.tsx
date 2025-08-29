import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface AddressSearchBarProps {
  onPlaceSelected: (place: google.maps.places.PlaceResult) => void;
  apiKey: string;
  bounds?: google.maps.LatLngBounds;
  countryRestriction?: string;
}

const AddressSearchBar: React.FC<AddressSearchBarProps> = ({ 
  onPlaceSelected, 
  apiKey, 
  bounds, 
  countryRestriction 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePlaceChanged = useCallback(() => {
    if (!autocomplete) return;
    
    const place = autocomplete.getPlace();
    
    if (!place || !place.geometry || !place.geometry.location) {
      console.warn('No valid place selected');
      return;
    }
    
    onPlaceSelected(place);
  }, [autocomplete, onPlaceSelected]);

  useEffect(() => {
    const initializeGoogleMaps = async () => {
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
          libraries: ['places'],
          region: countryRestriction?.toUpperCase()
        });

        await loader.load();
        setIsLoaded(true);

        if (inputRef.current) {
          const options: google.maps.places.AutocompleteOptions = {
            types: ['address'],
            fields: [
              'address_components',
              'formatted_address', 
              'geometry',
              'name',
              'place_id',
              'types'
            ],
            strictBounds: false
          };

          if (bounds) {
            options.bounds = bounds;
          }

          if (countryRestriction) {
            options.componentRestrictions = { country: countryRestriction };
          }

          const autocompleteService = new google.maps.places.Autocomplete(inputRef.current, options);

          autocompleteService.addListener('place_changed', handlePlaceChanged);

          setAutocomplete(autocompleteService);
        }
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setHasError(true);
        setIsLoaded(false);
      }
    };

    initializeGoogleMaps();
  }, [apiKey, bounds, countryRestriction, handlePlaceChanged]);

  // Separate cleanup effect
  useEffect(() => {
    return () => {
      if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [autocomplete]);

  const getPlaceholder = () => {
    if (hasError) return "Error loading maps service";
    if (!isLoaded) return "Loading Google Maps...";
    return "Search for an address...";
  };

  const getInputStyle = (): React.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: hasError ? '2px solid #ea4335' : '2px solid rgba(0,0,0,0.2)',
    borderRadius: '4px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    outline: 'none',
    backgroundColor: hasError ? '#fdf2f2' : 'white',
    fontFamily: 'Roboto, Arial, sans-serif',
    color: hasError ? '#ea4335' : '#333',
    cursor: hasError || !isLoaded ? 'not-allowed' : 'text'
  });

  return (
    <div 
      className="pac-container"
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        width: '300px',
        fontFamily: 'Roboto, Arial, sans-serif'
      }}
    >
      <input
        ref={inputRef}
        id="pac-input"
        className="pac-input"
        type="text"
        placeholder={getPlaceholder()}
        disabled={!isLoaded || hasError}
        style={getInputStyle()}
        onFocus={(e) => {
          if (!hasError) {
            e.target.style.borderColor = '#4285f4';
            e.target.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.3)';
          }
        }}
        onBlur={(e) => {
          if (!hasError) {
            e.target.style.borderColor = 'rgba(0,0,0,0.2)';
            e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
      />
      {hasError && (
        <div style={{
          fontSize: '12px',
          color: '#ea4335',
          marginTop: '4px',
          padding: '0 4px'
        }}>
          Failed to load Google Maps. Please check your API key.
        </div>
      )}
    </div>
  );
};

export default AddressSearchBar;