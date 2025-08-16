import React from 'react';
import { WeatherData } from '../types';

interface WeatherPopupProps {
  weather: WeatherData;
}

const WeatherPopup: React.FC<WeatherPopupProps> = ({ weather }) => {
  return (
    <div className="p-3 min-w-48">
      <h3 className="font-bold text-lg mb-2 text-blue-600">Weather Station</h3>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-600">Temperature:</span>
          <span className="font-semibold">{weather.temperature}°C</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Wind Speed:</span>
          <span className="font-semibold">{weather.windSpeed} m/s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Location:</span>
          <span className="font-mono text-sm">{weather.lat}, {weather.lon}</span>
        </div>
      </div>
    </div>
  );
};

export default WeatherPopup;