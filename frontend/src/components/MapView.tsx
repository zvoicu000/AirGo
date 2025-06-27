import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, ZoomControl, Rectangle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ApiResponse, PopulationData, WeatherData, RouteResponse } from '../types';
import WeatherPopup from './WeatherPopup';
import RoutePlanner from './RoutePlanner';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Weather icon
const weatherIcon = new L.Icon({
  iconUrl: '/weather-icon.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface MapViewProps {
  isFlightPlannerActive: boolean;
  onCloseFlightPlanner: () => void;
  optimisedRoute: RouteResponse | null;
  apiBaseUrl: string;
}

const MapView: React.FC<MapViewProps> = ({ isFlightPlannerActive, onCloseFlightPlanner, optimisedRoute, apiBaseUrl }) => {
  const [mapData, setMapData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null);

  const fetchMapData = async (bounds: L.LatLngBounds) => {
    if (error) return; // Skip if an error has already occurred

    // Check if bounds are different. This prevents unnecessary API calls
    if (lastBoundsRef.current?.equals(bounds)) {
      return;
    }
    lastBoundsRef.current = bounds;

    setLoading(true);
    setError(null); // Reset error on new attempt

    try {
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();
      const url = `${apiBaseUrl}/spatial/bounding-box?latMin=${southWest.lat}&lonMin=${southWest.lng}&latMax=${northEast.lat}&lonMax=${northEast.lng}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      setMapData(data);
    } catch (err: any) {
      console.error('Error fetching map data:', err);
      setError('Failed to load map data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const MapEvents = () => {
    const map = useMapEvents({
      moveend: () => {
        fetchMapData(map.getBounds());
      },
      zoomend: () => {
        fetchMapData(map.getBounds());
      },
    });

    // Invalidate map size on initial load
    useEffect(() => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
      fetchMapData(map.getBounds());
    }, [map]);

    return null;
  };

  const LocateControl: React.FC = () => {
    const map = useMapEvents({});

    useEffect(() => {
      const locateControl = new L.Control({ position: 'bottomright' });

      locateControl.onAdd = () => {
        const container = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
        container.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="black"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              viewBox="0 0 24 24" width="20" height="20">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        `;
        container.title = 'Center on your location';
        container.style.width = '34px';
        container.style.height = '34px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.cursor = 'pointer';
        container.style.backgroundColor = 'white';
        container.style.border = '2px solid #ccc';

        container.onclick = () => {
          map.locate({
            setView: true,
            maxZoom: 12,
          });
        };

        return container;
      };

      locateControl.addTo(map);

      // Optional cleanup
      return () => {
        locateControl.remove();
      };
    }, [map]);

    return null;
  };

  const getPopulationSquare = (item: PopulationData) => {
    const lat = item.lat;
    const lon = item.lon;

    // Create a square around the point with a fixed offset
    const latOffset = 0.00450;
    const lonOffset = 0.00725;

    return [
      [lat - latOffset, lon - lonOffset],
      [lat + latOffset, lon + lonOffset],
    ] as [[number, number], [number, number]];
  };

  const getPopulationColor = (population: number) => {
    if (population > 6000) return '#8B0000';
    if (population > 4000) return '#FF4500';
    if (population > 2000) return '#FFA500';
    return '#FFFF00';
  };

  return (
    <div className="flex-1 relative">
      {error && (
        <div className="absolute top-4 left-4 z-[1000] bg-red-100 text-red-700 px-3 py-2 rounded shadow-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="absolute top-24 right-4 z-[1000] bg-white px-3 py-2 rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={[51.25, -0.6]}
        zoom={12}
        maxZoom={15}
        minZoom={9}
        scrollWheelZoom={false}
        preferCanvas={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors | &copy; Ian Brumby <a href="https://crockwell.com" target="_blank">Crockwell Solutions</a> | Carnell, E. Tomlinson, S.J. Reis, S. (2025). <a href="https://www.data.gov.uk/dataset/076cef76-337c-4e5f-8123-ef660e53a836/uk-gridded-population-at-1-km-resolution-for-2021-based-on-census-2021-2022-and-land-cover-2021" target="_blank">UK Gridded Population Data</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png"
        />

        <ZoomControl position="bottomright" />
        <LocateControl />
        <MapEvents />

        {isFlightPlannerActive && (
            <div className="absolute top-28 left-4 z-[1100]">
              <RoutePlanner
              isFlightPlannerActive={isFlightPlannerActive} 
              onCloseFlightPlanner={onCloseFlightPlanner}
              optimisedRoute={optimisedRoute}
              apiBaseUrl={apiBaseUrl}
              />
            </div>
        )}

        {mapData?.items.map((item, index) => {
          if (item.type === 'Population') {
            const populationItem = item as PopulationData;
            const bounds = getPopulationSquare(populationItem);
            const color = getPopulationColor(populationItem.population);

            return (
              <Rectangle
                key={`pop-${index}`}
                bounds={bounds}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.4,
                  color: color,
                  weight: 0,
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-green-600">Population Data</h3>
                    <p>Population: {populationItem.population.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">
                      {populationItem.lat.toFixed(4)}, {populationItem.lon.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Rectangle>
            );
          } else if (item.type === 'Weather') {
            const weatherItem = item as WeatherData;

            return (
              <Marker
                key={`weather-${index}`}
                position={[parseFloat(weatherItem.lat), parseFloat(weatherItem.lon)]}
                icon={weatherIcon}
              >
                <Popup>
                  <WeatherPopup weather={weatherItem} />
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
