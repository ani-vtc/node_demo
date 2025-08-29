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
        
        // Wait for Google Maps web components to be fully registered
        await new Promise(resolve => {
          if (customElements.get('gmp-autocomplete')) {
            resolve(true);
          } else {
            customElements.whenDefined('gmp-autocomplete').then(resolve);
          }
        });

        setIsLoaded(true);

        if (autocompleteRef.current) {
          // Create the autocomplete element
          const autocomplete = document.createElement('gmp-autocomplete') as google.maps.places.PlaceAutocompleteElement;
          
          // Set attributes first
          autocomplete.setAttribute('types', 'address');
          autocomplete.setAttribute('fields', 'address_components,formatted_address,geometry,name,place_id,types');
          autocomplete.setAttribute('placeholder', 'Search for an address...');
          
          if (countryRestriction) {
            autocomplete.setAttribute('country-restriction', countryRestriction);
          }

          // Add the element to the DOM first
          autocompleteRef.current.appendChild(autocomplete);

          // Style the element after it's in the DOM
          const applyStyles = () => {
            autocomplete.style.cssText = `
              display: block !important;
              width: 100% !important;
              min-height: 44px !important;
              font-size: 14px !important;
              font-family: 'Roboto', Arial, sans-serif !important;
              border: 2px solid rgba(0,0,0,0.2) !important;
              border-radius: 4px !important;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
              outline: none !important;
              background-color: white !important;
              box-sizing: border-box !important;
              pointer-events: auto !important;
            `;
          };

          // Apply styles after a brief delay to ensure the element is rendered
          setTimeout(applyStyles, 50);

          // Add event listener for place selection
          autocomplete.addEventListener('gmp-placeselect', handlePlaceChanged);

          // Set up focus/blur events after the component is fully initialized
          const setupFocusEvents = () => {
            const internalInput = autocomplete.querySelector('input');
            if (internalInput) {
              internalInput.style.cssText = `
                width: 100% !important;
                padding: 12px 16px !important;
                font-size: 14px !important;
                font-family: 'Roboto', Arial, sans-serif !important;
                border: none !important;
                outline: none !important;
                background: transparent !important;
                box-sizing: border-box !important;
              `;

              internalInput.addEventListener('focus', () => {
                autocomplete.style.borderColor = '#4285f4';
                autocomplete.style.boxShadow = '0 2px 6px rgba(66, 133, 244, 0.3)';
              });

              internalInput.addEventListener('blur', () => {
                autocomplete.style.borderColor = 'rgba(0,0,0,0.2)';
                autocomplete.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
              });
            } else {
              // If input not found, try again after a short delay
              setTimeout(setupFocusEvents, 100);
            }
          };

          // Setup focus events with a delay
          setTimeout(setupFocusEvents, 200);

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
        // Clean up the DOM element
        if (autocompleteElement.parentNode) {
          autocompleteElement.parentNode.removeChild(autocompleteElement);
        }
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
      
      {/* Container element for gmp-autocomplete */}
      {isLoaded && !hasError && (
        <div 
          ref={autocompleteRef} 
          style={{
            width: '100%',
            minHeight: '44px',
            display: 'block',
            position: 'relative'
          }}
        />
      )}
    </div>
  );
};

export default AddressSearchBar;