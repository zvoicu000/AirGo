import React, { useState, useEffect, useCallback } from 'react';
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
  apiBaseUrl: string;
  optimisedRoute: RouteResponse | null;
}

interface FlightResult extends RouteResponse {}

const FlightPlanner: React.FC<FlightPlannerProps> = ({ isActive, onClose, apiBaseUrl, optimisedRoute: receivedOptimisedRoute }) => {
  const [startPosition, setStartPosition] = useState<[number, number] | null>(null);
  const [endPosition, setEndPosition] = useState<[number, number] | null>(null);
  const [flightResult, setFlightResult] = useState<FlightResult | null>(null);
  const [optimisedRoute, setOptimisedRoute] = useState<FlightResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOptimising, setIsOptimising] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [placingMarker, setPlacingMarker] = useState<'start' | 'end' | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<'original' | 'optimised' | null>(null);

  // Set initial marker placement when dialog becomes active
  useEffect(() => {
    if (isActive && !startPosition && !endPosition) {
      setPlacingMarker('start');
    }
  }, [isActive, startPosition, endPosition]);

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (!isActive || !placingMarker) return;
        
        const { lat, lng } = e.latlng;
        if (placingMarker === 'start') {
          setStartPosition([lat, lng]);
          setPlacingMarker('end'); // Automatically switch to end position
        } else {
          setEndPosition([lat, lng]);
          setPlacingMarker(null);
        }
      },
    });
    return null;
  };

  const calculateFlight = useCallback(async () => {
    if (!startPosition || !endPosition) return;

    setIsCalculating(true);
    try {
      const url = `${apiBaseUrl}/routes/assess-route?latStart=${startPosition[0]}&lonStart=${startPosition[1]}&latEnd=${endPosition[0]}&lonEnd=${endPosition[1]}`;
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
  }, [startPosition, endPosition, apiBaseUrl]);

  const optimiseRoute = async () => {
    if (!startPosition || !endPosition) return;

    setIsOptimising(true);
    try {
      const response = await fetch(`${apiBaseUrl}/routes/optimise-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startPoint: {
            lat: startPosition[0],
            lon: startPosition[1]
          },
          endPoint: {
            lat: endPosition[0],
            lon: endPosition[1]
          }
        })
      });

      if (!response.ok) throw new Error('Failed to optimise route');
      
      //const result = await response.json();
      //setOptimisedRoute(result);
      //setShowResult(true);
    } catch (error) {
      console.error('Error optimising route:', error);
      alert('Failed to optimise route. Please try again.');
    } finally {
      setIsOptimising(false);
    }
  };

  // Update optimisedRoute when received from websocket
  useEffect(() => {
    if (receivedOptimisedRoute) {
      setOptimisedRoute(receivedOptimisedRoute);
      setShowResult(true); // Show the results modal when optimised route is received
    }
  }, [receivedOptimisedRoute]);

  // Call calculateFlight whenever start or end positions change
  useEffect(() => {
    if (startPosition && endPosition) {
      calculateFlight();
    }
  }, [startPosition, endPosition, calculateFlight]);

  const clearFlight = () => {
    setStartPosition(null);
    setEndPosition(null);
    setFlightResult(null);
    setOptimisedRoute(null);
    setShowResult(false);
    setHoveredRoute(null);
  };

  if (!isActive) return <MapClickHandler />;

  return (
    <>
      <MapClickHandler />
      
      {isCalculating && <Spinner size="lg" />}
      
      {/* Flight Planning Panel */}
      <div className="absolute top-24 left-4 z-[1000] bg-white/70 backdrop-blur-md shadow-md p-4 w-80 border-2 border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Plan your Operation</h3>
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
              onClick={optimiseRoute}
              disabled={!flightResult || isOptimising}
              className="flex-1 bg-green-600 text-white p-2 rounded text-sm hover:bg-green-700 disabled:bg-gray-300"
            >
              {isOptimising ? 'Optimising...' : 'Optimise Route'}
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

      {/* Original Flight Route */}
      {flightResult && (
        <Polyline
          positions={flightResult.route.map(p => [p.lat, p.lon])}
          pathOptions={{ 
            color: '#3B82F6', 
            weight: hoveredRoute === 'original' ? 4 : 3, 
            opacity: hoveredRoute === 'optimised' ? 0.4 : 0.8 
          }}
          eventHandlers={{
            mouseover: () => setHoveredRoute('original'),
            mouseout: () => setHoveredRoute(null)
          }}
        />
      )}

      {/* Optimised Flight Route */}
      {optimisedRoute && (
        <Polyline
          positions={optimisedRoute.route.map(p => [p.lat, p.lon])}
          pathOptions={{ 
            color: '#22C55E', 
            weight: hoveredRoute === 'optimised' ? 4 : 3, 
            opacity: hoveredRoute === 'original' ? 0.4 : 0.8 
          }}
          eventHandlers={{
            mouseover: () => setHoveredRoute('optimised'),
            mouseout: () => setHoveredRoute(null)
          }}
        />
      )}

      {/* Results Modal */}
      {showResult && flightResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Flight Optimisation Results</h3>
              <button 
                onClick={() => setShowResult(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-gray-700 pb-2">Metric</th>
                    <th className="text-right font-medium text-gray-700 pb-2">Planned</th>
                    <th className="text-right font-medium text-gray-700 pb-2">Optimised</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1">Distance</td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? flightResult.routeDistance > optimisedRoute.routeDistance
                            ? 'text-red-600'
                            : flightResult.routeDistance < optimisedRoute.routeDistance
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {flightResult.routeDistance.toFixed(1)} km
                    </td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? flightResult.routeDistance < optimisedRoute.routeDistance
                            ? 'text-red-600'
                            : flightResult.routeDistance > optimisedRoute.routeDistance
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {optimisedRoute?.routeDistance.toFixed(1)} km
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Population Impact</td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? flightResult.populationImpact > optimisedRoute.populationImpact
                            ? 'text-red-600'
                            : flightResult.populationImpact < optimisedRoute.populationImpact
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {flightResult.populationImpact.toLocaleString()}
                    </td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? flightResult.populationImpact < optimisedRoute.populationImpact
                            ? 'text-red-600'
                            : flightResult.populationImpact > optimisedRoute.populationImpact
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {optimisedRoute?.populationImpact.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Noise Impact</td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.noiseImpactScore || 0) > (optimisedRoute.noiseImpactScore || 0)
                            ? 'text-red-600'
                            : (flightResult.noiseImpactScore || 0) < (optimisedRoute.noiseImpactScore || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {flightResult.noiseImpactScore?.toFixed(2) || 'N/A'}
                    </td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.noiseImpactScore || 0) < (optimisedRoute.noiseImpactScore || 0)
                            ? 'text-red-600'
                            : (flightResult.noiseImpactScore || 0) > (optimisedRoute.noiseImpactScore || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {optimisedRoute?.noiseImpactScore?.toFixed(2) || 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Visibility Risk</td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.visibilityRisk || 0) > (optimisedRoute.visibilityRisk || 0)
                            ? 'text-red-600'
                            : (flightResult.visibilityRisk || 0) < (optimisedRoute.visibilityRisk || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {flightResult.visibilityRisk?.toFixed(2) || 'N/A'}
                    </td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.visibilityRisk || 0) < (optimisedRoute.visibilityRisk || 0)
                            ? 'text-red-600'
                            : (flightResult.visibilityRisk || 0) > (optimisedRoute.visibilityRisk || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {optimisedRoute?.visibilityRisk?.toFixed(2) || 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1">Wind Risk</td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.windRisk || 0) > (optimisedRoute.windRisk || 0)
                            ? 'text-red-600'
                            : (flightResult.windRisk || 0) < (optimisedRoute.windRisk || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {flightResult.windRisk?.toFixed(2) || 'N/A'}
                    </td>
                    <td
                      className={`text-right ${
                        optimisedRoute
                          ? (flightResult.windRisk || 0) < (optimisedRoute.windRisk || 0)
                            ? 'text-red-600'
                            : (flightResult.windRisk || 0) > (optimisedRoute.windRisk || 0)
                              ? 'text-green-600'
                              : 'text-gray-600'
                          : ''
                      }`}
                    >
                      {optimisedRoute?.windRisk?.toFixed(2) || 'N/A'}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-600">
                  Hover over the routes to highlight them. Lower values are shown in green, higher values in red.
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
      <RouteOverlay 
        routeData={flightResult} 
        optimisedData={optimisedRoute}
        hoveredRoute={hoveredRoute}
      />
    </>
  );
};

export default FlightPlanner;