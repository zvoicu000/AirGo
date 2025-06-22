import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Rectangle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ApiResponse, PopulationData, WeatherData } from '../types';
import WeatherPopup from './WeatherPopup';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Weather icon
const weatherIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkZENzAwIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiNGRkE1MDAiLz4KPC9zdmc+',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const API_BASE_URL = 'https://2j0zdcimf7.execute-api.eu-west-1.amazonaws.com/prod/spatial/bounding-box';

const MapView: React.FC = () => {
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
      const url = `${API_BASE_URL}?latMin=${southWest.lat}&lonMin=${southWest.lng}&latMax=${northEast.lat}&lonMax=${northEast.lng}`;

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

    useEffect(() => {
      fetchMapData(map.getBounds());
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
    <div className="relative h-screen w-full">
      {error && (
        <div className="absolute top-4 left-4 z-[1000] bg-red-100 text-red-700 px-3 py-2 rounded shadow-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white px-3 py-2 rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      <MapContainer center={[51.25, -0.6]} zoom={12} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents />

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

      {mapData && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white px-3 py-2 rounded shadow-lg">
          <span className="text-sm text-gray-600">{mapData.count} items displayed</span>
        </div>
      )}
    </div>
  );
};

export default MapView;
