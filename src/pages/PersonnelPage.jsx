import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, MapPin, AlertTriangle, RefreshCw, Search, Plus, Filter,
  X, ArrowRight, Clock, ChevronDown, Eye, Navigation, History,
  ShieldAlert, Plane, Truck, Wrench, FlaskConical, UserCog, Activity
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';

// --- Movement type icons & styles ---
const MOVEMENT_CONFIG = {
  DEPARTURE:        { label: 'Departure',         cls: 'departure',        Icon: ArrowRight },
  ARRIVAL:          { label: 'Arrival',            cls: 'arrival',          Icon: MapPin },
  FIELD_MOVEMENT:   { label: 'Field Movement',     cls: 'field-movement',   Icon: Navigation },
  VEHICLE_MOVEMENT: { label: 'Vehicle Movement',   cls: 'vehicle-movement', Icon: Truck },
  RETURN_TO_BASE:   { label: 'Return to Base',     cls: 'return-to-base',   Icon: ShieldAlert },
  MANUAL_UPDATE:    { label: 'Manual Update',      cls: 'manual-update',    Icon: UserCog },
};

const STATUS_VALUES = ['AT_STATION', 'FIELD', 'IN_TRANSIT', 'RESTING', 'EMERGENCY', 'OFF_DUTY'];
const ROLE_VALUES   = ['Expedition Leader', 'Scientist', 'Engineer', 'Medical Officer', 'Logistics Officer', 'Technician', 'Pilot', 'Field Operator'];
const DEPT_VALUES   = ['Science & Research', 'Logistics & Traverse', 'Engineering & Microgrid', 'Medical & SAR', 'Station Operations', 'Aviation & Transport'];
const MOVEMENT_TYPES = ['DEPARTURE', 'ARRIVAL', 'FIELD_MOVEMENT', 'VEHICLE_MOVEMENT', 'RETURN_TO_BASE', 'MANUAL_UPDATE'];

function formatCoords(lat, lon) {
  if (lat == null || lon == null) return '—';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function isEmergency(status) {
  return (status || '').toUpperCase() === 'EMERGENCY';
}

// ---- TOAST ----
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`prs-toast ${type}`}>
      {type === 'success' ? <Activity size={16} style={{ color: '#10b981', flexShrink: 0 }} /> :
                            <AlertTriangle size={16} style={{ color: 'var(--hazard-red)', flexShrink: 0 }} />}
      <span>{message}</span>
    </div>
  );
}

