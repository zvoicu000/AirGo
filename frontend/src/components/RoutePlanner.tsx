import React, { useState, useEffect, useCallback } from 'react';
import { Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  MapPin, 
  Wind, 
  Volume2, 
  Eye, 
  Users, 
  Route,
  RotateCcw,
  Layers,
  Target,
  AlertTriangle,
  CheckCircle,
  CircleX,
  Clock
} from 'lucide-react';
import { RouteResponse } from '../types';
import Spinner from './Spinner';

interface PlannerProps {
  isFlightPlannerActive: boolean;
  onCloseFlightPlanner: () => void;
  optimisedRoute: RouteResponse | null;
  apiBaseUrl: string;
}

interface FlightResult extends RouteResponse {}

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

export default function RoutePlanner({ 
  isFlightPlannerActive: isActive, 
  onCloseFlightPlanner, 
  optimisedRoute: receivedOptimisedRoute, 
  apiBaseUrl 
}: PlannerProps) {
  const [animatedValues, setAnimatedValues] = useState<{
    distance?: number;
    population?: number;
    noise?: number;
    visibility?: number;
    wind?: number;
  }>({
    distance: undefined,
    population: undefined,
    noise: undefined,
    visibility: undefined,
    wind: undefined
  });
  const [startPosition, setStartPosition] = useState<[number, number] | null>(null);
  const [endPosition, setEndPosition] = useState<[number, number] | null>(null);
  const [flightResult, setFlightResult] = useState<FlightResult | null>(null);
  const [optimisedRoute, setOptimisedRoute] = useState<FlightResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOptimising, setIsOptimising] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [placingMarker, setPlacingMarker] = useState<'start' | 'end' | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<'original' | 'optimised' | null>(null);

  const metrics = [
    { 
      key: 'distance', 
      label: 'Distance', 
      value: animatedValues.distance !== undefined ? animatedValues.distance.toFixed(1) : 'N/A', 
      unit: 'km', 
      icon: Route, 
      color: 'blue',
      status: animatedValues.distance !== undefined ? animatedValues.distance < 50 ? 'good' : animatedValues.distance < 100 ? 'moderate' : 'poor' : 'unknown',
      width: animatedValues.distance !== undefined ? `${animatedValues.distance}%` : '0%',
    },
    { 
      key: 'population', 
      label: 'Population Impact', 
      value: animatedValues.population !== undefined ? Math.floor(animatedValues.population) : 'N/A', 
      unit: '', 
      icon: Users, 
      color: 'purple',
      status: animatedValues.population !== undefined ? animatedValues.population < 1000 ? 'good' : animatedValues.population < 3000 ? 'moderate' : 'poor' : 'unknown',
      width: animatedValues.population !== undefined ? `${animatedValues.population / 50}%` : '0%',
    },
    { 
      key: 'noise', 
      label: 'Noise Impact', 
      value: animatedValues.noise !== undefined ? animatedValues.noise.toFixed(1) : 'N/A', 
      unit: '', 
      icon: Volume2, 
      color: 'green',
      status: animatedValues.noise !== undefined ? animatedValues.noise < 0.5 ? 'excellent' : animatedValues.noise < 1 ? 'good' : animatedValues.noise < 3 ? 'moderate' : 'poor' : 'unknown',
      width: animatedValues.noise !== undefined ? `${animatedValues.noise * 20}%` : '0%',
    },
    { 
      key: 'visibility', 
      label: 'Visibility Risk', 
      value: animatedValues.visibility !== undefined ? animatedValues.visibility.toFixed(1) : 'N/A', 
      unit: '', 
      icon: Eye, 
      color: 'emerald',
      status: animatedValues.visibility !== undefined ? animatedValues.visibility < 0.5 ? 'excellent' : animatedValues.visibility < 1 ? 'good' : animatedValues.visibility < 3 ? 'moderate' : 'poor' : 'unknown',
      width: animatedValues.visibility !== undefined ? `${animatedValues.visibility * 20}%` : '0%',
    },
    { 
      key: 'wind', 
      label: 'Wind Risk', 
      value: animatedValues.wind !== undefined ? animatedValues.wind.toFixed(1) : 'N/A', 
      unit: '', 
      icon: Wind, 
      color: 'orange',
      status: animatedValues.wind !== undefined ? animatedValues.wind < 0.5 ? 'excellent' : animatedValues.wind < 1 ? 'good' : animatedValues.wind < 3 ? 'moderate' : 'poor' : 'unknown',
      width: animatedValues.wind !== undefined ? `${animatedValues.wind * 20}%` : '0%',
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-emerald-500';
      case 'good': return 'text-green-500';
      case 'moderate': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good': return CheckCircle;
      case 'moderate': return Clock;
      case 'poor': return AlertTriangle;
      default: return Clock;
    }
  };

  // Set initial marker placement when dialog becomes active
  useEffect(() => {
    if (isActive && !startPosition && !endPosition) {
      setPlacingMarker('start');
    }
  }, [isActive, startPosition, endPosition]);

  useEffect(() => {
    if (hoveredRoute === 'optimised' && optimisedRoute) {
      setAnimatedValues({
        distance: optimisedRoute.routeDistance,
        population: optimisedRoute.populationImpact,
        noise: optimisedRoute.noiseImpactScore,
        visibility: optimisedRoute.visibilityRisk,
        wind: optimisedRoute.windRisk
      });
    } else if (hoveredRoute === 'original' && flightResult) {
      setAnimatedValues({
        distance: flightResult.routeDistance,
        population: flightResult.populationImpact,
        noise: flightResult.noiseImpactScore,
        visibility: flightResult.visibilityRisk,
        wind: flightResult.windRisk
      });
    }
  }, [hoveredRoute, optimisedRoute, flightResult]);

  useEffect(() => {
    // Only run if placingMarker is active
    if (!placingMarker) return;

    // Get the map container element
    const map = document.querySelector('.leaflet-container') as HTMLElement | null;
    if (map) {
      map.style.cursor = 'crosshair'; // or any cursor you want
    }

    // Cleanup: reset cursor when done
    return () => {
      if (map) {
        map.style.cursor = '';
      }
    };
  }, [placingMarker]);

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
      setAnimatedValues({
        ...(result.routeDistance !== undefined && { distance: parseFloat(result.routeDistance) }),
        ...(result.populationImpact !== undefined && { population: parseFloat(result.populationImpact) }),
        ...(result.noiseImpactScore !== undefined && { noise: parseFloat(result.noiseImpactScore) }),
        ...(result.visibilityRisk !== undefined && { visibility: parseFloat(result.visibilityRisk) }),
        ...(result.windRisk !== undefined && { wind: parseFloat(result.windRisk) })
      });
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

      if (!response.ok) throw new Error('Failed to send route for optimisation');
    } catch (error) {
      console.error('Error sending route for optimisation:', error);
      alert('Failed to send route for optimisation. Please try again.');
    }
  };

  // Update optimisedRoute when received from websocket
  useEffect(() => {
    if (receivedOptimisedRoute) {
      setOptimisedRoute(receivedOptimisedRoute);
      setIsOptimising(false);
      setShowResult(true); // Show the results modal when optimised route is received
      setAnimatedValues({
        distance: receivedOptimisedRoute.routeDistance || 0,
        population: receivedOptimisedRoute.populationImpact || 0,
        noise: receivedOptimisedRoute.noiseImpactScore || 0,
        visibility: receivedOptimisedRoute.visibilityRisk || 0,
        wind: receivedOptimisedRoute.windRisk || 0
      });
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
    setIsOptimising(false);
    setShowResult(false);
  };

  if (!isActive) return null;

  return (
    <>
      <MapClickHandler />
      
      {isCalculating && <Spinner size="lg" />}

      <div className="w-80 bg-gray-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col max-h-[calc(100vh-7rem)] rounded-lg shadow-xl overflow-hidden">
        {/* Planning Controls */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-400" />
            Plan your Operation
          </h2>
          
          <div className="space-y-4">
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Start Position</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={startPosition ? `${startPosition[0].toFixed(4)}, ${startPosition[1].toFixed(4)}` : ''}
                  readOnly
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-200 text-white placeholder-gray-400"
                  placeholder="Select Start Position"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors">
                  <MapPin className="w-4 h-4 text-green-400" />
                </button>
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">End Position</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={endPosition ? `${endPosition[0].toFixed(4)}, ${endPosition[1].toFixed(4)}` : ''}
                  readOnly
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-200 text-white placeholder-gray-400"
                  placeholder="Select End Position"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors">
                  <MapPin className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            { flightResult && (
              <button 
                onClick={optimiseRoute}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg shadow-green-500/20"
              >
                {optimisedRoute ? (
                  <span className="flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Route Optimised!
                  </span>
                ) : isOptimising ? (
                    <span className="flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 mr-2 animate-spin" />
                    Route Optimising...
                    </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Route className="w-5 h-5 mr-2" />
                    Optimise Route
                  </span>
                )}
              </button>
            )}

            { flightResult && (
                <button 
                onClick={clearFlight}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-500/20"
                >
                <span className="flex items-center justify-center">
                  <CircleX className="w-5 h-5 mr-2 text-white" />
                  <span className="text-white">Clear Flight</span>
                </span>
                </button>
            )}
          </div>
        </div>

        {/* Route Metrics */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Layers className="w-5 h-5 mr-2 text-purple-400" />
            Route Analysis
          </h3>
          
          <div className="space-y-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const StatusIcon = getStatusIcon(metric.status);
              
              return (
                <div 
                  key={metric.key}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 bg-white/5 hover:bg-white/10 border border-white/10`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-5 h-5 text-blue-400" />
                      <span className="font-medium text-sm">{metric.label}</span>
                    </div>
                    <StatusIcon className={`w-4 h-4 ${getStatusColor(metric.status)}`} />
                  </div>
                  
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold">{metric.value}</span>
                    {metric.unit && <span className="text-sm text-gray-400">{metric.unit}</span>}
                  </div>
                  
                  <div className="mt-2 bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r from-${metric.color}-400 to-${metric.color}-500 transition-all duration-1000 ease-out`}
                      style={{ 
                        width: metric.width || '100%'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {showResult && flightResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-gray-700 font-semibold">Flight Optimisation Results</h3>
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
                    <td className="py-1 text-gray-700">Distance</td>
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
                    <td className="py-1 text-gray-700">Population Impact</td>
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
                    <td className="py-1 text-gray-700">Noise Impact</td>
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
                    <td className="py-1 text-gray-700">Visibility Risk</td>
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
                    <td className="py-1 text-gray-700">Wind Risk</td>
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
              setOptimisedRoute(null); // Clear optimised route when start position changes
              setShowResult(false); // Hide the results modal
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
              setOptimisedRoute(null); // Clear optimised route when end position changes
              setShowResult(false); // Hide the results modal
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

      {/* Original Flight Route - Invisible hover buffer */}
      {flightResult && (
        <Polyline
          positions={flightResult.route.map(p => [p.lat, p.lon])}
          pathOptions={{
            color: '#000', // color doesn't matter, it's invisible
            weight: 30,    // wide hitbox
            opacity: 0,    // invisible
            pane: 'shadowPane', // render below visible lines
          }}
          eventHandlers={{
            mouseover: () => setHoveredRoute('original'),
            mouseout: () => setHoveredRoute(optimisedRoute ? 'optimised' : null)
          }}
        />
      )}
      {/* Original Flight Route */}
      {flightResult && (
        <Polyline
          positions={flightResult.route.map(p => [p.lat, p.lon])}
          pathOptions={{ 
            color: '#3B82F6', 
            weight: hoveredRoute === 'original' ? 8 : 3, 
            opacity: hoveredRoute === 'optimised' ? 0.4 : 0.4
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
    </>
  );
}