import React, { useState } from 'react';
import MapView from './components/MapView';

const App: React.FC = () => {
  const [isFlightPlannerActive, setIsFlightPlannerActive] = useState(false);

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
        <MapView isFlightPlannerActive={isFlightPlannerActive} onCloseFlightPlanner={() => setIsFlightPlannerActive(false)} />
      </main>
    </div>
  );
};

export default App;