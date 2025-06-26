import React, { useState, useRef } from 'react';
import MapView from './components/MapView';
import { RouteResponse } from './types';

import output from './cdk-output.json';

// use the output from the CDK stack deployment
const REST_API_URL = output.StatelessStack.restApiUrl;
const EVENTS_HTTP_DOMAIN = output.StatelessStack.eventsHttpDomain;
const EVENTS_REALTIME_DOMAIN = output.StatelessStack.eventsRealtimeDomain;
const EVENTS_API_KEY = output.StatelessStack.eventsApiKey;
const authorization = { 'x-api-key': EVENTS_API_KEY, host: EVENTS_HTTP_DOMAIN };

const App: React.FC = () => {
  const [isFlightPlannerActive, setIsFlightPlannerActive] = useState(false);
  const [optimisedRoute, setOptimisedRoute] = useState<RouteResponse | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectingRef = useRef<boolean>(false);

  // construct the protocol header for the connection
  function getAuthProtocol() {
    const header = btoa(JSON.stringify(authorization))
      .replace(/\+/g, '-') // Convert '+' to '-'
      .replace(/\//g, '_') // Convert '/' to '_'
      .replace(/=+$/, ''); // Remove padding `=`
    return `header-${header}`;
  }

  const connectWebSocket = React.useCallback(() => {
    return new Promise<WebSocket>((resolve, reject) => {
      console.log('Attempting to create WebSocket connection...');
      const socket = new WebSocket(`wss://${EVENTS_REALTIME_DOMAIN}/event/realtime`, [
        'aws-appsync-event-ws',
        getAuthProtocol(),
      ]);

      socket.onopen = () => resolve(socket);
      socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.reason);
        // If the connection was closed unexpectedly and we still have a reference, try to reconnect
        if (wsRef.current === socket && !reconnectingRef.current) {
          wsRef.current = null;
          console.log('Attempting to reconnect...');
          reconnectingRef.current = true;
          connectWebSocket()
            .then((newSocket) => {
              wsRef.current = newSocket;
              reconnectingRef.current = false;
            })
            .catch((err) => {
              console.error('Reconnection failed:', err);
              reconnectingRef.current = false;
            });
        }
      };
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
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
  }, []);

  React.useEffect(() => {
    if (!wsRef.current) {
      connectWebSocket()
        .then((socket) => {
          wsRef.current = socket;
          socket.send(
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
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
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
