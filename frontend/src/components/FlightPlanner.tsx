import React, { useState, useEffect } from 'react';
import { Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Spinner from './Spinner';
import RouteOverlay from './RouteOverlay';
import { RouteResponse } from '../types';

// Custom icons for start and end markers
const startIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyMkM1NUUiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNMTIgMkwxMy4wOSA4LjI2TDIwIDlMMTMuMDkgMTUuNzRMMTIgMjJMMTAuOTEgMTUuNzRMNCA5TDEwLjkxIDguMjZMMTIgMloiLz4KPC9zdmc+Cjwvc3ZnPg==',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const endIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNMTkgMTNIMTNWMTlIMTFWMTNINVYxMUgxMVY1SDEzVjExSDE5VjEzWiIvPgo8L3N2Zz4KPC9zdmc+',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface FlightPlannerProps {
  isActive: boolean;
  onClose: () => void;
}

interface FlightResult extends RouteResponse {}

const FlightPlanner: React.FC<FlightPlannerProps> = ({ isActive, onClose }) => {
  const [startPosition, setStartPosition] = useState<[number, number] | null>(null);
  const [endPosition, setEndPosition] = useState<[number, number] | null>(null);
  const [flightResult, setFlightResult] = useState<FlightResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [placingMarker, setPlacingMarker] = useState<'start' | 'end' | null>(null);

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (!isActive || !placingMarker) return;
        
        const { lat, lng } = e.latlng;
        if (placingMarker === 'start') {
          setStartPosition([lat, lng]);
        } else {
          setEndPosition([lat, lng]);
        }
        setPlacingMarker(null);
      },
    });
    return null;
  };

  const calculateFlight = async () => {
    if (!startPosition || !endPosition) return;

    setIsCalculating(true);
    try {
      const API_BASE_URL = window.API_BASE_URL;
      const url = `${API_BASE_URL}/routes/assess-route?latStart=${startPosition[0]}&lonStart=${startPosition[1]}&latEnd=${endPosition[0]}&lonEnd=${endPosition[1]}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to calculate flight');
      
      const result = await response.json();
      setFlightResult(result);
    } catch (error) {
      console.error('Error calculating flight:', error);
      alert('Failed to calculate flight. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Call calculateFlight whenever start or end positions change
  useEffect(() => {
    if (startPosition && endPosition) {
      calculateFlight();
    }
  }, [startPosition, endPosition]);

  const clearFlight = () => {
    setStartPosition(null);
    setEndPosition(null);
    setFlightResult(null);
    setShowResult(false);
  };

  if (!isActive) return <MapClickHandler />;

  return (
    <>
      <MapClickHandler />
      
      {isCalculating && <Spinner size="lg" />}
      
      {/* Flight Planning Panel */}
      <div className="absolute top-24 left-4 z-[1000] bg-white/70 backdrop-blur-md shadow-md p-4 w-80 border-2 border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Create Flight</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        
        <div className="space-y-3">
          <div>
            <button
              onClick={() => setPlacingMarker('start')}
              className={`w-full p-2 rounded text-sm ${
                placingMarker === 'start' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {startPosition ? 'Change Start Position' : 'Set Start Position'}
            </button>
            {startPosition && (
              <p className="text-xs text-gray-600 mt-1">
                {startPosition[0].toFixed(4)}, {startPosition[1].toFixed(4)}
              </p>
            )}
          </div>
          
          <div>
            <button
              onClick={() => setPlacingMarker('end')}
              className={`w-full p-2 rounded text-sm ${
                placingMarker === 'end' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              {endPosition ? 'Change End Position' : 'Set End Position'}
            </button>
            {endPosition && (
              <p className="text-xs text-gray-600 mt-1">
                {endPosition[0].toFixed(4)}, {endPosition[1].toFixed(4)}
              </p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={calculateFlight}
              disabled={!startPosition || !endPosition || isCalculating}
              className="flex-1 bg-blue-600 text-white p-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-300"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Flight'}
            </button>
            <button
              onClick={clearFlight}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
        
        {placingMarker && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
            Click on the map to place the {placingMarker} marker
          </div>
        )}
      </div>

      {/* Map Markers */}
      {startPosition && (
        <Marker 
          position={startPosition} 
          icon={startIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              setStartPosition([position.lat, position.lng]);
            },
          }}
        >
          <Popup>Start Position</Popup>
        </Marker>
      )}
      
      {endPosition && (
        <Marker 
          position={endPosition} 
          icon={endIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              setEndPosition([position.lat, position.lng]);
            },
          }}
        >
          <Popup>End Position</Popup>
        </Marker>
      )}

      {/* Direct Line between Start and End */}
      {startPosition && endPosition && (
        <Polyline
          positions={[startPosition, endPosition]}
          pathOptions={{ color: '#EF4444', weight: 2, opacity: 0.6, dashArray: '5, 10' }}
        />
      )}

      {/* Optimised Flight Route */}
      {/* {flightResult && (
        <Polyline
          positions={flightResult.route.map(p => [p.lat, p.lon])}
          pathOptions={{ color: '#3B82F6', weight: 3, opacity: 0.8 }}
        />
      )} */}

      {/* Results Modal */}
      {showResult && flightResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Flight Calculation Results</h3>
              <button 
                onClick={() => setShowResult(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Route Points:</p>
                <p className="text-lg">{flightResult.route.length}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Population Impact:</p>
                <p className="text-lg">{flightResult.populationImpact.toLocaleString()}</p>
              </div>
              
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-600">
                  The optimised route is displayed on the map in blue.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowResult(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Overlay */}
      <RouteOverlay routeData={flightResult} />
    </>
  );
};

export default FlightPlanner;