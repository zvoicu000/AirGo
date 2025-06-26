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
              setOptimisedRoute(JSON.parse(message.event));
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

  return (
    <div className="App">
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-white/70 backdrop-blur-md shadow-md">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Drone SoundAware</h1>
            <p className="text-sm text-gray-600 italic">Route with Respect — Minimise Noise, Maximise Impact</p>
          </div>
          <button
            onClick={() => setIsFlightPlannerActive(!isFlightPlannerActive)}
            className={`px-4 py-2 rounded font-medium ${
              isFlightPlannerActive
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {isFlightPlannerActive ? 'Close Operations Planner' : 'Operations Planner'}
          </button>
        </div>
      </header>
      
      <main className="h-screen">
        <MapView 
          isFlightPlannerActive={isFlightPlannerActive} 
          onCloseFlightPlanner={() => setIsFlightPlannerActive(false)}
          optimisedRoute={optimisedRoute}
          apiBaseUrl={REST_API_URL}
        />
      </main>
    </div>
  );
};

export default App;