# Drone Planner Frontend

A React-based web application for visualizing drone delivery planning data on an interactive map.

## Features

- **Interactive Map**: OpenStreetMap integration with pan and zoom
- **Population Data**: 500m x 500m squares showing population density with color coding
- **Weather Stations**: Clickable weather icons showing temperature and wind speed
- **Dynamic Loading**: Data fetches automatically based on current map view
- **Responsive Design**: Built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The application will open at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

## API Integration

The application connects to the AWS API Gateway endpoint:
```
https://xyz.execute-api.region.amazonaws.com/prod/spatial/bounding-box
```

Query parameters:
- `latMin`: Minimum latitude
- `lonMin`: Minimum longitude  
- `latMax`: Maximum latitude
- `lonMax`: Maximum longitude

## Map Features

### Population Data
- Displayed as colored squares (500m x 500m)
- Color coding based on population density:
  - Yellow: < 2,000
  - Orange: 2,000 - 4,000
  - Red-Orange: 4,000 - 6,000
  - Dark Red: > 6,000

### Weather Data
- Displayed as sun icons
- Click to view temperature and wind speed
- Shows exact coordinates

## Technology Stack

- **React 18** with TypeScript
- **Leaflet** for map functionality
- **React-Leaflet** for React integration
- **Tailwind CSS** for styling
- **OpenStreetMap** tiles

## Deployment

This frontend is designed to be deployed using AWS CDK alongside the backend infrastructure in the monorepo structure.