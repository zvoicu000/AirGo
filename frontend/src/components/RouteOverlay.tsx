import React from 'react';
import { RouteResponse } from '../types';

interface RiskDialProps {
  value: number | undefined;
  label: string;
}

const RiskDial: React.FC<RiskDialProps> = ({ value, label }) => {
  // If value is undefined, show N/A with grey color
  if (value === undefined) {
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90 transform">
            <circle
              cx="40"
              cy="40"
              r="38"
              stroke="#9CA3AF"  // grey color
              strokeWidth="4"
              fill="none"
              className="opacity-25"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-500">N/A</span>
          </div>
        </div>
        <span className="mt-1 text-sm text-gray-600">{label}</span>
      </div>
    );
  }

  // Calculate percentage for the radial bar (0-5 maps to 0-100%)
  const percentage = (value / 5) * 100;
  
  // Calculate color based on value (green at 0 to red at 5)
  const getColor = (value: number) => {
    // Convert 0-5 range to 0-1
    const normalizedValue = value / 5;
    // Start with green (low risk) and transition to red (high risk)
    const red = Math.round(normalizedValue * 255);
    const green = Math.round((1 - normalizedValue) * 255);
    return `rgb(${red}, ${green}, 0)`;
  };

  // Calculate the stroke dash array for the progress arc
  const circumference = 2 * Math.PI * 38; // radius = 38 (slightly smaller than container)
  const strokeDasharray = `${(percentage * circumference) / 100} ${circumference}`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        {/* SVG for radial bar */}
        <svg className="w-full h-full -rotate-90 transform">
          {/* Background circle */}
          <circle
            cx="40"
            cy="40"
            r="38"
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
            className="opacity-25"
          />
          {/* Progress circle with gradient */}
          <circle
            cx="40"
            cy="40"
            r="38"
            stroke={getColor(value)}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray,
              strokeDashoffset: 0,
              transition: 'stroke-dasharray 0.5s ease-in-out',
            }}
          />
        </svg>
        {/* Value display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold">{value.toFixed(1)}</span>
        </div>
      </div>
      <span className="mt-1 text-sm text-gray-600">{label}</span>
    </div>
  );
};

interface RouteOverlayProps {
  routeData: RouteResponse | null;
  optimisedData: RouteResponse | null;
  hoveredRoute: 'original' | 'optimised' | null;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({ routeData, optimisedData, hoveredRoute }) => {
  if (!routeData) return null;

  // Determine which data to display based on hover state
  const displayData = hoveredRoute === 'optimised' && optimisedData ? optimisedData : routeData;

  return (
    <div className="absolute bottom-7 left-1/2 z-[1000] bg-white/70 backdrop-blur-md shadow-md p-4 border-2 border-gray-200 max-w-[800px] w-[calc(100%-80px)] transform -translate-x-1/2">
      <div className="grid grid-cols-5 gap-4">
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{displayData.routeDistance.toFixed(1)}</span>
          <span className="text-sm text-gray-600">Distance (km)</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{displayData.populationImpact.toLocaleString()}</span>
          <span className="text-sm text-gray-600">Population Impact</span>
        </div>
        <RiskDial 
          value={displayData.noiseImpactScore} 
          label="Noise Impact"
        />
        <RiskDial 
          value={displayData.visibilityRisk} 
          label="Visibility Risk"
        />
        <RiskDial 
          value={displayData.windRisk} 
          label="Wind Risk"
        />
      </div>
      {optimisedData && (
        <div className="mt-2 text-sm text-center text-gray-600">
          {hoveredRoute === 'optimised' ? 'Showing optimised route metrics' : 'Showing original route metrics'} - Hover over routes to compare
        </div>
      )}
    </div>
  );
};

export default RouteOverlay;