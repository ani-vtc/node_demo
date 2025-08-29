import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import './AddressSearchBar.css';

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
        
        // Small delay to ensure Google Maps is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setIsLoaded(true);

        // Create the autocomplete element
        const autocomplete = document.createElement('gmp-autocomplete') as google.maps.places.PlaceAutocompleteElement;
        
        // Set attributes
        autocomplete.setAttribute('types', 'address');
        autocomplete.setAttribute('fields', 'address_components,formatted_address,geometry,name,place_id,types');
        autocomplete.setAttribute('placeholder', 'Search for an address...');
        
        if (countryRestriction) {
          autocomplete.setAttribute('country-restriction', countryRestriction);
        }

        // Style the element with proper dimensions and display
        autocomplete.style.cssText = `
          display: block;
          width: 100%;
          height: auto;
          min-height: 44px;
          font-size: 14px;
          font-family: 'Roboto', Arial, sans-serif;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          outline: none;
          background-color: white;
          box-sizing: border-box;
        `;

        // Add event listener
        autocomplete.addEventListener('gmp-placeselect', handlePlaceChanged);

        // Add focus/blur styling with proper selectors for the internal input
        const addFocusBlurEvents = () => {
          const internalInput = autocomplete.querySelector('input');
          if (internalInput) {
            internalInput.addEventListener('focus', () => {
              autocomplete.style.borderColor = '#4285f4';
              autocomplete.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.3)';
            });

            internalInput.addEventListener('blur', () => {
              autocomplete.style.borderColor = 'rgba(0,0,0,0.2)';
              autocomplete.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            });
          }
        };

        // Wait for the element to be fully initialized before setting up events
        setTimeout(addFocusBlurEvents, 100);

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
        <div 
          ref={autocompleteRef} 
          style={{
            width: '100%',
            minHeight: '44px',
            display: 'block'
          }}
        />
      )}
    </div>
  );
};

export default AddressSearchBar;