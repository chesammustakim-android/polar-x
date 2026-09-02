import React, { useEffect } from 'react';
import StatusBadge from '../common/StatusBadge';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


// Fix default Leaflet icon assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper for formatting coordinates to "70.7670° S, 11.7400° E"
export function formatPolarCoords(lat, lon) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return 'Coordinates Unavailable';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

// Custom Marker DivIcons
function createPersonIcon(status, isSelected) {
  const s = (status || '').toUpperCase();
  let cls = 'map-marker-pin map-marker-person';
  if (s === 'FIELD') cls += ' field';
  else if (s === 'IN_TRANSIT' || s === 'TRANSIT') cls += ' transit';
  else if (s === 'RESTING') cls += ' resting';
  else if (s === 'OFF_DUTY') cls += ' off-duty';
  else if (s === 'EMERGENCY' || s.includes('SOS')) cls += ' emergency';

  if (isSelected) cls += ' selected-marker';

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${cls}">${iconSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createStationIcon(type, isSelected) {
  let cls = 'map-marker-pin map-marker-station';
  const t = (type || '').toLowerCase();
  if (t.includes('research')) cls += ' research';
  else if (t.includes('depot') || t.includes('storage')) cls += ' depot';

  if (isSelected) cls += ' selected-marker';

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${cls}">${iconSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createCargoIcon(priority, isSelected) {
  let cls = 'map-marker-pin map-marker-cargo';
  const p = (priority || '').toLowerCase();
  if (p === 'critical' || p === 'high') cls += ' critical';

  if (isSelected) cls += ' selected-marker';

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${cls}">${iconSvg}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

// Controller component to smoothly fly map to selected coordinates
function MapController({ selectedEntity, resetTrigger, defaultCenter, defaultZoom }) {
  const map = useMap();

  useEffect(() => {
    if (selectedEntity && selectedEntity.latitude != null && selectedEntity.longitude != null) {
      map.flyTo([selectedEntity.latitude, selectedEntity.longitude], 7, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [selectedEntity, map]);

  useEffect(() => {
    if (resetTrigger > 0) {
      map.flyTo(defaultCenter, defaultZoom, {
        duration: 1.2
      });
    }
  }, [resetTrigger, defaultCenter, defaultZoom, map]);

  return null;
}

export default function PolarMap({
  personnel = [],
  stations = [],
  cargo = [],
  incidents = [],
  responseUnits = [],
  selectedEntity = null,
  movementHistory = [],
  onSelectEntity,
  showPersonnel = true,
  showStations = true,
  showCargo = true,
  emergencyOnly = false,
  resetTrigger = 0
}) {
  // Default centered on Indian Antarctic Research Stations (Maitri / Queen Maud Land)
  const defaultCenter = [-70.7670, 11.7400];
  const defaultZoom = 4;

  // Filter entities if emergency only
  const filteredPersonnel = emergencyOnly
    ? personnel.filter(p => (p.status || '').toUpperCase() === 'EMERGENCY')
    : personnel;

  // Filter incidents: optional emergencyOnly could also filter by severity if needed
  const filteredIncidents = emergencyOnly
    ? incidents.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL')
    : incidents;

  // Filter response units: show all, but could filter by status if needed in future
  const filteredResponseUnits = responseUnits;

  // Build movement polyline points if selected personnel has historical coordinates
  const polylineCoords = [];
  if (selectedEntity && selectedEntity.type === 'personnel' && movementHistory.length > 0) {
    // Reverse movement history so it goes chronologically (oldest -> newest)
    const sorted = [...movementHistory].reverse();
    sorted.forEach(m => {
      if (m.new_latitude != null && m.new_longitude != null && !isNaN(m.new_latitude) && !isNaN(m.new_longitude)) {
        polylineCoords.push([m.new_latitude, m.new_longitude]);
      }
    });
    // Append current position if available
    if (selectedEntity.latitude != null && selectedEntity.longitude != null) {
      const lastPoint = polylineCoords[polylineCoords.length - 1];
      if (!lastPoint || lastPoint[0] !== selectedEntity.latitude || lastPoint[1] !== selectedEntity.longitude) {
        polylineCoords.push([selectedEntity.latitude, selectedEntity.longitude]);
      }
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={2}
        maxZoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* OpenStreetMap Tiles with Custom Dark Command-Center Filter */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="polar-map-tiles"
          maxZoom={18}
        />

        {/* Dynamic Fly-To Controller */}
        <MapController
          selectedEntity={selectedEntity}
          resetTrigger={resetTrigger}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />

        {/* 1. Station Markers */}
        {showStations && stations.map((st) => {
          if (st.latitude == null || st.longitude == null || isNaN(st.latitude) || isNaN(st.longitude)) return null;
          const isSelected = selectedEntity && selectedEntity.id === st.id && selectedEntity.type === 'station';

          return (
            <Marker
              key={`st-${st.id}`}
              position={[st.latitude, st.longitude]}
              icon={createStationIcon(st.type, isSelected)}
              eventHandlers={{
                click: () => onSelectEntity && onSelectEntity({ ...st, type: 'station' })
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-header">
                    <span className="map-popup-badge">STATION</span>
                    <StatusBadge status={st.status} />
                  </div>
                  <div>
                    <div className="map-popup-name">{st.name}</div>
                    <div className="map-popup-role">{st.type} • {st.elevation || 'Elevation ASL'}</div>
                  </div>
                  <div className="map-popup-coords">
                    {formatPolarCoords(st.latitude, st.longitude)}
                  </div>
                  {st.description && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {st.description}
                    </div>
                  )}
                  <div className="map-popup-actions">
                    <button
                      className="map-popup-btn"
                      onClick={() => onSelectEntity && onSelectEntity({ ...st, type: 'station' })}
                    >
                      Focus Station Dossier
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 2. Incident Markers */}
        {filteredIncidents.map((inc) => {
          if (inc.latitude == null || inc.longitude == null || isNaN(inc.latitude) || isNaN(inc.longitude)) return null;
          const isSelected = selectedEntity && selectedEntity.id === inc.id && selectedEntity.type === 'incident';
          const severity = (inc.severity || '').toUpperCase();
          const status = (inc.status || '').toUpperCase();
          const iconCls = severity === 'CRITICAL' ? 'incident-critical' : 'incident-normal';
          const iconHtml = `<div class="${iconCls}">${severity}</div>`;
          const incidentIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="map-marker-pin map-marker-incident ${isSelected ? 'selected-marker' : ''}">${iconHtml}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
          });
          return (
            <Marker
              key={`inc-${inc.id}`}
              position={[inc.latitude, inc.longitude]}
              icon={incidentIcon}
              eventHandlers={{
                click: () => onSelectEntity && onSelectEntity({ ...inc, type: 'incident' })
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-header">
                    <span className="map-popup-badge">INCIDENT</span>
                    <StatusBadge status={status} />
                  </div>
                  <div className="map-popup-name">{inc.title}</div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Severity:</span>
                    <span className="map-popup-row-val">{severity}</span>
                  </div>
                  <div className="map-popup-coords">
                    {formatPolarCoords(inc.latitude, inc.longitude)}
                  </div>
                  <div className="map-popup-actions">
                    <button className="map-popup-btn" onClick={() => onSelectEntity && onSelectEntity({ ...inc, type: 'incident' })}>
                      Focus Incident
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 3. Response Unit Markers */}
        {filteredResponseUnits.map((unit) => {
          if (unit.latitude == null || unit.longitude == null || isNaN(unit.latitude) || isNaN(unit.longitude)) return null;
          const isSelected = selectedEntity && selectedEntity.id === unit.id && selectedEntity.type === 'response_unit';
          const status = (unit.status || '').toUpperCase();
          const unitIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="map-marker-pin map-marker-unit ${isSelected ? 'selected-marker' : ''}">${unit.unit_code}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16]
          });
          return (
            <Marker
              key={`unit-${unit.id}`}
              position={[unit.latitude, unit.longitude]}
              icon={unitIcon}
              eventHandlers={{
                click: () => onSelectEntity && onSelectEntity({ ...unit, type: 'response_unit' })
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-header">
                    <span className="map-popup-badge">UNIT</span>
                    <StatusBadge status={status} />
                  </div>
                  <div className="map-popup-name">{unit.unit_name || unit.unit_code}</div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Type:</span>
                    <span className="map-popup-row-val">{unit.unit_type}</span>
                  </div>
                  <div className="map-popup-coords">
                    {formatPolarCoords(unit.latitude, unit.longitude)}
                  </div>
                  <div className="map-popup-actions">
                    <button className="map-popup-btn" onClick={() => onSelectEntity && onSelectEntity({ ...unit, type: 'response_unit' })}>
                      Focus Unit
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 2. Cargo Markers */}
        {showCargo && !emergencyOnly && cargo.map((c) => {
          if (c.latitude == null || c.longitude == null || isNaN(c.latitude) || isNaN(c.longitude)) return null;
          const isSelected = selectedEntity && selectedEntity.id === c.id && selectedEntity.type === 'cargo';

          return (
            <Marker
              key={`cg-${c.id}`}
              position={[c.latitude, c.longitude]}
              icon={createCargoIcon(c.priority, isSelected)}
              eventHandlers={{
                click: () => onSelectEntity && onSelectEntity({ ...c, type: 'cargo' })
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-header">
                    <span className="map-popup-badge">{c.cargo_code}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div>
                    <div className="map-popup-name">{c.name}</div>
                    <div className="map-popup-role">{c.category} • {c.weight}</div>
                  </div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Location:</span>
                    <span className="map-popup-row-val">{c.current_location}</span>
                  </div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Route:</span>
                    <span className="map-popup-row-val" style={{ fontSize: '10.5px' }}>{c.origin} → {c.destination}</span>
                  </div>
                  <div className="map-popup-coords">
                    {formatPolarCoords(c.latitude, c.longitude)}
                  </div>
                  <div className="map-popup-actions">
                    <button
                      className="map-popup-btn"
                      onClick={() => onSelectEntity && onSelectEntity({ ...c, type: 'cargo' })}
                    >
                      Inspect Cargo Telemetry
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 3. Personnel Markers */}
        {showPersonnel && filteredPersonnel.map((p) => {
          if (p.latitude == null || p.longitude == null || isNaN(p.latitude) || isNaN(p.longitude)) return null;
          const isSelected = selectedEntity && selectedEntity.id === p.id && selectedEntity.type === 'personnel';
          const isEmerg = (p.status || '').toUpperCase() === 'EMERGENCY';

          return (
            <Marker
              key={`ps-${p.id}`}
              position={[p.latitude, p.longitude]}
              icon={createPersonIcon(p.status, isSelected)}
              eventHandlers={{
                click: () => onSelectEntity && onSelectEntity({ ...p, type: 'personnel' })
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-header">
                    <span className={`map-popup-badge ${isEmerg ? 'emergency' : ''}`}>
                      {p.personnel_code}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div>
                    <div className="map-popup-name">{p.name}</div>
                    <div className="map-popup-role">{p.role} • {p.department}</div>
                  </div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Reported Location:</span>
                    <span className="map-popup-row-val">{p.current_location}</span>
                  </div>
                  <div className="map-popup-row">
                    <span className="map-popup-row-label">Last Updated:</span>
                    <span className="map-popup-row-val" style={{ fontSize: '10.5px' }}>{p.last_updated || 'Recent'}</span>
                  </div>
                  <div className="map-popup-coords">
                    {formatPolarCoords(p.latitude, p.longitude)}
                  </div>
                  <div className="map-popup-actions">
                    <button
                      className="map-popup-btn"
                      onClick={() => onSelectEntity && onSelectEntity({ ...p, type: 'personnel' })}
                    >
                      View Personnel Dossier
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 4. Personnel Movement Path (Historical Polyline) */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: '#00d3f3',
              weight: 3.5,
              opacity: 0.85,
              dashArray: '6, 8',
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
