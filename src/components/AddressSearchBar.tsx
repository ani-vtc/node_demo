import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';


interface AddressSearchBarProps {
  onPlaceSelected: (place: google.maps.places.Place) => void;
  apiKey: string;
  bounds?: google.maps.LatLngBounds;
  countryRestriction?: string;
}

const AddressSearchBar: React.FC<AddressSearchBarProps> = ({ 
  onPlaceSelected, 
  apiKey, 
  countryRestriction 
}) => {
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  const handlePlaceChanged = useCallback(async (event: Event) => {
    const customEvent = event as CustomEvent<{place_id: string}>;
    const placeId = customEvent.detail.place_id;
    
    if (!placeId || !placesService.current) {
      console.warn('No valid place ID or Places service not available');
      return;
    }

    const request = {
      placeId: placeId,
      fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id', 'types']
    };

    placesService.current.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        // Create a Place object from PlaceResult for compatibility
        const placeObject = place as google.maps.places.Place;
        onPlaceSelected(placeObject);
      } else {
        console.error('Place details request failed:', status);
      }
    });
  }, [onPlaceSelected]);

  useEffect(() => {
    const containerElement = autocompleteRef.current;
    
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
          libraries: ['places']
        });

        await loader.importLibrary('places');
        console.log('Google Maps API loaded successfully');
        
        // Initialize Places service for place details retrieval
        const mapDiv = document.createElement('div');
        const map = new google.maps.Map(mapDiv, {
          center: { lat: 0, lng: 0 },
          zoom: 1
        });
        placesService.current = new google.maps.places.PlacesService(map);

        if (containerElement) {
          // Create the basic place autocomplete element
          const autocompleteElement = document.createElement('gmp-basic-place-autocomplete');
          autocompleteElement.setAttribute('placeholder', 'Search for an address...');
          
          if (countryRestriction) {
            autocompleteElement.setAttribute('included-region-codes', countryRestriction);
          }

          // Apply styles
          Object.assign(autocompleteElement.style, {
            display: 'block',
            width: '100%',
            minHeight: '44px',
            fontSize: '14px',
            fontFamily: 'Roboto, Arial, sans-serif',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            backgroundColor: 'white',
            boxSizing: 'border-box'
          });

          // Add event listener for place selection
          autocompleteElement.addEventListener('gmp-placeselect', handlePlaceChanged);
          console.log('Event listener added for place selection');

          // Append to container
          containerElement.appendChild(autocompleteElement);
        }

        setIsLoaded(true);
        console.log('Basic Place Autocomplete initialization completed successfully');
        
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setHasError(true);
        setIsLoaded(false);
      }
    };

    initializeGoogleMaps();
    
    return () => {
      if (containerElement) {
        const autocompleteElement = containerElement.querySelector('gmp-basic-place-autocomplete');
        if (autocompleteElement) {
          autocompleteElement.removeEventListener('gmp-placeselect', handlePlaceChanged);
          containerElement.removeChild(autocompleteElement);
        }
      }
    };
  }, [apiKey, countryRestriction, handlePlaceChanged]);

  return (
    <div 
      className="address-search-container"
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        width: '300px',
        fontFamily: 'Roboto, Arial, sans-serif',
        color: '#000'
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
      
      {isLoaded && !hasError && (
        <div 
          ref={autocompleteRef}
          style={{
            width: '100%',
            minHeight: '44px'
          }}
        />
      )}
    </div>
  );
};

export default AddressSearchBar;