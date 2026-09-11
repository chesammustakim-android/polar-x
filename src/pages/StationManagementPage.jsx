import React, { useState, useEffect, useCallback } from 'react';
import {
  Building,
  Plus,
  Edit3,
  Power,
  RotateCcw,
  Boxes,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  MapPin,
  Compass,
  FileText,
  Shield,
  Layers,
  ChevronRight,
  X,
  Loader,
  Clock,
  User,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';

const STATION_TYPES = [
  'Research Station',
  'Field Outpost',
  'Storage Depot',
  'Logistics Camp',
  'Drill Site',
  'Water Facility'
];

const REGIONS = [
  'Antarctica - Queen Maud Land',
  'Antarctica - Larsemann Hills',
  'Arctic - Svalbard',
  'Antarctica - Ice Shelf',
  'South Africa Staging'
];

export default function StationManagementPage({ currentUser }) {
  const user = currentUser || api.getStoredUser() || {};
  const role = (user.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const isDirector = role === 'EXPEDITION_DIRECTOR';
  const isStationHead = role === 'STATION_HEAD';
  const canManage = isAdmin || isDirector;

  // Station state
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected station for detailed operations
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview, requirements, consumption

  // Requirements state
  const [requirements, setRequirements] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  // Consumption state
  const [consumptionLogs, setConsumptionLogs] = useState([]);
  const [consLoading, setConsLoading] = useState(false);

  // Inventory catalog for picking resources
  const [inventoryList, setInventoryList] = useState([]);

  // Modals
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [isEditStationOpen, setIsEditStationOpen] = useState(false);
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [isLogConsumptionOpen, setIsLogConsumptionOpen] = useState(false);

  // Form states
  const [stationForm, setStationForm] = useState({
    name: '',
    type: 'Research Station',
    latitude: -70.7670,
    longitude: 11.7400,
    elevation: '100m ASL',
    region: 'Antarctica - Queen Maud Land',
    description: ''
  });

  const [reqForm, setReqForm] = useState({
    item_code: 'FUEL-003',
    minimum_quantity: 1000,
    unit: 'Litres',
    item_name: ''
  });

  const [consForm, setConsForm] = useState({
    item_code: 'FUEL-003',
    consumption_date: new Date().toISOString().split('T')[0],
    consumed_quantity: 50,
    unit: 'Litres',
    notes: ''
  });

  // Load stations
  const loadStations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStations();
      const list = Array.isArray(data) ? data : [];
      setStations(list);

      // If Station Head, auto-select assigned station
      if (isStationHead && user.assigned_station_id) {
        const assigned = list.find(s => s.id === user.assigned_station_id);
        if (assigned) {
          setSelectedStation(assigned);
        } else if (list.length > 0) {
          setSelectedStation(list[0]);
        }
      } else if (!selectedStation && list.length > 0) {
        setSelectedStation(list[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load station registry.');
    } finally {
      setLoading(false);
    }
  }, [isStationHead, user.assigned_station_id]);

  // Load inventory catalog for item picker
  const loadInventory = useCallback(async () => {
    try {
      const data = await api.getInventory();
      setInventoryList(Array.isArray(data) ? data : []);
    } catch {
      setInventoryList([]);
    }
  }, []);

  useEffect(() => {
    loadStations();
    loadInventory();
  }, [loadStations, loadInventory]);

  // Load requirements when station selected or tab changed
  const loadRequirements = useCallback(async (stId) => {
    if (!stId) return;
    try {
      setReqLoading(true);
      const data = await api.getStationRequirements(stId, false);
      setRequirements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load requirements:', err.message);
      setRequirements([]);
    } finally {
      setReqLoading(false);
    }
  }, []);

  // Load consumption logs
  const loadConsumption = useCallback(async (stId) => {
    if (!stId) return;
    try {
      setConsLoading(true);
      const data = await api.getStationConsumption(stId);
      setConsumptionLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load consumption:', err.message);
      setConsumptionLogs([]);
    } finally {
      setConsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStation) {
      if (activeSubTab === 'requirements') {
        loadRequirements(selectedStation.id);
      } else if (activeSubTab === 'consumption') {
        loadConsumption(selectedStation.id);
      }
    }
  }, [selectedStation, activeSubTab, loadRequirements, loadConsumption]);

  // Feedback banner helper
  const showFeedback = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Station Actions (Admin / Director)
  const handleCreateStation = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const created = await api.createStation(stationForm);
      showFeedback(`Station "${created.name}" successfully registered into polar command.`);
      setIsAddStationOpen(false);
      await loadStations();
      setSelectedStation(created);
    } catch (err) {
      setError(err.message || 'Failed to create station.');
    }
  };

  const handleUpdateStation = async (e) => {
    e.preventDefault();
    if (!selectedStation) return;
    try {
      setError(null);
      const updated = await api.updateStation(selectedStation.id, stationForm);
      showFeedback(`Station "${updated.name}" specifications successfully updated.`);
      setIsEditStationOpen(false);
      await loadStations();
      setSelectedStation(updated);
    } catch (err) {
      setError(err.message || 'Failed to update station.');
    }
  };

  const handleToggleStationStatus = async (station) => {
    const isInactive = station.status === 'INACTIVE';
    try {
      setError(null);
      if (isInactive) {
        await api.reactivateStation(station.id);
        showFeedback(`Station "${station.name}" reactivated to OPERATIONAL status.`);
      } else {
        await api.deactivateStation(station.id);
        showFeedback(`Station "${station.name}" marked INACTIVE. Historical records preserved.`);
      }
      await loadStations();
      if (selectedStation && selectedStation.id === station.id) {
        setSelectedStation(prev => ({
          ...prev,
          status: isInactive ? 'OPERATIONAL' : 'INACTIVE'
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to change station status.');
    }
  };

  // Requirements Actions
  const handleAddRequirement = async (e) => {
    e.preventDefault();
    if (!selectedStation) return;
    try {
      setError(null);
      await api.createStationRequirement(selectedStation.id, reqForm);
      showFeedback(`Minimum requirement for ${reqForm.item_code} configured successfully.`);
      setIsAddReqOpen(false);
      loadRequirements(selectedStation.id);
    } catch (err) {
      setError(err.message || 'Failed to create requirement.');
    }
  };

  const handleDeactivateRequirement = async (reqId) => {
    if (!selectedStation) return;
    try {
      setError(null);
      await api.deactivateStationRequirement(selectedStation.id, reqId);
      showFeedback('Resource requirement deactivated.');
      loadRequirements(selectedStation.id);
    } catch (err) {
      setError(err.message || 'Failed to deactivate requirement.');
    }
  };

  // Daily Consumption Action
  const handleLogConsumption = async (e) => {
    e.preventDefault();
    if (!selectedStation) return;
    try {
      setError(null);
      await api.createDailyConsumption(selectedStation.id, consForm);
      showFeedback(`Daily consumption recorded: ${consForm.consumed_quantity} ${consForm.unit} of ${consForm.item_code}.`);
      setIsLogConsumptionOpen(false);
      loadConsumption(selectedStation.id);
    } catch (err) {
      setError(err.message || 'Failed to record consumption.');
    }
  };

  const canLogConsumption = canManage || (isStationHead && user.assigned_station_id === selectedStation?.id);

  // Filtered stations — all operational roles have full visibility across stations
  const filteredStations = stations.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.region && s.region.toLowerCase().includes(search.toLowerCase())) ||
      (s.type && s.type.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || s.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="cargo-page" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.05))',
                border: '1px solid var(--cyan-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cyan-300)'
              }}
            >
              <Building size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
                {isStationHead ? `Station Command — ${user.assigned_station_name || 'Assigned Station'}` : 'Polar Station & Facility Management'}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                {isStationHead
                  ? 'Global facility operational picture: view all Antarctic stations; modification authority scoped to your assigned station.'
                  : 'NCPOR expedition directorate: manage permanent research bases, field outposts, buffer requirements & consumption.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canManage && (
            <button
              className="btn-primary"
              onClick={() => {
                setStationForm({
                  name: '',
                  type: 'Research Station',
                  latitude: -70.7670,
                  longitude: 11.7400,
                  elevation: '100m ASL',
                  region: 'Antarctica - Queen Maud Land',
                  description: ''
                });
                setIsAddStationOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              <Plus size={15} />
              <span>Register Station</span>
            </button>
          )}

          {selectedStation && canLogConsumption && (
            <button
              className="btn-secondary"
              onClick={() => {
                setConsForm({
                  item_code: requirements[0]?.item_code || 'FUEL-003',
                  consumption_date: new Date().toISOString().split('T')[0],
                  consumed_quantity: 50,
                  unit: requirements[0]?.unit || 'Litres',
                  notes: ''
                });
                setIsLogConsumptionOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--cyan-300)' }}
            >
              <Calendar size={15} />
              <span>Log Daily Consumption</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--hazard-red-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--hazard-red)',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: canManage ? '340px 1fr' : '1fr', gap: '20px' }}>
        {/* Left Column: Station Directory (Visible for Director/Admin; collapsed for Station Head) */}
        {canManage && (
          <div
            style={{
              background: 'var(--surface-panel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              height: 'fit-content'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                Polar Facilities ({filteredStations.length})
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-400)' }}>
                MoES • NCPOR
              </span>
            </div>

            {/* Search and Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter stations..."
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select
                  className="inventory-filter-select"
                  style={{ height: '32px', fontSize: '11px' }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPERATIONAL">OPERATIONAL</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SEASONAL_ACTIVE">SEASONAL ACTIVE</option>
                </select>

                <select
                  className="inventory-filter-select"
                  style={{ height: '32px', fontSize: '11px' }}
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Types</option>
                  {STATION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Station List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '580px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <Loader size={18} className="radar-sweep-icon" style={{ margin: '0 auto 8px auto' }} />
                  Loading stations...
                </div>
              ) : filteredStations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No stations match your criteria.
                </div>
              ) : (
                filteredStations.map(st => {
                  const isSelected = selectedStation?.id === st.id;
                  const isInactive = st.status === 'INACTIVE';
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStation(st)}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'var(--cyan-400)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        opacity: isInactive ? 0.65 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                          {st.name}
                        </strong>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: isInactive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isInactive ? 'var(--hazard-red)' : 'var(--hazard-green)',
                            border: `1px solid ${isInactive ? 'var(--hazard-red-border)' : 'var(--hazard-green-border)'}`
                          }}
                        >
                          {st.status || 'OPERATIONAL'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {st.type} • {st.region || 'Antarctica'}
                      </div>

                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)', marginTop: '4px' }}>
                        {st.latitude.toFixed(4)}°, {st.longitude.toFixed(4)}°
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right Column: Station Details & Sub-Tabs */}
        {selectedStation ? (
          <div
            style={{
              background: 'var(--surface-panel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            {/* Station Overview Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>
                    {selectedStation.name}
                  </h2>
                  <StatusBadge status={selectedStation.status || 'OPERATIONAL'} />
                  <span className="item-category-pill" style={{ fontSize: '11px' }}>
                    {selectedStation.type}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedStation.description || 'Permanent polar facility managed under NCPOR authority.'}
                </div>
              </div>

              {canManage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setStationForm({
                        name: selectedStation.name,
                        type: selectedStation.type,
                        latitude: selectedStation.latitude,
                        longitude: selectedStation.longitude,
                        elevation: selectedStation.elevation || '100m ASL',
                        region: selectedStation.region || 'Antarctica',
                        description: selectedStation.description || ''
                      });
                      setIsEditStationOpen(true);
                    }}
                    style={{ padding: '6px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Edit3 size={13} />
                    <span>Edit Specifications</span>
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => handleToggleStationStatus(selectedStation)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: selectedStation.status === 'INACTIVE' ? 'var(--hazard-green)' : 'var(--hazard-red)',
                      borderColor: selectedStation.status === 'INACTIVE' ? 'var(--hazard-green-border)' : 'var(--hazard-red-border)'
                    }}
                  >
                    <Power size={13} />
                    <span>{selectedStation.status === 'INACTIVE' ? 'Reactivate Station' : 'Deactivate'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="exp-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Coordinates</span>
                <span className="exp-metric-val" style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                  {selectedStation.latitude.toFixed(4)}°, {selectedStation.longitude.toFixed(4)}°
                </span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Elevation</span>
                <span className="exp-metric-val">{selectedStation.elevation || '100m ASL'}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Geographic Region</span>
                <span className="exp-metric-val" style={{ fontSize: '11.5px' }}>{selectedStation.region || 'Antarctica'}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Station ID</span>
                <span className="exp-metric-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)' }}>
                  STN-{String(selectedStation.id).padStart(3, '0')}
                </span>
              </div>
            </div>

            {/* Sub-Tabs: Overview, Resource Requirements, Daily Consumption */}
            <div className="cargo-detail-tabs" style={{ marginTop: '6px' }}>
              <button
                className={`cargo-detail-tab ${activeSubTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('overview')}
              >
                <Info size={13} />
                Facility Telemetry
              </button>
              <button
                className={`cargo-detail-tab ${activeSubTab === 'requirements' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubTab('requirements');
                  loadRequirements(selectedStation.id);
                }}
              >
                <Boxes size={13} />
                Resource Requirements ({requirements.length})
              </button>
              <button
                className={`cargo-detail-tab ${activeSubTab === 'consumption' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubTab('consumption');
                  loadConsumption(selectedStation.id);
                }}
              >
                <Calendar size={13} />
                Daily Consumption Registry ({consumptionLogs.length})
              </button>
            </div>

            {/* SUB-TAB 1: Facility Telemetry */}
            {activeSubTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12.5px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ color: '#fff', fontSize: '13.5px', margin: '0 0 8px 0' }}>Operational Overview</h4>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    {selectedStation.description || 'This polar facility serves as an active research platform and logistics buffer station under the supervision of the National Centre for Polar and Ocean Research (NCPOR). Minimum safety quantities and daily resource consumption are systematically audited.'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Security & Command
                    </span>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginTop: '6px' }}>
                      {selectedStation.name.includes('Maitri') ? 'Dr. Tenzing Norbu (Station Head)' : selectedStation.name.includes('Himadri') ? 'Dr. Amit K. Verma (Station Head)' : 'Command Officer Assigned'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      NCPOR Directorate • 24/7 High-Latitude Telemetry
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Operational Buffer Protocol
                    </span>
                    <div style={{ color: 'var(--cyan-300)', fontSize: '13px', fontWeight: '600', marginTop: '6px' }}>
                      Pass 1 Requirements Active
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      Daily consumption logged without speculative burn-rate projections.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: Resource Requirements */}
            {activeSubTab === 'requirements' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: '14px', margin: 0 }}>
                      Station Minimum Required Quantities
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: '2px 0 0 0' }}>
                      Persisted safety threshold buffers. Expeditions and resupply missions monitor these baselines.
                    </p>
                  </div>

                  {canManage && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setReqForm({
                          item_code: inventoryList[0]?.item_code || 'FUEL-003',
                          minimum_quantity: 1000,
                          unit: inventoryList[0]?.unit || 'Litres',
                          item_name: inventoryList[0]?.item_name || ''
                        });
                        setIsAddReqOpen(true);
                      }}
                      style={{ padding: '6px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Plus size={13} />
                      <span>Add Requirement</span>
                    </button>
                  )}
                </div>

                {reqLoading ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Loader size={18} className="radar-sweep-icon" style={{ margin: '0 auto 8px auto' }} />
                    Loading station resource requirements...
                  </div>
                ) : requirements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Boxes size={22} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No resource requirements defined for {selectedStation.name}.</p>
                    {canManage && <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Add Requirement" to set minimum stock thresholds.</p>}
                  </div>
                ) : (
                  <div className="inventory-table-wrap">
                    <table className="inventory-table">
                      <thead>
                        <tr>
                          <th>Resource Code</th>
                          <th>Resource Name</th>
                          <th>Minimum Quantity</th>
                          <th>Unit</th>
                          <th>Status</th>
                          <th>Last Updated</th>
                          {canManage && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {requirements.map(r => (
                          <tr key={r.id}>
                            <td>
                              <span className="item-code-cell">{r.item_code}</span>
                            </td>
                            <td>
                              <strong style={{ color: '#fff' }}>{r.item_name || r.item_code}</strong>
                            </td>
                            <td>
                              <span style={{ color: 'var(--cyan-300)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                                {r.minimum_quantity.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{r.unit || 'Units'}</span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: '700',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: r.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: r.is_active ? 'var(--hazard-green)' : 'var(--hazard-red)',
                                  border: `1px solid ${r.is_active ? 'var(--hazard-green-border)' : 'var(--hazard-red-border)'}`
                                }}
                              >
                                {r.is_active ? 'ACTIVE REQUIREMENT' : 'DEACTIVATED'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {r.updated_at || r.created_at || '—'}
                              </span>
                            </td>
                            {canManage && (
                              <td>
                                {r.is_active ? (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => handleDeactivateRequirement(r.id)}
                                    style={{ padding: '4px 8px', fontSize: '10.5px', color: 'var(--hazard-red)' }}
                                    title="Soft-deactivate requirement"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Archived</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: Daily Consumption Registry */}
            {activeSubTab === 'consumption' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: '14px', margin: 0 }}>
                      Daily Consumption Registry
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: '2px 0 0 0' }}>
                      Historical operational logs. Captures consumed quantities without speculative burn rate formulas.
                    </p>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => {
                      setConsForm({
                        item_code: requirements[0]?.item_code || inventoryList[0]?.item_code || 'FUEL-003',
                        consumption_date: new Date().toISOString().split('T')[0],
                        consumed_quantity: 50,
                        unit: requirements[0]?.unit || 'Litres',
                        notes: ''
                      });
                      setIsLogConsumptionOpen(true);
                    }}
                    style={{ padding: '6px 12px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Plus size={13} />
                    <span>Log Daily Consumption</span>
                  </button>
                </div>

                {consLoading ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Loader size={18} className="radar-sweep-icon" style={{ margin: '0 auto 8px auto' }} />
                    Loading daily consumption history...
                  </div>
                ) : consumptionLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Calendar size={22} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No daily consumption logged yet for {selectedStation.name}.</p>
                    <p style={{ fontSize: '11px', marginTop: '4px' }}>Use "Log Daily Consumption" to record operational resource consumption.</p>
                  </div>
                ) : (
                  <div className="inventory-table-wrap">
                    <table className="inventory-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Resource Code</th>
                          <th>Resource Name</th>
                          <th>Consumed Qty</th>
                          <th>Unit</th>
                          <th>Recorded By</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumptionLogs.map(c => (
                          <tr key={c.id}>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fff' }}>
                                {c.consumption_date}
                              </span>
                            </td>
                            <td>
                              <span className="item-code-cell">{c.item_code}</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-primary)' }}>{c.item_name || c.item_code}</span>
                            </td>
                            <td>
                              <span style={{ color: '#f87171', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                                -{c.consumed_quantity.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{c.unit || 'Units'}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', color: 'var(--cyan-300)' }}>
                                {c.recorded_by}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {c.notes || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Select a polar facility to inspect specifications and operational requirements.
          </div>
        )}
      </div>

      {/* ─── MODAL: Add Station ─── */}
      {isAddStationOpen && (
        <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && setIsAddStationOpen(false)}>
          <div className="cargo-detail-panel" style={{ maxWidth: '520px', margin: 'auto' }}>
            <div className="cargo-detail-topbar">
              <h3 style={{ color: '#fff', fontSize: '15px' }}>Register New Polar Facility</h3>
              <button className="cargo-detail-close" onClick={() => setIsAddStationOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateStation} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Station Name *</label>
                <input
                  type="text"
                  required
                  className="search-input"
                  style={{ width: '100%', marginTop: '4px', height: '36px' }}
                  placeholder="e.g. Maitri South Relay Outpost"
                  value={stationForm.name}
                  onChange={e => setStationForm({ ...stationForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Facility Type</label>
                  <select
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.type}
                    onChange={e => setStationForm({ ...stationForm, type: e.target.value })}
                  >
                    {STATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Region</label>
                  <select
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.region}
                    onChange={e => setStationForm({ ...stationForm, region: e.target.value })}
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Latitude (-90 to +90)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.latitude}
                    onChange={e => setStationForm({ ...stationForm, latitude: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Longitude (-180 to +180)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.longitude}
                    onChange={e => setStationForm({ ...stationForm, longitude: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Elevation</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    placeholder="e.g. 120m ASL"
                    value={stationForm.elevation}
                    onChange={e => setStationForm({ ...stationForm, elevation: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Operational Description</label>
                <textarea
                  className="search-input"
                  rows={3}
                  style={{ width: '100%', marginTop: '4px', padding: '8px', fontSize: '12px' }}
                  placeholder="Operational details, mission focus, and communication channels..."
                  value={stationForm.description}
                  onChange={e => setStationForm({ ...stationForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddStationOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Edit Station ─── */}
      {isEditStationOpen && selectedStation && (
        <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && setIsEditStationOpen(false)}>
          <div className="cargo-detail-panel" style={{ maxWidth: '520px', margin: 'auto' }}>
            <div className="cargo-detail-topbar">
              <h3 style={{ color: '#fff', fontSize: '15px' }}>Edit Station Specifications</h3>
              <button className="cargo-detail-close" onClick={() => setIsEditStationOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStation} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Station Name *</label>
                <input
                  type="text"
                  required
                  className="search-input"
                  style={{ width: '100%', marginTop: '4px', height: '36px' }}
                  value={stationForm.name}
                  onChange={e => setStationForm({ ...stationForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Facility Type</label>
                  <select
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.type}
                    onChange={e => setStationForm({ ...stationForm, type: e.target.value })}
                  >
                    {STATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Region</label>
                  <select
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.region}
                    onChange={e => setStationForm({ ...stationForm, region: e.target.value })}
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.latitude}
                    onChange={e => setStationForm({ ...stationForm, latitude: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.longitude}
                    onChange={e => setStationForm({ ...stationForm, longitude: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Elevation</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={stationForm.elevation}
                    onChange={e => setStationForm({ ...stationForm, elevation: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Operational Description</label>
                <textarea
                  className="search-input"
                  rows={3}
                  style={{ width: '100%', marginTop: '4px', padding: '8px', fontSize: '12px' }}
                  value={stationForm.description}
                  onChange={e => setStationForm({ ...stationForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsEditStationOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Add Resource Requirement ─── */}
      {isAddReqOpen && selectedStation && (
        <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && setIsAddReqOpen(false)}>
          <div className="cargo-detail-panel" style={{ maxWidth: '480px', margin: 'auto' }}>
            <div className="cargo-detail-topbar">
              <h3 style={{ color: '#fff', fontSize: '15px' }}>Add Required Resource Threshold</h3>
              <button className="cargo-detail-close" onClick={() => setIsAddReqOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddRequirement} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Station</label>
                <input
                  type="text"
                  disabled
                  className="search-input"
                  style={{ width: '100%', marginTop: '4px', height: '36px', background: 'rgba(255,255,255,0.05)', color: 'var(--cyan-300)' }}
                  value={selectedStation.name}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Resource Item *</label>
                <select
                  className="inventory-filter-select"
                  style={{ width: '100%', marginTop: '4px', height: '36px' }}
                  value={reqForm.item_code}
                  onChange={e => {
                    const sel = inventoryList.find(i => i.item_code === e.target.value);
                    setReqForm({
                      ...reqForm,
                      item_code: e.target.value,
                      item_name: sel?.item_name || '',
                      unit: sel?.unit || reqForm.unit
                    });
                  }}
                >
                  {inventoryList.map(inv => (
                    <option key={inv.item_code} value={inv.item_code}>
                      {inv.item_code} — {inv.item_name} ({inv.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Minimum Required Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={reqForm.minimum_quantity}
                    onChange={e => setReqForm({ ...reqForm, minimum_quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Unit</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={reqForm.unit}
                    onChange={e => setReqForm({ ...reqForm, unit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddReqOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Persist Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Log Daily Consumption ─── */}
      {isLogConsumptionOpen && selectedStation && (
        <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && setIsLogConsumptionOpen(false)}>
          <div className="cargo-detail-panel" style={{ maxWidth: '480px', margin: 'auto' }}>
            <div className="cargo-detail-topbar">
              <h3 style={{ color: '#fff', fontSize: '15px' }}>Record Daily Station Consumption</h3>
              <button className="cargo-detail-close" onClick={() => setIsLogConsumptionOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLogConsumption} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Station</label>
                <input
                  type="text"
                  disabled
                  className="search-input"
                  style={{ width: '100%', marginTop: '4px', height: '36px', background: 'rgba(255,255,255,0.05)', color: 'var(--cyan-300)' }}
                  value={selectedStation.name}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Consumption Date (YYYY-MM-DD) *</label>
                  <input
                    type="date"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={consForm.consumption_date}
                    onChange={e => setConsForm({ ...consForm, consumption_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Resource Item *</label>
                  <select
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={consForm.item_code}
                    onChange={e => {
                      const sel = inventoryList.find(i => i.item_code === e.target.value);
                      setConsForm({
                        ...consForm,
                        item_code: e.target.value,
                        unit: sel?.unit || consForm.unit
                      });
                    }}
                  >
                    {inventoryList.map(inv => (
                      <option key={inv.item_code} value={inv.item_code}>
                        {inv.item_code} — {inv.item_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Consumed Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={consForm.consumed_quantity}
                    onChange={e => setConsForm({ ...consForm, consumed_quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Unit</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', marginTop: '4px', height: '36px' }}
                    value={consForm.unit}
                    onChange={e => setConsForm({ ...consForm, unit: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>Operational Log Notes</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', marginTop: '4px', height: '36px' }}
                  placeholder="e.g. Daily generator heating buffer discharge"
                  value={consForm.notes}
                  onChange={e => setConsForm({ ...consForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsLogConsumptionOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Consumption Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
