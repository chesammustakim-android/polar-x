import React, { useEffect, useState, useMemo } from 'react';
import StatusBadge from '../common/StatusBadge';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
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

function createIncidentIcon(severity, isSelected) {
  const sev = (severity || '').toUpperCase();
  const iconCls = sev === 'CRITICAL' ? 'incident-critical' : 'incident-normal';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="map-marker-pin map-marker-incident ${isSelected ? 'selected-marker' : ''}"><div class="${iconCls}">${sev}</div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createUnitIcon(unitCode, isSelected) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="map-marker-pin map-marker-unit ${isSelected ? 'selected-marker' : ''}">${unitCode || 'SAR'}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

function createClusterIcon(count, hasEmergency, titleText = '') {
  const emergCls = hasEmergency ? ' has-emergency' : '';
  const tooltip = titleText || `Cluster: ${count} assets. Click to spiderfy/expand.`;
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="map-marker-cluster${emergCls}" title="${tooltip.replace(/"/g, '&quot;')}"><span class="cluster-count">${count}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

// Map Controller for smooth fly-to and zoom event tracking
function MapController({ selectedEntity, resetTrigger, defaultCenter, defaultZoom, onZoomChange }) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      if (onZoomChange) onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    if (selectedEntity && selectedEntity.latitude != null && selectedEntity.longitude != null) {
      // _focus means an explicit "Focus Unit" action — zoom close enough to reveal from clusters
      // For response_unit type with _focus, go to zoom 10; otherwise stay at or above 7
      let targetZoom;
      if (selectedEntity._focus && selectedEntity.type === 'response_unit') {
        targetZoom = Math.max(map.getZoom(), 10);
      } else if (selectedEntity._focus) {
        targetZoom = Math.max(map.getZoom(), 9);
      } else {
        targetZoom = Math.max(map.getZoom(), 7);
      }
      map.flyTo([selectedEntity.latitude, selectedEntity.longitude], targetZoom, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [selectedEntity, selectedEntity?._focusKey, map]);

  useEffect(() => {
    if (resetTrigger > 0) {
      map.flyTo(defaultCenter, defaultZoom, {
        duration: 1.2
      });
    }
  }, [resetTrigger, defaultCenter, defaultZoom, map]);

  return null;
}

// Contextual cluster labeling using real Polar-X stations & asset data
function getClusterContext(cluster, stations = []) {
  let personnelCount = 0;
  let cargoCount = 0;
  let unitCount = 0;
  let stationCount = 0;
  let incidentCount = 0;
  let stationItem = null;
  const locationNames = new Set();

  cluster.items.forEach(it => {
    if (it.type === 'personnel') personnelCount++;
    else if (it.type === 'cargo') cargoCount++;
    else if (it.type === 'response_unit') unitCount++;
    else if (it.type === 'station') {
      stationCount++;
      stationItem = it;
    } else if (it.type === 'incident') incidentCount++;

    if (it.current_location) locationNames.add(it.current_location);
    if (it.location_name) locationNames.add(it.location_name);
    if (it.region) locationNames.add(it.region);
    if (it.station) locationNames.add(it.station);
  });

  // Determine best real location name from existing stations
  let bestLocationName = '';
  if (stationItem && stationItem.name) {
    bestLocationName = stationItem.name;
  } else if (stations && stations.length > 0) {
    let minDist = Infinity;
    let closestStation = null;
    stations.forEach(st => {
      if (st.latitude != null && st.longitude != null) {
        const dLat = st.latitude - cluster.latitude;
        const dLon = st.longitude - cluster.longitude;
        const dist = Math.hypot(dLat, dLon);
        if (dist < minDist) {
          minDist = dist;
          closestStation = st;
        }
      }
    });
    // Proximity threshold ~0.65 degrees (~70 km in polar regions)
    if (closestStation && minDist <= 0.65) {
      bestLocationName = closestStation.name;
    }
  }

  if (!bestLocationName) {
    const locArr = Array.from(locationNames).filter(Boolean);
    if (locArr.length > 0) {
      bestLocationName = locArr[0];
    } else {
      bestLocationName = 'Polar Operational Sector';
    }
  }

  // Construct readable entity counts breakdown
  const parts = [];
  if (personnelCount > 0) parts.push(`${personnelCount} crew`);
  if (cargoCount > 0) parts.push(`${cargoCount} cargo`);
  if (unitCount > 0) parts.push(`${unitCount} SAR unit${unitCount !== 1 ? 's' : ''}`);
  if (stationCount > 0) parts.push(`${stationCount} station`);
  if (incidentCount > 0) parts.push(`${incidentCount} incident${incidentCount !== 1 ? 's' : ''}`);

  const breakdownStr = parts.join(' · ') || `${cluster.items.length} assets`;
  const fullLabel = `${bestLocationName} — ${breakdownStr}`;

  return {
    locationName: bestLocationName,
    breakdownStr,
    fullLabel,
    counts: {
      personnel: personnelCount,
      cargo: cargoCount,
      units: unitCount,
      stations: stationCount,
      incidents: incidentCount,
      total: cluster.items.length
    }
  };
}