// ---- MOVEMENT TIMELINE ----
function MovementTimeline({ movements, isLoading }) {
  if (isLoading) return <div className="prs-empty-state"><p>Loading history…</p></div>;
  if (!movements || movements.length === 0) {
    return <div className="prs-empty-state"><History size={32} /><p>No movement history recorded yet.</p></div>;
  }
  return (
    <div className="prs-timeline">
      {movements.map((m) => {
        const cfg = MOVEMENT_CONFIG[m.movement_type] || MOVEMENT_CONFIG.MANUAL_UPDATE;
        const Icon = cfg.Icon;
        const isEmerg = isEmergency(m.status);
        return (
          <div key={m.id} className="prs-timeline-item">
            <div className={`prs-timeline-dot ${cfg.cls}${isEmerg ? ' emergency' : ''}`}>
              <Icon size={14} style={{ color: isEmerg ? 'var(--hazard-red)' : 'inherit' }} />
            </div>
            <div className="prs-timeline-content">
              <div className="prs-timeline-ts">{m.timestamp}</div>
              <div className="prs-timeline-loc-row">
                {m.previous_location && (
                  <>
                    <span className="prs-timeline-from">{m.previous_location}</span>
                    <span className="prs-timeline-arrow">→</span>
                  </>
                )}
                <span className="prs-timeline-to">{m.new_location}</span>
              </div>
              <div className="prs-timeline-meta">
                <span className={`prs-timeline-type-badge ${cfg.cls}${isEmerg ? ' emergency' : ''}`}>
                  {cfg.label}
                </span>
                <StatusBadge status={m.status} />
              </div>
              {m.notes && <div className="prs-timeline-notes">{m.notes}</div>}
              {(m.new_latitude != null) && (
                <div className="prs-coords">{formatCoords(m.new_latitude, m.new_longitude)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- DETAIL DRAWER ----
export function PersonnelDetailDrawer({ personId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isLoadingHist, setIsLoadingHist] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingDetail(true);
      const data = await api.getPersonnelById(personId);
      if (data) {
        setDetail(data);
        setMovements(data.movements || []);
      }
      setIsLoadingDetail(false);
    })();
  }, [personId]);

  const loadHistory = async () => {
    if (activeTab === 'history' && detail) {
      setIsLoadingHist(true);
      const hist = await api.getPersonnelHistory(detail.id);
      if (hist) setMovements(hist);
      setIsLoadingHist(false);
    }
  };

  useEffect(() => { loadHistory(); }, [activeTab]);

  if (isLoadingDetail) {
    return (
      <div className="prs-drawer-overlay" onClick={onClose}>
        <div className="prs-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="prs-drawer-header">
            <div className="prs-empty-state" style={{ flex: 1 }}><RefreshCw size={24} /><p>Loading…</p></div>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const emer = isEmergency(detail.status);

  return (
    <div className="prs-drawer-overlay" onClick={onClose}>
      <div className="prs-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="prs-drawer-header">
          <div className={`prs-drawer-avatar ${emer ? 'emergency' : ''}`}>
            {detail.personnel_code || detail.name?.charAt(0)}
          </div>
          <div className="prs-drawer-meta">
            <div className="prs-drawer-name">{detail.name}</div>
            <div className="prs-drawer-role">{detail.role} · {detail.department}</div>
            <StatusBadge status={detail.status} style={{ marginTop: 4 }} />
          </div>
          <button className="prs-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="prs-drawer-tabs">
          {['overview', 'history'].map((tab) => (
            <button
              key={tab}
              className={`prs-drawer-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'Overview' : 'Movement History'}
            </button>
          ))}
        </div>

        <div className="prs-drawer-body">
          {activeTab === 'overview' && (
            <>
              {emer && (
                <div className="prs-emergency-banner">
                  <AlertTriangle size={18} />
                  <div className="prs-emergency-banner-text">
                    EMERGENCY STATUS — SAR Protocol Active
                  </div>
                </div>
              )}

              <div className="prs-info-section">
                <div className="prs-info-section-title">Current Location</div>
                <div className="prs-info-grid">
                  <div className="prs-info-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="prs-info-label">Location Name</div>
                    <div className={`prs-info-val ${emer ? 'emergency-val' : ''}`}>{detail.current_location}</div>
                  </div>
                  <div className="prs-info-item">
                    <div className="prs-info-label">Latitude</div>
                    <div className="prs-info-val mono">{detail.latitude?.toFixed(4)}°{detail.latitude >= 0 ? 'N' : 'S'}</div>
                  </div>
                  <div className="prs-info-item">
                    <div className="prs-info-label">Longitude</div>
                    <div className="prs-info-val mono">{detail.longitude?.toFixed(4)}°{detail.longitude >= 0 ? 'E' : 'W'}</div>
                  </div>
                  <div className="prs-info-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="prs-info-label">Last Updated</div>
                    <div className="prs-info-val mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{detail.last_updated || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="prs-info-section">
                <div className="prs-info-section-title">Personnel Details</div>
                <div className="prs-info-grid">
                  <div className="prs-info-item">
                    <div className="prs-info-label">Personnel Code</div>
                    <div className="prs-info-val mono">{detail.personnel_code}</div>
                  </div>
                  <div className="prs-info-item">
                    <div className="prs-info-label">Expedition</div>
                    <div className="prs-info-val" style={{ fontSize: 12 }}>{detail.expedition_name || 'Unassigned'}</div>
                  </div>
                  <div className="prs-info-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="prs-info-label">Specialization</div>
                    <div className="prs-info-val" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{detail.specialization || '—'}</div>
                  </div>
                  <div className="prs-info-item">
                    <div className="prs-info-label">Contact</div>
                    <div className="prs-info-val mono" style={{ fontSize: 12 }}>{detail.contact || '—'}</div>
                  </div>
                  <div className="prs-info-item">
                    <div className="prs-info-label">Emergency Contact</div>
                    <div className="prs-info-val mono" style={{ fontSize: 12 }}>{detail.emergency_contact || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="prs-info-section">
                <div className="prs-info-section-title">Recent Movements</div>
                <MovementTimeline movements={(detail.movements || []).slice(0, 5)} isLoading={false} />
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {movements.length} movement records
                </span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={loadHistory}>
                  <RefreshCw size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Refresh
                </button>
              </div>
              <MovementTimeline movements={movements} isLoading={isLoadingHist} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- UPDATE LOCATION MODAL ----
function LocationUpdateModal({ person, expeditions, onClose, onSuccess }) {
  const [form, setForm] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    status: person.status || 'AT_STATION',
    movement_type: 'MANUAL_UPDATE',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.location_name.trim()) e.location_name = 'Location name required';
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    if (form.latitude === '' || isNaN(lat)) e.latitude = 'Required';
    else if (lat < -90 || lat > 90) e.latitude = 'Must be −90 to +90';
    if (form.longitude === '' || isNaN(lon)) e.longitude = 'Required';
    else if (lon < -180 || lon > 180) e.longitude = 'Must be −180 to +180';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setIsSubmitting(true);
    try {
      const result = await api.updatePersonnelLocation(person.id, {
        location_name: form.location_name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        status: form.status,
        movement_type: form.movement_type,
        notes: form.notes.trim() || undefined,
      });
      onSuccess(result, form.status === 'EMERGENCY');
    } catch (err) {
      setErrors({ submit: err.message || 'Update failed' });
    }
    setIsSubmitting(false);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="prs-drawer-overlay" onClick={onClose}>
      <div className="prs-drawer" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="prs-drawer-header">
          <div className="prs-drawer-avatar"><Navigation size={20} /></div>
          <div className="prs-drawer-meta">
            <div className="prs-drawer-name">Update Location</div>
            <div className="prs-drawer-role">{person.name} · {person.personnel_code}</div>
          </div>
          <button className="prs-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="prs-drawer-body">
          {/* Preview */}
          <div className="prs-loc-preview" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Location Transition Preview</div>
            <div className="prs-loc-preview-row">
              <div className="prs-loc-preview-box">
                <div className="prs-loc-preview-box-label">Previous</div>
                <div className="prs-loc-preview-box-val" style={{ fontSize: 12 }}>{person.current_location || '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {formatCoords(person.latitude, person.longitude)}
                </div>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--cyan-400)', flexShrink: 0 }} />
              <div className="prs-loc-preview-box">
                <div className="prs-loc-preview-box-label">New</div>
                <div className="prs-loc-preview-box-val" style={{ fontSize: 12, color: form.location_name ? '#fff' : 'var(--text-muted)' }}>
                  {form.location_name || 'Enter location…'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {form.latitude && form.longitude ? formatCoords(parseFloat(form.latitude), parseFloat(form.longitude)) : '—'}
                </div>
              </div>
            </div>
            <div className="prs-loc-preview-row" style={{ marginTop: 10 }}>
              <div className="prs-loc-preview-box">
                <div className="prs-loc-preview-box-label">Previous Status</div>
                <div className="prs-loc-preview-box-val"><StatusBadge status={person.status} /></div>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--cyan-400)', flexShrink: 0 }} />
              <div className="prs-loc-preview-box">
                <div className="prs-loc-preview-box-label">New Status</div>
                <div className="prs-loc-preview-box-val"><StatusBadge status={form.status} /></div>
              </div>
            </div>
          </div>

          <div className="prs-modal-form">
            <div className="prs-form-group">
              <label className="prs-form-label">Location Name *</label>
              <input
                className={`prs-form-input ${errors.location_name ? 'error' : ''}`}
                placeholder="e.g. Maitri Station, Field Sector A…"
                value={form.location_name}
                onChange={(e) => set('location_name', e.target.value)}
              />
              {errors.location_name && <span className="prs-form-error">{errors.location_name}</span>}
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Latitude * (−90 to +90)</label>
                <input
                  className={`prs-form-input ${errors.latitude ? 'error' : ''}`}
                  placeholder="-70.7670"
                  type="number"
                  step="0.0001"
                  value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                />
                {errors.latitude && <span className="prs-form-error">{errors.latitude}</span>}
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Longitude * (−180 to +180)</label>
                <input
                  className={`prs-form-input ${errors.longitude ? 'error' : ''}`}
                  placeholder="11.7400"
                  type="number"
                  step="0.0001"
                  value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                />
                {errors.longitude && <span className="prs-form-error">{errors.longitude}</span>}
              </div>
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">New Status</label>
                <select className="prs-form-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Movement Type</label>
                <select className="prs-form-select" value={form.movement_type} onChange={(e) => set('movement_type', e.target.value)}>
                  {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_CONFIG[t]?.label || t}</option>)}
                </select>
              </div>
            </div>

            <div className="prs-form-group">
              <label className="prs-form-label">Notes</label>
              <input
                className="prs-form-input"
                placeholder="Optional notes about this movement…"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>

            {form.status === 'EMERGENCY' && (
              <div className="prs-emergency-banner">
                <AlertTriangle size={16} />
                <div className="prs-emergency-banner-text">
                  Setting EMERGENCY status will automatically generate a critical alert.
                </div>
              </div>
            )}

            {errors.submit && <div style={{ color: 'var(--hazard-red)', fontSize: 12 }}>{errors.submit}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Updating…' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- ADD PERSONNEL MODAL ----
function AddPersonnelModal({ expeditions, onClose, onSuccess }) {
  const [form, setForm] = useState({
    personnel_code: '',
    name: '',
    role: 'Scientist',
    department: 'Science & Research',
    contact: '',
    expedition_id: '',
    status: 'AT_STATION',
    current_location: 'Maitri Station',
    latitude: '-70.7670',
    longitude: '11.7400',
    specialization: '',
    emergency_contact: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.personnel_code.trim()) e.personnel_code = 'Personnel code required';
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.role) e.role = 'Role required';
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) e.latitude = 'Valid latitude: −90 to +90';
    if (isNaN(lon) || lon < -180 || lon > 180) e.longitude = 'Valid longitude: −180 to +180';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        expedition_id: form.expedition_id ? parseInt(form.expedition_id) : null,
        specialization: form.specialization.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        contact: form.contact.trim() || null,
      };
      const result = await api.createPersonnel(payload);
      onSuccess(result);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to create personnel record' });
    }
    setIsSubmitting(false);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="prs-drawer-overlay" onClick={onClose}>
      <div className="prs-drawer" style={{ width: 500, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="prs-drawer-header">
          <div className="prs-drawer-avatar"><Plus size={20} /></div>
          <div className="prs-drawer-meta">
            <div className="prs-drawer-name">Register Personnel</div>
            <div className="prs-drawer-role">Add new crew member to expedition roster</div>
          </div>
          <button className="prs-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="prs-drawer-body">
          <div className="prs-modal-form">
            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Personnel Code *</label>
                <input
                  className={`prs-form-input ${errors.personnel_code ? 'error' : ''}`}
                  placeholder="P-201"
                  value={form.personnel_code}
                  onChange={(e) => set('personnel_code', e.target.value)}
                />
                {errors.personnel_code && <span className="prs-form-error">{errors.personnel_code}</span>}
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Full Name *</label>
                <input
                  className={`prs-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="Dr. Jane Smith"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                {errors.name && <span className="prs-form-error">{errors.name}</span>}
              </div>
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Role *</label>
                <select className={`prs-form-select ${errors.role ? 'error' : ''}`} value={form.role} onChange={(e) => set('role', e.target.value)}>
                  {ROLE_VALUES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Department / Team</label>
                <select className="prs-form-select" value={form.department} onChange={(e) => set('department', e.target.value)}>
                  {DEPT_VALUES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Initial Status</label>
                <select className="prs-form-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Expedition</label>
                <select className="prs-form-select" value={form.expedition_id} onChange={(e) => set('expedition_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {expeditions.map((exp) => <option key={exp.id} value={exp.id}>{exp.name}</option>)}
                </select>
              </div>
            </div>

            <div className="prs-form-group">
              <label className="prs-form-label">Current Location Name</label>
              <input
                className="prs-form-input"
                placeholder="Maitri Station"
                value={form.current_location}
                onChange={(e) => set('current_location', e.target.value)}
              />
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Latitude (−90 to +90)</label>
                <input
                  className={`prs-form-input ${errors.latitude ? 'error' : ''}`}
                  type="number"
                  step="0.0001"
                  placeholder="-70.7670"
                  value={form.latitude}
                  onChange={(e) => set('latitude', e.target.value)}
                />
                {errors.latitude && <span className="prs-form-error">{errors.latitude}</span>}
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Longitude (−180 to +180)</label>
                <input
                  className={`prs-form-input ${errors.longitude ? 'error' : ''}`}
                  type="number"
                  step="0.0001"
                  placeholder="11.7400"
                  value={form.longitude}
                  onChange={(e) => set('longitude', e.target.value)}
                />
                {errors.longitude && <span className="prs-form-error">{errors.longitude}</span>}
              </div>
            </div>

            <div className="prs-modal-form-row">
              <div className="prs-form-group">
                <label className="prs-form-label">Contact Number</label>
                <input className="prs-form-input" placeholder="+91-98xxx-xxxxx" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
              </div>
              <div className="prs-form-group">
                <label className="prs-form-label">Emergency Contact</label>
                <input className="prs-form-input" placeholder="+91-98xxx-xxxxx" value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} />
              </div>
            </div>

            <div className="prs-form-group">
              <label className="prs-form-label">Specialization</label>
              <input
                className="prs-form-input"
                placeholder="e.g. Ice Sheet Dynamics & Glaciology"
                value={form.specialization}
                onChange={(e) => set('specialization', e.target.value)}
              />
            </div>

            {errors.submit && <div style={{ color: 'var(--hazard-red)', fontSize: 12, padding: '6px 0' }}>{errors.submit}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Registering…' : 'Register Personnel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function PersonnelPage({ initialExpeditionId, initialPersonId, currentUser }) {
  const user = currentUser || api.getStoredUser() || {};
  const userRole = (user.role || '').toUpperCase();
  const canAddPersonnel = ['ADMIN', 'EXPEDITION_DIRECTOR', 'EXPEDITION_LEADER'].includes(userRole);
  const canUpdateLocation = ['ADMIN', 'EXPEDITION_DIRECTOR', 'EXPEDITION_LEADER', 'SAR_OFFICER', 'FIELD_OPERATOR'].includes(userRole);

  const [personnel, setPersonnel]     = useState([]);
  const [summary, setSummary]         = useState(null);
  const [expeditions, setExpeditions] = useState([]);
  const [isLoading, setIsLoading]     = useState(true);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRole, setFilterRole]     = useState('ALL');
  const [filterExp, setFilterExp]       = useState(
    initialExpeditionId ? String(initialExpeditionId) : 'ALL'
  );

  // Active filter card
  const [activeCard, setActiveCard] = useState(null);

  // Modals / drawers
  const [viewPersonId, setViewPersonId]     = useState(initialPersonId || null);
  const [locUpdatePerson, setLocUpdatePerson] = useState(null);
  const [histPerson, setHistPerson]         = useState(null);
  const [showAddModal, setShowAddModal]     = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    const filters = {};
    if (search) filters.search = search;
    if (filterStatus !== 'ALL') filters.status = filterStatus;
    if (filterRole !== 'ALL') filters.role = filterRole;
    if (filterExp !== 'ALL') filters.expedition_id = parseInt(filterExp);

    const [pData, sData, eData] = await Promise.all([
      api.getPersonnel(filters),
      api.getPersonnelSummary(),
      api.getExpeditions ? api.getExpeditions() : Promise.resolve([]),
    ]);

    if (pData) setPersonnel(pData);
    if (sData) setSummary(sData);
    if (eData) setExpeditions(eData);
    setIsLoading(false);
  }, [search, filterStatus, filterRole, filterExp]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Card filter click
  const handleCardClick = (statusKey) => {
    if (activeCard === statusKey) {
      setActiveCard(null);
      setFilterStatus('ALL');
    } else {
      setActiveCard(statusKey);
      setFilterStatus(statusKey);
    }
  };

  const handleLocSuccess = async (updatedPerson, wasEmergency) => {
    setLocUpdatePerson(null);
    await loadAll();
    if (wasEmergency) {
      showToast(`EMERGENCY alert generated for ${updatedPerson?.name || 'personnel'}`, 'error');
    } else {
      showToast('Location updated and movement history recorded');
    }
  };

  const handleAddSuccess = async () => {
    setShowAddModal(false);
    await loadAll();
    showToast('Personnel registered successfully');
  };

  // Summary card config
  const statCards = [
    { key: 'AT_STATION',  label: 'AT STATION',  value: summary?.at_station ?? '—',  icon: <Users size={18} />,         colorCls: '' },
    { key: 'FIELD',       label: 'IN FIELD',     value: summary?.field ?? '—',        icon: <MapPin size={18} />,        colorCls: 'field' },
    { key: 'IN_TRANSIT',  label: 'IN TRANSIT',   value: summary?.in_transit ?? '—',   icon: <Truck size={18} />,         colorCls: 'transit' },
    { key: 'RESTING',     label: 'RESTING',      value: summary?.resting ?? '—',      icon: <Activity size={18} />,      colorCls: 'resting' },
    { key: 'EMERGENCY',   label: 'EMERGENCY',    value: summary?.emergency ?? '—',    icon: <AlertTriangle size={18} />, colorCls: 'emergency' },
  ];

  return (
    <div className="placeholder-page">
      {/* Page Header */}
      <div className="placeholder-hero">
        <div className="placeholder-info">
          <div className="module-meta-badge">
            <Users size={14} />
            <span>PERSONNEL MANAGEMENT & MOVEMENT TRACKING</span>
          </div>
          <h2>Polar Crew Registry & Geospatial Tracking</h2>
          <p>
            Manage expedition personnel, track field deployments, update GPS coordinates,
            and monitor movement history across Antarctic and Arctic stations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={loadAll} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'radar-sweep-icon' : ''} style={{ display: 'inline', marginRight: 4 }} />
            Refresh
          </button>
          {canAddPersonnel && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} style={{ display: 'inline', marginRight: 4 }} />
              Add Personnel
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="personnel-stats-grid">
        {/* Total card (non-filter) */}
        <div className="prs-stat-card" style={{ cursor: 'default' }}>
          <div className="prs-stat-icon"><Users size={18} /></div>
          <div className="prs-stat-body">
            <div className="prs-stat-value">{summary?.total_personnel ?? '—'}</div>
            <div className="prs-stat-label">Total Personnel</div>
          </div>
        </div>
        {statCards.map((sc) => (
          <div
            key={sc.key}
            className={`prs-stat-card status-${sc.colorCls} ${activeCard === sc.key ? 'active' : ''}`}
            onClick={() => handleCardClick(sc.key)}
          >
            <div className={`prs-stat-icon ${sc.colorCls}`}>{sc.icon}</div>
            <div className="prs-stat-body">
              <div className="prs-stat-value">{sc.value}</div>
              <div className="prs-stat-label">{sc.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Personnel Table Panel */}
      <div className="command-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <Users size={18} className="panel-title-icon" />
            <span className="panel-title">Expedition Personnel Roster</span>
          </div>
          <span className="mono-badge" style={{ color: 'var(--cyan-300)' }}>
            {personnel.length} RECORDS
          </span>
        </div>

        {/* Control Bar */}
        <div style={{ padding: '12px 16px 0' }}>
          <div className="prs-control-bar">
            <div className="prs-search-wrap">
              <Search size={14} />
              <input
                className="prs-search-input"
                placeholder="Search code, name, role, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="prs-filter-select"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setActiveCard(null); }}
            >
              <option value="ALL">All Statuses</option>
              {STATUS_VALUES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>

            <select
              className="prs-filter-select"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              {ROLE_VALUES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select
              className="prs-filter-select"
              value={filterExp}
              onChange={(e) => setFilterExp(e.target.value)}
            >
              <option value="ALL">All Expeditions</option>
              {expeditions.map((exp) => <option key={exp.id} value={exp.id}>{exp.name}</option>)}
            </select>
          </div>
        </div>

        <div className="panel-body">
          <div className="polar-table-wrapper">
            <table className="polar-table">
              <thead>
                <tr>
                  <th>Personnel ID &amp; Name</th>
                  <th>Role &amp; Team</th>
                  <th>Current Location</th>
                  <th>Expedition</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr className="prs-loading-row">
                    <td colSpan={7}>
                      <RefreshCw size={16} className="radar-sweep-icon" style={{ display: 'inline', marginRight: 8 }} />
                      Loading personnel roster from database…
                    </td>
                  </tr>
                )}

                {!isLoading && personnel.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="prs-empty-state">
                        <Users size={32} />
                        <p>No personnel found matching current filters.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && personnel.map((p) => {
                  const emer = isEmergency(p.status);
                  return (
                    <tr key={p.id} className={`prs-table-row ${emer ? 'is-emergency' : ''}`}>
                      <td>
                        <div className="prs-person-cell">
                          <span className={`prs-code-badge ${emer ? 'emergency' : ''}`}>
                            {p.personnel_code}
                          </span>
                          <div>
                            <div className="prs-person-name">{p.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="prs-person-role">{p.role}</div>
                        <span className="prs-dept-tag">{p.department}</span>
                      </td>
                      <td>
                        <div className="prs-location-cell">{p.current_location}</div>
                        <div className="prs-coords">{formatCoords(p.latitude, p.longitude)}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.expedition_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.last_updated || '—'}
                      </td>
                      <td>
                        <div className="prs-action-group">
                          <button className="prs-btn-view" onClick={() => setViewPersonId(p.id)} title="View details">
                            <Eye size={11} style={{ display: 'inline', marginRight: 3 }} /> View
                          </button>
                          {canUpdateLocation && (
                            <button className="prs-btn-loc" onClick={() => setLocUpdatePerson(p)} title="Update location">
                              <Navigation size={11} style={{ display: 'inline', marginRight: 3 }} /> Loc
                            </button>
                          )}
                          <button className="prs-btn-hist" onClick={() => setViewPersonId(p.id)} title="Movement history">
                            <History size={11} style={{ display: 'inline', marginRight: 3 }} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawers / Modals */}
      {viewPersonId && (
        <PersonnelDetailDrawer
          personId={viewPersonId}
          onClose={() => setViewPersonId(null)}
        />
      )}

      {locUpdatePerson && (
        <LocationUpdateModal
          person={locUpdatePerson}
          expeditions={expeditions}
          onClose={() => setLocUpdatePerson(null)}
          onSuccess={handleLocSuccess}
        />
      )}

      {showAddModal && (
        <AddPersonnelModal
          expeditions={expeditions}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
