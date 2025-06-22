import React from 'react';
import MapView from './components/MapView';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="absolute top-0 left-0 right-0 z-[1000] bg-white shadow-md">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Drone Planner</h1>
          <p className="text-sm text-gray-600">Interactive map showing population density and weather data</p>
        </div>
      </header>
      
      <main className="pt-20">
        <MapView />
      </main>
    </div>
  );
};

export default App;