// Cluster grouping helper by geographic proximity
function groupMarkersIntoClusters(items, threshold = 0.05) {
  const clusters = [];
  items.forEach(item => {
    if (item.latitude == null || item.longitude == null || isNaN(item.latitude) || isNaN(item.longitude)) return;
    
    // Check if item belongs to an existing cluster
    const match = clusters.find(c => {
      const dLat = Math.abs(c.latitude - item.latitude);
      const dLon = Math.abs(c.longitude - item.longitude);
      return Math.hypot(dLat, dLon) < threshold;
    });

    if (match) {
      match.items.push(item);
    } else {
      clusters.push({
        id: `cluster-${item.type}-${item.id}-${clusters.length}`,
        latitude: item.latitude,
        longitude: item.longitude,
        items: [item]
      });
    }
  });
  return clusters;
}

// Spiderfy radial position calculator
function getSpiderPosition(centerLat, centerLon, index, total, zoom = 4) {
  if (total <= 1) return [centerLat, centerLon];
  const angle = (index * 2 * Math.PI) / total;
  // Scaled radius adapted to zoom level so spiderfied markers are distinctly separated
  const baseRadius = 0.45 / Math.pow(1.4, Math.max(1, zoom - 3));
  const latOffset = baseRadius * Math.sin(angle);
  const cosLat = Math.cos((centerLat * Math.PI) / 180) || 1;
  const lonOffset = (baseRadius / Math.max(0.2, Math.abs(cosLat))) * Math.cos(angle);
  return [centerLat + latOffset, centerLon + lonOffset];
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
  onOpenFullDossier,
  onOpenCargoManifest,
  onFocusEntity,
  showPersonnel = true,
  showStations = true,
  showCargo = true,
  showUnits = true,
  emergencyOnly = false,
  resetTrigger = 0
}) {
  const defaultCenter = [-70.7670, 11.7400];
  const defaultZoom = 4;
  const [currentZoom, setCurrentZoom] = useState(defaultZoom);
  const [expandedClusterIds, setExpandedClusterIds] = useState(new Set());

  // Filter entities based on layer toggles
  const filteredPersonnel = useMemo(() => {
    if (!showPersonnel) return [];
    return emergencyOnly
      ? personnel.filter(p => (p.status || '').toUpperCase() === 'EMERGENCY')
      : personnel;
  }, [personnel, showPersonnel, emergencyOnly]);

  const filteredCargo = useMemo(() => {
    if (!showCargo || emergencyOnly) return [];
    return cargo;
  }, [cargo, showCargo, emergencyOnly]);

  const filteredStations = useMemo(() => {
    if (!showStations || emergencyOnly) return [];
    return stations;
  }, [stations, showStations, emergencyOnly]);

  const filteredIncidents = useMemo(() => {
    return emergencyOnly
      ? incidents.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL')
      : incidents;
  }, [incidents, emergencyOnly]);

  const filteredResponseUnits = useMemo(() => {
    if (!showUnits) return [];
    return emergencyOnly
      ? responseUnits.filter(u => (u.status || '').toUpperCase() === 'ON_MISSION' || (u.status || '').toUpperCase() === 'DISPATCHED')
      : responseUnits;
  }, [responseUnits, showUnits, emergencyOnly]);

  // Aggregate all visible entity items with normalized type tags
  const allVisibleEntities = useMemo(() => {
    const list = [];
    filteredStations.forEach(st => list.push({ ...st, entityType: 'station', type: 'station' }));
    filteredPersonnel.forEach(p => list.push({ ...p, entityType: 'personnel', type: 'personnel' }));
    filteredCargo.forEach(c => list.push({ ...c, entityType: 'cargo', type: 'cargo' }));
    filteredIncidents.forEach(inc => list.push({ ...inc, entityType: 'incident', type: 'incident' }));
    filteredResponseUnits.forEach(u => list.push({ ...u, entityType: 'response_unit', type: 'response_unit' }));
    return list;
  }, [filteredStations, filteredPersonnel, filteredCargo, filteredIncidents, filteredResponseUnits]);

  // Group entities into proximity clusters (threshold shrinks as zoom increases)
  const clusters = useMemo(() => {
    // At high zoom levels, use tiny threshold so markers near each other are shown individually
    // At low zoom, use larger threshold to group distant markers into clusters
    let threshold;
    if (currentZoom >= 10) threshold = 0.003;
    else if (currentZoom >= 8) threshold = 0.01;
    else if (currentZoom >= 6) threshold = 0.03;
    else threshold = 0.05;
    return groupMarkersIntoClusters(allVisibleEntities, threshold);
  }, [allVisibleEntities, currentZoom]);

  // Auto-expand cluster if selectedEntity is inside it
  useEffect(() => {
    if (selectedEntity) {
      clusters.forEach(c => {
        if (c.items.some(it => it.id === selectedEntity.id && it.type === selectedEntity.type)) {
          setExpandedClusterIds(prev => new Set([...prev, c.id]));
        }
      });
    }
  }, [selectedEntity, clusters]);

  const toggleClusterExpansion = (clusterId) => {
    setExpandedClusterIds(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  // Build movement polyline points if selected personnel has historical coordinates
  const polylineCoords = useMemo(() => {
    const coords = [];
    if (selectedEntity && selectedEntity.type === 'personnel' && movementHistory.length > 0) {
      const sorted = [...movementHistory].reverse();
      sorted.forEach(m => {
        if (m.new_latitude != null && m.new_longitude != null && !isNaN(m.new_latitude) && !isNaN(m.new_longitude)) {
          coords.push([m.new_latitude, m.new_longitude]);
        }
      });
      if (selectedEntity.latitude != null && selectedEntity.longitude != null) {
        const lastPoint = coords[coords.length - 1];
        if (!lastPoint || lastPoint[0] !== selectedEntity.latitude || lastPoint[1] !== selectedEntity.longitude) {
          coords.push([selectedEntity.latitude, selectedEntity.longitude]);
        }
      }
    }
    return coords;
  }, [selectedEntity, movementHistory]);

  // Helper to render individual item marker
  const renderItemMarker = (item, position, isSpiderfied = false) => {
    const isSelected = selectedEntity && selectedEntity.id === item.id && selectedEntity.type === item.type;
    const pos = position || [item.latitude, item.longitude];

    switch (item.type) {
      case 'station':
        return (
          <Marker
            key={`st-${item.id}-${isSpiderfied ? 'spider' : 'solo'}`}
            position={pos}
            icon={createStationIcon(item.type, isSelected)}
            eventHandlers={{
              click: () => onSelectEntity && onSelectEntity({ ...item, type: 'station' })
            }}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">
                  <span className="map-popup-badge">STATION</span>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <div className="map-popup-name">{item.name}</div>
                  <div className="map-popup-role">{item.station_type || item.type} • {item.elevation || 'Elevation ASL'}</div>
                </div>
                <div className="map-popup-coords">
                  {formatPolarCoords(item.latitude, item.longitude)}
                </div>
                {item.description && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {item.description}
                  </div>
                )}
                <div className="map-popup-actions">
                  <button
                    className="map-popup-btn"
                    onClick={() => onSelectEntity && onSelectEntity({ ...item, type: 'station' })}
                  >
                    Focus Station Dossier
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );

      case 'personnel':
        return (
          <Marker
            key={`ps-${item.id}-${isSpiderfied ? 'spider' : 'solo'}`}
            position={pos}
            icon={createPersonIcon(item.status, isSelected)}
            eventHandlers={{
              click: () => onSelectEntity && onSelectEntity({ ...item, type: 'personnel' })
            }}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">
                  <span className={`map-popup-badge ${(item.status || '').toUpperCase() === 'EMERGENCY' ? 'emergency' : ''}`}>
                    {item.personnel_code}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <div className="map-popup-name">{item.name}</div>
                  <div className="map-popup-role">{item.role} • {item.department}</div>
                </div>
                <div className="map-popup-row">
                  <span className="map-popup-row-label">Location:</span>
                  <span className="map-popup-row-val">{item.current_location}</span>
                </div>
                <div className="map-popup-coords">
                  {formatPolarCoords(item.latitude, item.longitude)}
                </div>
                <div className="map-popup-actions">
                  <button
                    className="map-popup-btn"
                    onClick={() => {
                      if (onOpenFullDossier) {
                        onOpenFullDossier(item.id);
                      }
                      if (onSelectEntity) {
                        onSelectEntity({ ...item, type: 'personnel' });
                      }
                    }}
                  >
                    Open Full Dossier
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );

      case 'cargo':
        return (
          <Marker
            key={`cg-${item.id}-${isSpiderfied ? 'spider' : 'solo'}`}
            position={pos}
            icon={createCargoIcon(item.priority, isSelected)}
            eventHandlers={{
              click: () => onSelectEntity && onSelectEntity({ ...item, type: 'cargo' })
            }}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">
                  <span className="map-popup-badge">{item.cargo_code}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div>
                  <div className="map-popup-name">{item.name}</div>
                  <div className="map-popup-role">{item.category} • {item.weight}</div>
                </div>
                <div className="map-popup-row">
                  <span className="map-popup-row-label">Location:</span>
                  <span className="map-popup-row-val">{item.current_location}</span>
                </div>
                <div className="map-popup-coords">
                  {formatPolarCoords(item.latitude, item.longitude)}
                </div>
                <div className="map-popup-actions">
                  <button
                    className="map-popup-btn"
                    onClick={() => {
                      if (onOpenCargoManifest) {
                        onOpenCargoManifest(item.id);
                      }
                      if (onSelectEntity) {
                        onSelectEntity({ ...item, type: 'cargo' });
                      }
                    }}
                  >
                    View Cargo Manifest
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );

      case 'incident':
        return (
          <Marker
            key={`inc-${item.id}-${isSpiderfied ? 'spider' : 'solo'}`}
            position={pos}
            icon={createIncidentIcon(item.severity, isSelected)}
            eventHandlers={{
              click: () => onSelectEntity && onSelectEntity({ ...item, type: 'incident' })
            }}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">
                  <span className="map-popup-badge">INCIDENT</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="map-popup-name">{item.title}</div>
                <div className="map-popup-row">
                  <span className="map-popup-row-label">Severity:</span>
                  <span className="map-popup-row-val">{(item.severity || '').toUpperCase()}</span>
                </div>
                <div className="map-popup-coords">
                  {formatPolarCoords(item.latitude, item.longitude)}
                </div>
                <div className="map-popup-actions">
                  <button className="map-popup-btn" onClick={() => onSelectEntity && onSelectEntity({ ...item, type: 'incident' })}>
                    Focus Incident
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );

      case 'response_unit':
        return (
          <Marker
            key={`unit-${item.id}-${isSpiderfied ? 'spider' : 'solo'}`}
            position={pos}
            icon={createUnitIcon(item.unit_code, isSelected)}
            eventHandlers={{
              click: () => onSelectEntity && onSelectEntity({ ...item, type: 'response_unit' })
            }}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">
                  <span className="map-popup-badge">UNIT</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="map-popup-name">{item.unit_name || item.name || item.unit_code}</div>
                <div className="map-popup-row">
                  <span className="map-popup-row-label">Type:</span>
                  <span className="map-popup-row-val">{item.unit_type}</span>
                </div>
                <div className="map-popup-coords">
                  {formatPolarCoords(item.latitude, item.longitude)}
                </div>
                <div className="map-popup-actions">
                  <button
                    className="map-popup-btn"
                    onClick={() => {
                      if (onFocusEntity) {
                        onFocusEntity({ ...item, type: 'response_unit', _focus: true, _focusKey: Date.now() });
                      } else if (onSelectEntity) {
                        onSelectEntity({ ...item, type: 'response_unit', _focus: true, _focusKey: Date.now() });
                      }
                    }}
                  >
                    Focus Unit
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );

      default:
        return null;
    }
  };

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
        {/* Dark Command-Center Styled Map Tiles */}
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
          onZoomChange={(z) => setCurrentZoom(z)}
        />

        {/* Hierarchical Geographic Labels — zoom-dependent, one level shown at a time */}
        {showStations && (() => {
          const stationsWithCoords = filteredStations.filter(
            st => st.latitude != null && st.longitude != null &&
                  !isNaN(st.latitude) && !isNaN(st.longitude)
          );
          if (stationsWithCoords.length === 0) return null;

          // Parse existing DB region strings like "Antarctica - Queen Maud Land" → {continent, subregion}
          const parseParts = (regionStr) => {
            if (!regionStr) return { continent: 'Polar Operations', subregion: null };
            const sep = regionStr.indexOf(' - ');
            if (sep >= 0) return { continent: regionStr.slice(0, sep).trim(), subregion: regionStr.slice(sep + 3).trim() };
            return { continent: regionStr.trim(), subregion: null };
          };

          // Average lat/lng of a list of stations
          const groupCenter = (sts) => [
            sts.reduce((s, st) => s + st.latitude, 0) / sts.length,
            sts.reduce((s, st) => s + st.longitude, 0) / sts.length
          ];

          // ZOOM < 3 → broad continent / country labels only
          if (currentZoom < 3) {
            const groups = {};
            stationsWithCoords.forEach(st => {
              const { continent } = parseParts(st.region);
              if (!groups[continent]) groups[continent] = [];
              groups[continent].push(st);
            });
            return Object.entries(groups).map(([name, sts]) => {
              const [lat, lng] = groupCenter(sts);
              return (
                <Marker
                  key={`geo-cont-${name}`}
                  position={[lat, lng]}
                  icon={L.divIcon({
                    className: 'station-label-div-icon',
                    html: `<div class="geo-label geo-label-continent">${name}</div>`,
                    iconSize: [180, 28],
                    iconAnchor: [90, 14]
                  })}
                  interactive={false}
                />
              );
            });
          }

          // ZOOM 3–5 → sub-region / territory labels
          if (currentZoom < 5) {
            const groups = {};
            stationsWithCoords.forEach(st => {
              const { continent, subregion } = parseParts(st.region);
              const key = subregion || continent;
              if (!groups[key]) groups[key] = [];
              groups[key].push(st);
            });
            return Object.entries(groups).map(([name, sts]) => {
              const [lat, lng] = groupCenter(sts);
              return (
                <Marker
                  key={`geo-reg-${name}`}
                  position={[lat, lng]}
                  icon={L.divIcon({
                    className: 'station-label-div-icon',
                    html: `<div class="geo-label geo-label-region">${name}</div>`,
                    iconSize: [170, 24],
                    iconAnchor: [85, 12]
                  })}
                  interactive={false}
                />
              );
            });
          }

          // ZOOM 5–7 → compact individual station names
          // ZOOM ≥ 7  → full station names + sub-region tag
          return stationsWithCoords.map(st => {
            const full = currentZoom >= 7;
            const { subregion } = parseParts(st.region);
            return (
              <Marker
                key={`st-lbl-${st.id}`}
                position={[st.latitude, st.longitude]}
                icon={L.divIcon({
                  className: 'station-label-div-icon',
                  html: `<div class="station-map-label ${full ? 'visible' : 'compact'}">
                    <span class="station-label-name">${st.name}</span>
                    ${full && subregion ? `<span class="station-label-region">${subregion}</span>` : ''}
                  </div>`,
                  iconSize: [160, full ? 40 : 24],
                  iconAnchor: [80, full ? 20 : 12]
                })}
                interactive={false}
              />
            );
          });
        })()}

        {/* Render Clusters & Spiderfied Markers */}
        {clusters.map((cluster) => {
          // Solo item in cluster: render directly at true coordinate
          if (cluster.items.length === 1) {
            return renderItemMarker(cluster.items[0], null, false);
          }

          const isExpanded = expandedClusterIds.has(cluster.id);
          const hasEmergency = cluster.items.some(it => 
            (it.status || '').toUpperCase() === 'EMERGENCY' || 
            (it.severity || '').toUpperCase() === 'CRITICAL'
          );
          const ctx = getClusterContext(cluster, stations);

          if (!isExpanded) {
            // Render Compact Proximity Cluster Marker with Contextual Breakdown
            return (
              <Marker
                key={cluster.id}
                position={[cluster.latitude, cluster.longitude]}
                icon={createClusterIcon(cluster.items.length, hasEmergency, `${ctx.fullLabel}. Click to spiderfy/expand.`)}
                eventHandlers={{
                  click: () => toggleClusterExpansion(cluster.id)
                }}
              >
                <Popup>
                  <div className="map-popup-card">
                    <div className="map-popup-header">
                      <span className="map-popup-badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: 'var(--cyan-300)' }}>
                        {ctx.locationName.toUpperCase()} ({cluster.items.length})
                      </span>
                      {hasEmergency && <StatusBadge status="EMERGENCY" />}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--cyan-300)', fontWeight: '600', marginBottom: '2px' }}>
                      {ctx.breakdownStr}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Position: {formatPolarCoords(cluster.latitude, cluster.longitude)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                      {cluster.items.map(it => (
                        <div
                          key={`c-item-${it.type}-${it.id}`}
                          onClick={() => {
                            toggleClusterExpansion(cluster.id);
                            if (onSelectEntity) onSelectEntity({ ...it, _focus: true, _focusKey: Date.now() });
                          }}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(8, 13, 26, 0.6)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#fff' }}>
                            {it.name || it.unit_name || it.title || it.cargo_code || it.personnel_code}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--cyan-300)', textTransform: 'uppercase' }}>
                            {it.type}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="map-popup-actions">
                      <button
                        className="map-popup-btn"
                        onClick={() => toggleClusterExpansion(cluster.id)}
                      >
                        Fan-Out / Spiderfy Markers
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          }

          // Render Spiderfied / Fanned Out Radial Markers with Connecting Lines
          return (
            <React.Fragment key={`spider-${cluster.id}`}>
              {/* Spider Center Collapse Trigger */}
              <Marker
                position={[cluster.latitude, cluster.longitude]}
                icon={createClusterIcon('✕', hasEmergency)}
                eventHandlers={{
                  click: () => toggleClusterExpansion(cluster.id)
                }}
              />

              {cluster.items.map((item, idx) => {
                const spiderPos = getSpiderPosition(
                  cluster.latitude,
                  cluster.longitude,
                  idx,
                  cluster.items.length,
                  currentZoom
                );

                return (
                  <React.Fragment key={`spider-frag-${item.type}-${item.id}`}>
                    {/* Visual Connector Line from Cluster Origin to Fanned Marker */}
                    <Polyline
                      positions={[[cluster.latitude, cluster.longitude], spiderPos]}
                      pathOptions={{
                        color: hasEmergency ? '#ef4444' : '#00d3f3',
                        weight: 1.8,
                        opacity: 0.7,
                        dashArray: '3, 4'
                      }}
                    />
                    {/* Individual Spiderfied Marker */}
                    {renderItemMarker(item, spiderPos, true)}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Historical Polyline Trail for Selected Entity */}
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
