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
  const debugListener = useRef<((event: Event) => void) | null>(null);

  const handlePlaceChanged = useCallback(async (event: Event) => {
    console.log('🎯 Place selection event triggered:', event);
    const customEvent = event as CustomEvent<{place_id: string}>;
    const placeId = customEvent.detail?.place_id;
    
    console.log('📍 Place ID received:', placeId);
    console.log('🗺️ Places service available:', !!placesService.current);
    
    if (!placeId || !placesService.current) {
      console.warn('No valid place ID or Places service not available');
      return;
    }

    const request = {
      placeId: placeId,
      fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id', 'types']
    };

    console.log('🔍 Making place details request for:', request);

    placesService.current.getDetails(request, (place, status) => {
      console.log('📋 Place details response:', { status, place });
      
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        console.log('✅ Place details received successfully:', {
          name: place.name,
          formatted_address: place.formatted_address,
          geometry: place.geometry
        });
        
        // The place returned by getDetails is already a PlaceResult, 
        // but we need to convert it to work with our Place interface
        const placeObject = {
          location: place.geometry?.location,
          formattedAddress: place.formatted_address,
          displayName: place.name
        } as google.maps.places.Place;
        
        console.log('🚀 Calling onPlaceSelected with:', placeObject);
        onPlaceSelected(placeObject);
      } else {
        console.error('❌ Place details request failed:', status);
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
          // Try multiple event names since the documentation might vary
          autocompleteElement.addEventListener('gmp-placeselect', handlePlaceChanged);
          autocompleteElement.addEventListener('place_changed', handlePlaceChanged);
          autocompleteElement.addEventListener('gmp-place-select', handlePlaceChanged);
          
          // Add a generic event listener to catch all events for debugging
          debugListener.current = (event: Event) => {
            console.log('🔍 Generic event caught:', event.type, event);
            console.log('🎯 Event target:', event.target);
            console.log('🎯 Event target text:', (event.target as HTMLElement)?.textContent);
            console.log('🎯 Event target innerHTML:', (event.target as HTMLElement)?.innerHTML);
            
            // If it's a click event, try to extract place information
            if (event.type === 'click') {
              console.log('🖱️ Click detected, attempting to extract place info...');
              
              // First, try to get address from the clicked element
              const clickedElement = event.target as HTMLElement;
              const clickedText = clickedElement?.textContent?.trim();
              
              if (clickedText && clickedText.length > 5 && clickedText.includes(',')) {
                console.log('📍 Found address in clicked element:', clickedText);
                
                // Use the clicked text directly for geocoding
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: clickedText }, (results, status) => {
                  console.log('🌍 Geocoding results from clicked text:', { status, results });
                  
                  if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                    const result = results[0];
                    console.log('✅ Geocoding successful from clicked text:', result);
                    
                    const placeObject = {
                      location: result.geometry.location,
                      formattedAddress: result.formatted_address,
                      displayName: result.formatted_address
                    } as google.maps.places.Place;
                    
                    console.log('🚀 Calling onPlaceSelected from clicked text with:', placeObject);
                    onPlaceSelected(placeObject);
                    return; // Exit early if successful
                  } else {
                    console.error('❌ Geocoding failed for clicked text:', status);
                  }
                });
              }
              
              const tryExtractPlace = (delay: number, attempt: number) => {
                setTimeout(() => {
                  const input = autocompleteElement.querySelector('input');
                  console.log(`🔍 Attempt ${attempt} (${delay}ms delay) - Input found:`, !!input);
                  console.log(`🔍 Input value:`, input?.value || 'EMPTY');
                  console.log(`🔍 Input placeholder:`, input?.placeholder || 'NO_PLACEHOLDER');
                  console.log(`🔍 Input attributes:`, input ? Array.from(input.attributes).map(a => `${a.name}="${a.value}"`).join(', ') : 'NO_INPUT');
                  
                  if (input && input.value && input.value.trim().length > 0) {
                    console.log('📝 Input value found after delay:', input.value);
                    
                    // Use Geocoding service as fallback
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ address: input.value }, (results, status) => {
                      console.log('🌍 Geocoding results:', { status, results });
                      
                      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                        const result = results[0];
                        console.log('✅ Geocoding successful:', result);
                        
                        // Create a place object from geocoding result
                        const placeObject = {
                          location: result.geometry.location,
                          formattedAddress: result.formatted_address,
                          displayName: result.formatted_address
                        } as google.maps.places.Place;
                        
                        console.log('🚀 Calling onPlaceSelected from click handler with:', placeObject);
                        onPlaceSelected(placeObject);
                      } else {
                        console.error('❌ Geocoding failed:', status);
                      }
                    });
                  } else if (attempt < 5) {
                    console.log(`❓ No input value found after ${delay}ms delay, trying again...`);
                    // Try again with longer delay
                    tryExtractPlace(delay * 2, attempt + 1);
                  } else {
                    console.log('❌ Failed to extract input value after multiple attempts');
                  }
                }, delay);
              };
              
              // Start with 100ms delay and retry with increasing delays
              tryExtractPlace(100, 1);
            }
            
            // Also try to handle change events
            if (event.type === 'change' || event.type === 'input') {
              console.log('📝 Input change detected, attempting to extract place info...');
              
              setTimeout(() => {
                const input = autocompleteElement.querySelector('input');
                if (input && input.value && input.value.length > 5) { // Only process if meaningful input
                  console.log('📝 Input value found from change event:', input.value);
                  
                  const geocoder = new google.maps.Geocoder();
                  geocoder.geocode({ address: input.value }, (results, status) => {
                    console.log('🌍 Geocoding results from change:', { status, results });
                    
                    if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                      const result = results[0];
                      console.log('✅ Geocoding successful from change:', result);
                      
                      const placeObject = {
                        location: result.geometry.location,
                        formattedAddress: result.formatted_address,
                        displayName: result.formatted_address
                      } as google.maps.places.Place;
                      
                      console.log('🚀 Calling onPlaceSelected from change handler with:', placeObject);
                      onPlaceSelected(placeObject);
                    }
                  });
                }
              }, 200);
            }
          };
          
          ['gmp-placeselect', 'place_changed', 'gmp-place-select', 'click', 'change', 'input'].forEach(eventType => {
            autocompleteElement.addEventListener(eventType, debugListener.current!);
          });
          
          console.log('Event listeners added for place selection with debug listeners');

          // Append to container
          containerElement.appendChild(autocompleteElement);
          
          // Add MutationObserver to watch for input value changes
          setTimeout(() => {
            const input = autocompleteElement.querySelector('input');
            if (input) {
              console.log('🔍 Setting up MutationObserver for input changes');
              
              let lastValue = '';
              const observer = new MutationObserver(() => {
                if (input.value !== lastValue && input.value.length > 5) {
                  console.log('🔄 Input value changed via MutationObserver:', input.value);
                  lastValue = input.value;
                  
                  // Use geocoding to get place info
                  const geocoder = new google.maps.Geocoder();
                  geocoder.geocode({ address: input.value }, (results, status) => {
                    if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                      const result = results[0];
                      console.log('✅ Geocoding successful from MutationObserver:', result);
                      
                      const placeObject = {
                        location: result.geometry.location,
                        formattedAddress: result.formatted_address,
                        displayName: result.formatted_address
                      } as google.maps.places.Place;
                      
                      console.log('🚀 Calling onPlaceSelected from MutationObserver with:', placeObject);
                      onPlaceSelected(placeObject);
                    }
                  });
                }
              });
              
              observer.observe(input, {
                attributes: true,
                attributeFilter: ['value'],
                childList: true,
                subtree: true
              });
              
              // Also use setInterval as a fallback
              const intervalCheck = setInterval(() => {
                if (input.value !== lastValue && input.value.length > 5) {
                  console.log('🔄 Input value changed via interval:', input.value);
                  lastValue = input.value;
                  
                  const geocoder = new google.maps.Geocoder();
                  geocoder.geocode({ address: input.value }, (results, status) => {
                    if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                      const result = results[0];
                      console.log('✅ Geocoding successful from interval:', result);
                      
                      const placeObject = {
                        location: result.geometry.location,
                        formattedAddress: result.formatted_address,
                        displayName: result.formatted_address
                      } as google.maps.places.Place;
                      
                      console.log('🚀 Calling onPlaceSelected from interval with:', placeObject);
                      onPlaceSelected(placeObject);
                    }
                  });
                }
              }, 500);
              
              // Clean up interval after 10 seconds
              setTimeout(() => {
                clearInterval(intervalCheck);
                observer.disconnect();
              }, 10000);
            }
          }, 1000);
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
          autocompleteElement.removeEventListener('place_changed', handlePlaceChanged);
          autocompleteElement.removeEventListener('gmp-place-select', handlePlaceChanged);
          
          if (debugListener.current) {
            ['gmp-placeselect', 'place_changed', 'gmp-place-select', 'click', 'change', 'input'].forEach(eventType => {
              autocompleteElement.removeEventListener(eventType, debugListener.current!);
            });
          }
          
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