import React from 'react';
import { render, screen } from '@testing-library/react';
import RouteOverlay from '../RouteOverlay';

describe('RouteOverlay', () => {
  const mockRouteData = {
    routeDistance: 10.5,
    populationImpact: 1500,
    populationImpactScore: 2.5,
    visibilityRisk: 3.7,
    windRisk: 4.2,
  };

  it('renders all risk dials with correct values', () => {
    render(<RouteOverlay routeData={mockRouteData} />);

    // Check if all values are displayed
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('3.7')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();

    // Check if labels are displayed
    expect(screen.getByText('Population Score')).toBeInTheDocument();
    expect(screen.getByText('Visibility Risk')).toBeInTheDocument();
    expect(screen.getByText('Wind Risk')).toBeInTheDocument();
  });

  it('renders distance and population impact', () => {
    render(<RouteOverlay routeData={mockRouteData} />);

    expect(screen.getByText('10.5')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('Distance (km)')).toBeInTheDocument();
    expect(screen.getByText('Population Impact')).toBeInTheDocument();
  });

  it('returns null when routeData is null', () => {
    const { container } = render(<RouteOverlay routeData={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG circles for each risk dial', () => {
    render(<RouteOverlay routeData={mockRouteData} />);
    
    // We should have 3 risk dials, each with 2 circles (background and progress)
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBe(6);
  });

  it('applies correct color gradients based on risk values', () => {
    render(<RouteOverlay routeData={mockRouteData} />);
    
    const progressCircles = Array.from(document.querySelectorAll('circle')).filter(
      circle => !circle.classList.contains('opacity-25')
    );

    // Check that each progress circle has a stroke color
    progressCircles.forEach(circle => {
      expect(circle.getAttribute('stroke')).toMatch(/rgb\(\d+,\s*\d+,\s*0\)/);
    });
  });

  it('renders N/A for undefined risk values', () => {
    const mockRouteDataWithUndefined = {
      ...mockRouteData,
      populationImpactScore: undefined,
      visibilityRisk: undefined,
      windRisk: undefined,
    };

    render(<RouteOverlay routeData={mockRouteDataWithUndefined} />);

    // Check if N/A is displayed for each undefined risk
    const naElements = screen.getAllByText('N/A');
    expect(naElements).toHaveLength(3);

    // Check if labels are still displayed
    expect(screen.getByText('Population Score')).toBeInTheDocument();
    expect(screen.getByText('Visibility Risk')).toBeInTheDocument();
    expect(screen.getByText('Wind Risk')).toBeInTheDocument();

    // Check if grey circles are rendered
    const greyCircles = Array.from(document.querySelectorAll('circle')).filter(
      circle => circle.getAttribute('stroke') === '#9CA3AF'
    );
    expect(greyCircles).toHaveLength(3);
  });
});