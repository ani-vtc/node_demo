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
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [autocompleteElement, setAutocompleteElement] = useState<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePlaceChanged = useCallback((event: any) => {
    const place = event.detail.place;
    
    if (!place || !place.geometry || !place.geometry.location) {
      console.warn('No valid place selected');
      return;
    }
    
    onPlaceSelected(place);
  }, [onPlaceSelected]);

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

        // Create the autocomplete element
        const autocomplete = document.createElement('gmp-autocomplete') as google.maps.places.PlaceAutocompleteElement;
        
        // Set attributes
        autocomplete.setAttribute('types', 'address');
        autocomplete.setAttribute('fields', 'address_components,formatted_address,geometry,name,place_id,types');
        
        if (countryRestriction) {
          autocomplete.setAttribute('country-restriction', countryRestriction);
        }

        // Style the element
        autocomplete.style.width = '100%';
        autocomplete.style.fontSize = '14px';
        autocomplete.style.fontFamily = 'Roboto, Arial, sans-serif';
        autocomplete.style.padding = '12px 16px';
        autocomplete.style.border = '2px solid rgba(0,0,0,0.2)';
        autocomplete.style.borderRadius = '4px';
        autocomplete.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        autocomplete.style.outline = 'none';
        autocomplete.style.backgroundColor = 'white';

        // Set placeholder
        autocomplete.setAttribute('placeholder', 'Search for an address...');

        // Add event listener
        autocomplete.addEventListener('gmp-placeselect', handlePlaceChanged);

        // Add focus/blur styling
        autocomplete.addEventListener('focus', () => {
          autocomplete.style.borderColor = '#4285f4';
          autocomplete.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.3)';
        });

        autocomplete.addEventListener('blur', () => {
          autocomplete.style.borderColor = 'rgba(0,0,0,0.2)';
          autocomplete.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        });

        // Replace the ref element with our autocomplete element
        if (autocompleteRef.current && autocompleteRef.current.parentNode) {
          autocompleteRef.current.parentNode.replaceChild(autocomplete, autocompleteRef.current);
          setAutocompleteElement(autocomplete);
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
      if (autocompleteElement) {
        autocompleteElement.removeEventListener('gmp-placeselect', handlePlaceChanged);
      }
    };
  }, [autocompleteElement, handlePlaceChanged]);

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
      
      {/* Placeholder element that gets replaced by gmp-autocomplete */}
      {isLoaded && !hasError && (
        <div ref={autocompleteRef} />
      )}
    </div>
  );
};

export default AddressSearchBar;