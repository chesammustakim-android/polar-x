import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Compass, Layers, Users, Truck, ShieldAlert,
  Search, RefreshCw, AlertTriangle, Radio, Navigation,
  Clock, Eye, X, Check, Activity, Building2, Box
} from 'lucide-react';
import PolarMap, { formatPolarCoords } from '../components/map/PolarMap';
import StatusBadge from '../components/common/StatusBadge';
import { api } from '../services/api';

// Helper for location freshness
function getLocationFreshness(lastUpdatedStr) {
  if (!lastUpdatedStr) return { label: 'UNKNOWN', cls: 'unknown' };
  const s = lastUpdatedStr.toLowerCase();
  if (s.includes('just now') || s.includes('min') || s.includes('recent') || s.includes('2026-09') || s.includes('today')) {
    return { label: 'RECENT', cls: 'recent' };
  }
  return { label: 'STALE', cls: 'stale' };
}

export default function MapTrackingPage({ onSelectPersonnel, onSelectCargo, initialSelectedEntity }) {
  // Data states from API
  const [personnel, setPersonnel] = useState([]);
  const [stations, setStations] = useState([]);
  const [cargo, setCargo] = useState([]);
  const [expeditions, setExpeditions] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [responseUnits, setResponseUnits] = useState([]);
  const [personnelSummary, setPersonnelSummary] = useState(null);
  const [cargoSummary, setCargoSummary] = useState(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Layer toggles
  const [showPersonnel, setShowPersonnel] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showCargo, setShowCargo] = useState(true);
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('personnel'); // 'personnel' | 'cargo' | 'stations'
  const [personnelStatusFilter, setPersonnelStatusFilter] = useState('ALL');
  const [cargoStatusFilter, setCargoStatusFilter] = useState('ALL');
  const [expeditionFilter, setExpeditionFilter] = useState('ALL');

  // Selected Entity & Movement Trail
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Map view reset trigger
  const [resetTrigger, setResetTrigger] = useState(0);

  // Load all live geospatial and telemetry datasets
  const loadMapData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
        const [pLocations, pSummary, stData, cgLocations, cgSummary, expData, incData, ruData] = await Promise.all([
          api.getPersonnelLocations(),
          api.getPersonnelSummary(),
          api.getStations(),
          api.getCargoLocations(),
          api.getCargoStats ? api.getCargoStats() : Promise.resolve(null),
          api.getExpeditions ? api.getExpeditions() : Promise.resolve([]),
          api.getActiveIncidents ? api.getActiveIncidents() : Promise.resolve([]),
          api.getResponseUnits ? api.getResponseUnits() : Promise.resolve([])
        ]);

        setPersonnel(Array.isArray(pLocations) ? pLocations : []);
        setPersonnelSummary(pSummary);
        setStations(Array.isArray(stData) ? stData : []);
        setCargo(Array.isArray(cgLocations) ? cgLocations : []);
        setCargoSummary(cgSummary);
        setExpeditions(Array.isArray(expData) ? expData : []);
        setIncidents(Array.isArray(incData) ? incData : []);
        setResponseUnits(Array.isArray(ruData) ? ruData : []);
    } catch (err) {
      console.error('[POLAR-X Map] Failed to load telemetry:', err);
      setApiError('Unable to connect to telemetry API service. Please verify backend connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Handle initial selected entity from Dashboard radar actions
  useEffect(() => {
    if (initialSelectedEntity) {
      const lat = initialSelectedEntity.lat ?? initialSelectedEntity.latitude;
      const lng = initialSelectedEntity.lng ?? initialSelectedEntity.longitude;
      const name = initialSelectedEntity.name || '';

      if (lat != null && lng != null) {
        const matchingStation = stations.find(s => 
          (s.name && name && s.name.toLowerCase().includes(name.toLowerCase().replace(' station', '').replace(' depot', ''))) ||
          (Math.abs((s.latitude || 0) - lat) < 0.1 && Math.abs((s.longitude || 0) - lng) < 0.1)
        );

        if (matchingStation) {
          setSelectedEntity({ ...matchingStation, type: 'station' });
        } else {
          setSelectedEntity({
            id: initialSelectedEntity.id || 'radar-pin',
            name: name || 'Polar Radar Track',
            latitude: lat,
            longitude: lng,
            type: initialSelectedEntity.type || 'station',
            status: (initialSelectedEntity.status || 'OPERATIONAL').toUpperCase(),
            location_name: name
          });
        }
      }
    }
  }, [initialSelectedEntity, stations]);

  // Handle entity selection and load historical movement trail
  const handleSelectEntity = async (entity) => {
    setSelectedEntity(entity);
    setMovementHistory([]);

    if (entity && entity.type === 'personnel') {
      setIsLoadingHistory(true);
      try {
        const hist = await api.getPersonnelHistory(entity.id);
        setMovementHistory(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.warn(`[POLAR-X Map] Failed to load history for personnel #${entity.id}:`, err);
      } finally {
        setIsLoadingHistory(false);
      }
    } else if (entity && entity.type === 'cargo') {
      setIsLoadingHistory(true);
      try {
        const hist = await api.getCargoHistory(entity.id);
        setMovementHistory(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.warn(`[POLAR-X Map] Failed to load history for cargo #${entity.id}:`, err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  // Filtered lists for the Explorer panel
  const filteredPersonnel = personnel.filter(p => {
    if (emergencyOnly && (p.status || '').toUpperCase() !== 'EMERGENCY') return false;
    if (personnelStatusFilter !== 'ALL' && (p.status || '').toUpperCase() !== personnelStatusFilter) return false;
    if (expeditionFilter !== 'ALL' && p.expedition_id !== parseInt(expeditionFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchCode = (p.personnel_code || '').toLowerCase().includes(q);
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchRole = (p.role || '').toLowerCase().includes(q);
      const matchLoc = (p.current_location || '').toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchRole && !matchLoc) return false;
    }
    return true;
  });

  const filteredCargo = cargo.filter(c => {
    if (cargoStatusFilter !== 'ALL' && (c.status || '').toLowerCase() !== cargoStatusFilter.toLowerCase()) return false;
    if (expeditionFilter !== 'ALL' && c.expedition_id !== parseInt(expeditionFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchCode = (c.cargo_code || '').toLowerCase().includes(q);
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchLoc = (c.current_location || '').toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchLoc) return false;
    }
    return true;
  });

  const filteredStations = stations.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = (s.name || '').toLowerCase().includes(q);
      const matchType = (s.type || '').toLowerCase().includes(q);
      const matchRegion = (s.region || '').toLowerCase().includes(q);
      if (!matchName && !matchType && !matchRegion) return false;
    }
    return true;
  });

  // Calculate live stats
  const totalPersonnelCount = personnelSummary?.total_personnel ?? personnel.length;
  const fieldPersonnelCount = personnelSummary?.field ?? personnel.filter(p => (p.status || '').toUpperCase() === 'FIELD').length;
  const transitPersonnelCount = personnelSummary?.in_transit ?? personnel.filter(p => (p.status || '').toUpperCase() === 'IN_TRANSIT').length;
  const emergencyPersonnelCount = personnelSummary?.emergency ?? personnel.filter(p => (p.status || '').toUpperCase() === 'EMERGENCY').length;
  const totalCargoCount = cargoSummary?.total_cargo ?? cargo.length;
  const activeCargoCount = (cargoSummary?.in_transit ?? 0) + (cargoSummary?.loaded ?? 0) + (cargoSummary?.at_port ?? 0);
  const stationsCount = stations.length;

  return (
    <div className="placeholder-page" style={{ paddingBottom: '32px' }}>
      {/* Page Header */}
      <div className="placeholder-hero">
        <div className="placeholder-info">
          <div className="module-meta-badge">
            <Compass size={14} />
            <span>GEOSPATIAL COMMAND & TELEMETRY MAPPING</span>
          </div>
          <h2>Polar Geospatial Tracking & Telemetry Map</h2>
          <p>
            API-driven coordinate monitoring and spatial tracking across Antarctic stations,
            deep traverse convoys, field camps, and cold-chain cargo routes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => setResetTrigger(t => t + 1)}>
            <Compass size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Center Antarctica
          </button>
          <button className="btn-secondary" onClick={loadMapData} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'radar-sweep-icon' : ''} style={{ display: 'inline', marginRight: '4px' }} />
            Sync Telemetry
          </button>
        </div>
      </div>

      {/* API Error Alert Banner if any */}
      {apiError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--hazard-red)',
          fontSize: '13px'
        }}>
          <AlertTriangle size={18} />
          <span>{apiError}</span>
        </div>
      )}

      {/* Real API Summary Stats Row */}
      <div className="map-stats-grid">
        <div className="map-stat-card">
          <div className="map-stat-icon"><Users size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{totalPersonnelCount}</div>
            <div className="map-stat-label">Total Crew</div>
          </div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-icon field"><Navigation size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{fieldPersonnelCount}</div>
            <div className="map-stat-label">In Field</div>
          </div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-icon transit"><Truck size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{transitPersonnelCount}</div>
            <div className="map-stat-label">In Transit</div>
          </div>
        </div>
        <div className={`map-stat-card ${emergencyPersonnelCount > 0 ? 'emergency' : ''}`}>
          <div className="map-stat-icon emergency"><AlertTriangle size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{emergencyPersonnelCount}</div>
            <div className="map-stat-label">Emergency</div>
          </div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-icon cargo"><Box size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{totalCargoCount}</div>
            <div className="map-stat-label">Cargo Assets</div>
          </div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-icon transit"><Activity size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{activeCargoCount}</div>
            <div className="map-stat-label">Active Cargo</div>
          </div>
        </div>
        <div className="map-stat-card">
          <div className="map-stat-icon station"><Building2 size={18} /></div>
          <div className="map-stat-body">
            <div className="map-stat-value">{stationsCount}</div>
            <div className="map-stat-label">Stations & Hubs</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout (Left Explorer + Center Map + Right Dossier) */}
      <div className="map-workspace-layout">
        {/* Left Explorer Sidebar */}
        <div className="map-explorer-panel">
          {/* Tabs */}
          <div className="map-explorer-tabs">
            <div
              className={`map-explorer-tab ${activeTab === 'personnel' ? 'active' : ''}`}
              onClick={() => setActiveTab('personnel')}
            >
              <Users size={14} />
              <span>Personnel ({filteredPersonnel.length})</span>
            </div>
            <div
              className={`map-explorer-tab ${activeTab === 'cargo' ? 'active' : ''}`}
              onClick={() => setActiveTab('cargo')}
            >
              <Box size={14} />
              <span>Cargo ({filteredCargo.length})</span>
            </div>
            <div
              className={`map-explorer-tab ${activeTab === 'stations' ? 'active' : ''}`}
              onClick={() => setActiveTab('stations')}
            >
              <Building2 size={14} />
              <span>Stations ({filteredStations.length})</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="map-explorer-filter-bar">
            <div className="map-explorer-search">
              <Search size={14} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {activeTab === 'personnel' && (
              <div className="map-explorer-select-row">
                <select
                  className="map-explorer-select"
                  value={personnelStatusFilter}
                  onChange={(e) => setPersonnelStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AT_STATION">At Station</option>
                  <option value="FIELD">In Field</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="RESTING">Resting</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="OFF_DUTY">Off Duty</option>
                </select>

                <select
                  className="map-explorer-select"
                  value={expeditionFilter}
                  onChange={(e) => setExpeditionFilter(e.target.value)}
                >
                  <option value="ALL">All Expeditions</option>
                  {expeditions.map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'cargo' && (
              <div className="map-explorer-select-row">
                <select
                  className="map-explorer-select"
                  value={cargoStatusFilter}
                  onChange={(e) => setCargoStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="At Port">At Port</option>
                  <option value="Loaded">Loaded</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Delayed">Delayed</option>
                </select>

                <select
                  className="map-explorer-select"
                  value={expeditionFilter}
                  onChange={(e) => setExpeditionFilter(e.target.value)}
                >
                  <option value="ALL">All Expeditions</option>
                  {expeditions.map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Explorer List */}
          <div className="map-explorer-list">
            {isLoading && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="radar-sweep-icon" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '12px' }}>Loading telemetry coordinates...</div>
              </div>
            )}

            {/* Personnel List Items */}
            {!isLoading && activeTab === 'personnel' && (
              filteredPersonnel.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No personnel match the selected filters.
                </div>
              ) : (
                filteredPersonnel.map((p) => {
                  const isEmerg = (p.status || '').toUpperCase() === 'EMERGENCY';
                  const isSelected = selectedEntity && selectedEntity.id === p.id && selectedEntity.type === 'personnel';

                  return (
                    <div
                      key={p.id}
                      className={`map-explorer-item ${isEmerg ? 'emergency' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectEntity({ ...p, type: 'personnel' })}
                    >
                      <div className="map-explorer-item-header">
                        <span className={`prs-code-badge ${isEmerg ? 'emergency' : ''}`}>
                          {p.personnel_code}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="map-explorer-item-title">{p.name}</div>
                      <div className="map-explorer-item-sub">{p.role} • {p.department}</div>
                      <div className="map-explorer-item-loc">
                        <MapPin size={11} />
                        <span>{p.current_location}</span>
                      </div>
                      <div className="map-explorer-item-coords">
                        {formatPolarCoords(p.latitude, p.longitude)}
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* Cargo List Items */}
            {!isLoading && activeTab === 'cargo' && (
              filteredCargo.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No cargo assets match the selected filters.
                </div>
              ) : (
                filteredCargo.map((c) => {
                  const isSelected = selectedEntity && selectedEntity.id === c.id && selectedEntity.type === 'cargo';

                  return (
                    <div
                      key={c.id}
                      className={`map-explorer-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectEntity({ ...c, type: 'cargo' })}
                    >
                      <div className="map-explorer-item-header">
                        <span className="cargo-code">{c.cargo_code}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="map-explorer-item-title">{c.name}</div>
                      <div className="map-explorer-item-sub">{c.category} • {c.weight}</div>
                      <div className="map-explorer-item-loc">
                        <MapPin size={11} />
                        <span>{c.current_location}</span>
                      </div>
                      <div className="map-explorer-item-coords">
                        {formatPolarCoords(c.latitude, c.longitude)}
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* Station List Items */}
            {!isLoading && activeTab === 'stations' && (
              filteredStations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No stations match the search query.
                </div>
              ) : (
                filteredStations.map((st) => {
                  const isSelected = selectedEntity && selectedEntity.id === st.id && selectedEntity.type === 'station';

                  return (
                    <div
                      key={st.id}
                      className={`map-explorer-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectEntity({ ...st, type: 'station' })}
                    >
                      <div className="map-explorer-item-header">
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)' }}>
                          STATION
                        </span>
                        <StatusBadge status={st.status} />
                      </div>
                      <div className="map-explorer-item-title">{st.name}</div>
                      <div className="map-explorer-item-sub">{st.type} • {st.elevation || 'ASL'}</div>
                      <div className="map-explorer-item-loc">
                        <Compass size={11} />
                        <span>{st.region}</span>
                      </div>
                      <div className="map-explorer-item-coords">
                        {formatPolarCoords(st.latitude, st.longitude)}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Center Interactive Polar Map & Layer Control */}
        <div className="map-canvas-container">
          {/* Map Top Layer Control Bar */}
          <div className="map-control-header">
            <div className="map-layer-toggles">
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>
                Layers:
              </span>
              <button
                className={`map-layer-btn ${showPersonnel ? 'active' : ''}`}
                onClick={() => setShowPersonnel(!showPersonnel)}
              >
                <Users size={13} />
                <span>Personnel ({personnel.length})</span>
              </button>
              <button
                className={`map-layer-btn ${showCargo ? 'active' : ''}`}
                onClick={() => setShowCargo(!showCargo)}
              >
                <Box size={13} />
                <span>Cargo ({cargo.length})</span>
              </button>
              <button
                className={`map-layer-btn ${showStations ? 'active' : ''}`}
                onClick={() => setShowStations(!showStations)}
              >
                <Building2 size={13} />
                <span>Stations ({stations.length})</span>
              </button>
              <button
                className={`map-layer-btn emergency-btn ${emergencyOnly ? 'active' : ''}`}
                onClick={() => setEmergencyOnly(!emergencyOnly)}
              >
                <AlertTriangle size={13} />
                <span>Emergency Only</span>
              </button>
            </div>

            <div className="map-quick-actions">
              <button
                className="map-action-btn"
                onClick={() => setResetTrigger(t => t + 1)}
                title="Reset map view to Antarctica"
              >
                <Compass size={13} />
                <span>Reset View</span>
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map Body */}
          <div className="map-view-body">
            <PolarMap
              personnel={filteredPersonnel}
              stations={stations}
              cargo={filteredCargo}
              incidents={incidents}
              responseUnits={responseUnits}
              selectedEntity={selectedEntity}
              movementHistory={movementHistory}
              onSelectEntity={handleSelectEntity}
              showPersonnel={showPersonnel}
              showStations={showStations}
              showCargo={showCargo}
              emergencyOnly={emergencyOnly}
              resetTrigger={resetTrigger}
            />
          </div>

          {/* Selected Entity Dossier Panel (Drawer Overlay) */}
          {selectedEntity && (
            <div className="map-dossier-drawer">
              <div className="map-dossier-header">
                <div className="map-dossier-title-group">
                  <span className="mono-badge" style={{ color: 'var(--cyan-300)' }}>
                    {selectedEntity.type.toUpperCase()}
                  </span>
                  <StatusBadge status={selectedEntity.status} />
                </div>
                <button
                  className="map-dossier-close"
                  onClick={() => setSelectedEntity(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="map-dossier-body">
                <div>
                  <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '700', marginBottom: '2px' }}>
                    {selectedEntity.name}
                  </h4>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {selectedEntity.role ? `${selectedEntity.role} • ${selectedEntity.department || 'Operations'}` : (selectedEntity.type || selectedEntity.category)}
                  </div>
                </div>

                {/* Location & Freshness */}
                <div className="map-coords-card">
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Last Reported Coordinates
                    </div>
                    <div className="map-coords-val">
                      {formatPolarCoords(selectedEntity.latitude, selectedEntity.longitude)}
                    </div>
                  </div>
                  {selectedEntity.last_updated && (
                    <span className={`map-freshness-badge ${getLocationFreshness(selectedEntity.last_updated).cls}`}>
                      <Clock size={10} />
                      {getLocationFreshness(selectedEntity.last_updated).label}
                    </span>
                  )}
                </div>

                {/* Location Description */}
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Location: </span>
                  <strong style={{ color: 'var(--cyan-300)' }}>{selectedEntity.current_location || selectedEntity.region}</strong>
                </div>

                {/* Movement Trail Summary if Available */}
                {selectedEntity.type === 'personnel' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                      Recent Geospatial Movement Path
                    </div>
                    {isLoadingHistory ? (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Loading movement trail...</div>
                    ) : movementHistory.length === 0 ? (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No historical waypoints recorded.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                        {movementHistory.slice(0, 4).map((m) => (
                          <div key={m.id} style={{ fontSize: '11px', background: 'rgba(8,13,26,0.5)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                              <span>{m.timestamp}</span>
                              <span style={{ color: 'var(--cyan-300)' }}>{m.movement_type}</span>
                            </div>
                            <div style={{ color: '#fff', marginTop: '2px' }}>
                              {m.previous_location ? `${m.previous_location} → ` : ''}<strong>{m.new_location}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {selectedEntity.type === 'personnel' && onSelectPersonnel && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, padding: '7px', fontSize: '12px' }}
                      onClick={() => onSelectPersonnel(selectedEntity)}
                    >
                      <Eye size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Open Full Dossier
                    </button>
                  )}
                  {selectedEntity.type === 'cargo' && onSelectCargo && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, padding: '7px', fontSize: '12px' }}
                      onClick={() => onSelectCargo(selectedEntity)}
                    >
                      <Box size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      View Cargo Manifest
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
