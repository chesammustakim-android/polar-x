import React, { useState } from 'react';
import { Layers, Compass, Crosshair, Radio, Wind, AlertCircle, Eye } from 'lucide-react';
import { MAP_MARKERS, POLAR_STATIONS } from '../../data/mockData';

export default function PolarMapPanel({ onSelectMarker, selectedMarkerId }) {
  const [activeLayer, setActiveLayer] = useState('all'); // all, stations, vessels, alerts
  const [hoveredMarker, setHoveredMarker] = useState(null);

  const filteredMarkers = MAP_MARKERS.filter(marker => {
    if (activeLayer === 'stations') return marker.type === 'station' || marker.type === 'depot';
    if (activeLayer === 'vessels') return marker.type === 'vessel' || marker.type === 'convoy';
    if (activeLayer === 'alerts') return marker.isAlert;
    return true;
  });

  return (
    <div className="polar-map-container">
      {/* Top Map Controls */}
      <div className="map-overlay-controls">
        <div className="map-control-group">
          <div className="map-chip">
            <Compass size={13} className="radar-sweep-icon" />
            <span>ANTARCTICA POLAR STEREOGRAPHIC (WGS 84)</span>
          </div>
        </div>

        <div className="map-control-group">
          <button 
            className={`map-chip ${activeLayer === 'all' ? 'active' : ''}`}
            onClick={() => setActiveLayer('all')}
            style={{ cursor: 'pointer', background: activeLayer === 'all' ? 'rgba(56, 189, 248, 0.25)' : undefined }}
          >
            All Tracks
          </button>
          <button 
            className={`map-chip ${activeLayer === 'stations' ? 'active' : ''}`}
            onClick={() => setActiveLayer('stations')}
            style={{ cursor: 'pointer', background: activeLayer === 'stations' ? 'rgba(56, 189, 248, 0.25)' : undefined }}
          >
            Stations (2)
          </button>
          <button 
            className={`map-chip ${activeLayer === 'vessels' ? 'active' : ''}`}
            onClick={() => setActiveLayer('vessels')}
            style={{ cursor: 'pointer', background: activeLayer === 'vessels' ? 'rgba(56, 189, 248, 0.25)' : undefined }}
          >
            Convoys / Vessels
          </button>
          <button 
            className={`map-chip ${activeLayer === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveLayer('alerts')}
            style={{ cursor: 'pointer', background: activeLayer === 'alerts' ? 'rgba(239, 68, 68, 0.25)' : undefined, color: 'var(--hazard-red)' }}
          >
            <AlertCircle size={12} />
            SOS Beacon (1)
          </button>
        </div>
      </div>

      {/* SVG Tactical Polar Coordinate Grid Background */}
      <svg className="polar-grid-canvas" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="polarGridGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.08)" />
            <stop offset="60%" stopColor="rgba(14, 165, 233, 0.03)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          
          <linearGradient id="routeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.2)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 0.8)" />
            <stop offset="100%" stopColor="rgba(14, 165, 233, 0.2)" />
          </linearGradient>
        </defs>

        {/* Outer Polar Rings */}
        <circle cx="400" cy="250" r="230" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="400" cy="250" r="160" fill="none" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" />
        <circle cx="400" cy="250" r="90" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" strokeDasharray="6 4" />
        <circle cx="400" cy="250" r="20" fill="url(#polarGridGlow)" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" />

        {/* Polar Radial Axis Lines */}
        <line x1="400" y1="20" x2="400" y2="480" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="170" y1="250" x2="630" y2="250" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="238" y1="88" x2="562" y2="412" stroke="rgba(56, 189, 248, 0.07)" strokeWidth="1" />
        <line x1="238" y1="412" x2="562" y2="88" stroke="rgba(56, 189, 248, 0.07)" strokeWidth="1" />

        {/* Simplified Antarctic Landmass Silhouette */}
        <path 
          d="M 320,130 Q 380,90 460,110 T 560,160 Q 610,210 590,280 T 530,370 Q 430,410 350,380 T 260,290 Q 240,200 320,130 Z" 
          fill="rgba(56, 189, 248, 0.04)" 
          stroke="rgba(56, 189, 248, 0.25)" 
          strokeWidth="1.5" 
          strokeDasharray="2 1"
        />

        {/* Queen Maud Land Sector Highlight */}
        <path 
          d="M 350,140 Q 410,120 440,150 T 420,220 Q 370,210 350,140 Z"
          fill="rgba(56, 189, 248, 0.06)"
          stroke="rgba(56, 189, 248, 0.35)"
          strokeWidth="1"
        />

        {/* Convoy Route line between Dakshin Gangotri, Maitri and SAR Zone */}
        <path 
          d="M 368,220 L 384,260 L 400,270" 
          fill="none" 
          stroke="url(#routeGradient1)" 
          strokeWidth="2" 
          strokeDasharray="5 3"
        />

        {/* Vessel Route Line to Bharati */}
        <path 
          d="M 560,290 Q 580,320 592,340" 
          fill="none" 
          stroke="rgba(56, 189, 248, 0.4)" 
          strokeWidth="1.5" 
          strokeDasharray="4 4"
        />

        {/* Coordinate Labels */}
        <text x="405" y="100" fill="rgba(56, 189, 248, 0.4)" fontSize="10" fontFamily="JetBrains Mono">70°S</text>
        <text x="405" y="170" fill="rgba(56, 189, 248, 0.4)" fontSize="10" fontFamily="JetBrains Mono">80°S</text>
        <text x="405" y="245" fill="rgba(56, 189, 248, 0.7)" fontSize="10" fontFamily="JetBrains Mono">SOUTH POLE 90°S</text>
        <text x="635" y="254" fill="rgba(56, 189, 248, 0.4)" fontSize="9" fontFamily="JetBrains Mono">90°E</text>
        <text x="140" y="254" fill="rgba(56, 189, 248, 0.4)" fontSize="9" fontFamily="JetBrains Mono">90°W</text>
      </svg>

      {/* Interactive Map Pins */}
      {filteredMarkers.map((marker) => {
        const isHovered = hoveredMarker?.id === marker.id;
        const isSelected = selectedMarkerId === marker.id;

        return (
          <div
            key={marker.id}
            className="map-pin-marker"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onMouseEnter={() => setHoveredMarker(marker)}
            onMouseLeave={() => setHoveredMarker(null)}
            onClick={() => onSelectMarker && onSelectMarker(marker)}
          >
            {/* Pulsing ring for alerts / convoys */}
            {(marker.isAlert || marker.type === 'convoy') && (
              <div className={`pin-pulse-ring ${marker.isAlert ? 'danger' : ''}`}></div>
            )}

            {/* Pin Core */}
            <div className={`pin-core ${marker.isAlert ? 'danger' : ''}`}></div>

            {/* Tooltip on Hover or Selection */}
            {(isHovered || isSelected) && (
              <div className="pin-tooltip">
                <div style={{ fontWeight: '700', color: marker.isAlert ? 'var(--hazard-red)' : 'var(--cyan-300)' }}>
                  {marker.name} {marker.label ? `(${marker.label})` : ''}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Coords: {marker.lat}°, {marker.lng}° • {marker.weather}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Map Telemetry Footer */}
      <div className="map-footer-telemetry">
        <span>RADAR: 2.4 GHz DOPPLER POLAR SWEEP ACTIVE</span>
        <span>LAT: 70°45'S | LON: 11°44'E (MAITRI SECTOR)</span>
        <span style={{ color: 'var(--hazard-amber)' }}>KATABATIC WIND ADVISORY ACTIVE</span>
      </div>
    </div>
  );
}
