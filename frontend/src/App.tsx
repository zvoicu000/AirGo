import React, { useState, useRef } from 'react';
import MapView from './components/MapView';
import { RouteResponse } from './types';

import output from './cdk-output.json'

// use the output from the CDK stack deployment
const REST_API_URL = output.StatelessStack.restApiUrl;
const EVENTS_HTTP_DOMAIN = output.StatelessStack.eventsHttpDomain;
const EVENTS_REALTIME_DOMAIN = output.StatelessStack.eventsRealtimeDomain;
const EVENTS_API_KEY = output.StatelessStack.eventsApiKey;
const authorization = { 'x-api-key': EVENTS_API_KEY, host: EVENTS_HTTP_DOMAIN }

const App: React.FC = () => {
  const [isFlightPlannerActive, setIsFlightPlannerActive] = useState(false);
  const [optimisedRoute, setOptimisedRoute] = useState<RouteResponse | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // construct the protocol header for the connection
  function getAuthProtocol() {
    const header = btoa(JSON.stringify(authorization))
      .replace(/\+/g, '-') // Convert '+' to '-'
      .replace(/\//g, '_') // Convert '/' to '_'
      .replace(/=+$/, '') // Remove padding `=`
    return `header-${header}`
  }

  React.useEffect(() => {
    const connectWebSocket = () => {
      return new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(`wss://${EVENTS_REALTIME_DOMAIN}/event/realtime`, [
          'aws-appsync-event-ws',
          getAuthProtocol(),
        ]);
        socket.onopen = () => resolve(socket);
        socket.onclose = (event) => reject(new Error(event.reason));
        socket.onmessage = (evt) => {
          try {
            const message = JSON.parse(evt.data);
            if (message.type === 'data') {
              console.log('Received WebSocket message:', message);
              setOptimisedRoute(JSON.parse(message.event)?.data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      });
    };

    let ws: WebSocket | null = null;

    connectWebSocket()
      .then((socket) => {
        ws = socket;
        wsRef.current = socket;
        // subscribe to `/default/*`
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            id: crypto.randomUUID(),
            channel: '/default/*',
            authorization,
          }),
        );
        console.log('WebSocket connection established');
      })
      .catch((err) => {
        console.error('WebSocket connection failed:', err);
      });

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Add this effect inside your App component
  React.useEffect(() => {
    if (!isFlightPlannerActive) {
      setOptimisedRoute(null);
    }
  }, [isFlightPlannerActive]);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Header - Fixed position */}
      <div className="fixed top-2 left-4 right-4 z-[1000] bg-black/30 backdrop-blur-xl border-r border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="p-1">
              <a href="/">
                <img src="/drone-icon.png" alt="Drone Icon" className="w-11 h-11" />
              </a>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Drone SoundAware
              </h1>
              <p className="text-sm text-gray-400">Route with Respect — Minimise Noise, Maximise Impact</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsFlightPlannerActive(!isFlightPlannerActive)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
            >
              {isFlightPlannerActive ? 'Close Operations Planner' : 'Open Operations Planner'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-full">
        <MapView 
          isFlightPlannerActive={isFlightPlannerActive} 
          onCloseFlightPlanner={() => setIsFlightPlannerActive(false)}
          optimisedRoute={optimisedRoute}
          apiBaseUrl={REST_API_URL}
        />
      </div>
    </div>
  );
};

export default App;
