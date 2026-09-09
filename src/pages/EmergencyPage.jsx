/**
 * POLAR-X — Emergency Response & SAR Operations Command Center (Task 7)
 * Full incident lifecycle management: REPORTED → ACKNOWLEDGED → TRIAGED →
 * DISPATCHED → IN_PROGRESS → RESOLVED / CANCELLED
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, RefreshCw, AlertTriangle, Radio, Zap,
  CheckCircle2, Activity, Users, Truck, MapPin, Clock,
  X, ChevronRight, Navigation, Send, Shield, Eye,
  List, Grid3x3, Filter, Search, Plus, FileText
} from 'lucide-react';
import { api } from '../services/api';
import '../styles/emergency.css';

// ─── Helper functions ──────────────────────────────────────────────────────

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATUS_ORDER = {
  IN_PROGRESS: 0, DISPATCHED: 1, REPORTED: 2, TRIAGED: 3,
  ACKNOWLEDGED: 4, RESOLVED: 5, CANCELLED: 6
};

function SeverityBadge({ severity }) {
  return <span className={`sev-badge ${severity}`}>{severity}</span>;
}

function IncidentStatusBadge({ status }) {
  const labels = {
    REPORTED: 'Reported',
    ACKNOWLEDGED: 'Acknowledged',
    TRIAGED: 'Triaged',
    DISPATCHED: 'Dispatched',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    CANCELLED: 'Cancelled'
  };
  return <span className={`inc-status-badge ${status}`}>{labels[status] || status}</span>;
}

function UnitStatusBadge({ status }) {
  return <span className={`unit-status-badge ${status}`}>{status?.replace('_', ' ')}</span>;
}

function IncidentTypeLabel({ type }) {
  const map = {
    MEDICAL: '🩺 Medical',
    MISSING_PERSON: '🔍 Missing Person',
    VEHICLE: '🚧 Vehicle',
    CARGO: '📦 Cargo',
    FIRE: '🔥 Fire',
    COMMUNICATION_LOSS: '📡 Comm Loss',
    WEATHER_ENVIRONMENTAL: '🌨 Weather',
    OTHER: '⚠ Other'
  };
  return <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>{map[type] || type}</span>;
}

function timelineClass(eventType) {
  const t = (eventType || '').toLowerCase();
  if (t.includes('created')) return 'created';
  if (t.includes('acknowledged')) return 'acknowledged';
  if (t.includes('triage')) return 'triaged';
  if (t.includes('dispatched') || t.includes('assigned')) return 'dispatched';
  if (t.includes('started')) return 'started';
  if (t.includes('resolved')) return 'resolved';
  if (t.includes('cancelled')) return 'cancelled';
  return 'created';
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ReportIncidentModal({ onClose, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    title: '', incident_type: 'MEDICAL', severity: 'HIGH',
    reported_by: '', description: '', location_name: '',
    latitude: '', longitude: ''
  });

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.reported_by.trim()) return;
    const payload = {
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };
    onSubmit(payload);
  };

  return (
    <div className="sar-modal-overlay">
      <div className="sar-modal">
        <div className="sar-modal-header">
          <h3><AlertTriangle size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--hazard-red)' }} />Report New Incident</h3>
          <button className="drawer-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sar-modal-body">
            <div className="form-field">
              <label className="form-label">Incident Title *</label>
              <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Brief, clear title" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-field">
                <label className="form-label">Type</label>
                <select className="form-select" name="incident_type" value={form.incident_type} onChange={handleChange}>
                  {['MEDICAL','MISSING_PERSON','VEHICLE','CARGO','FIRE','COMMUNICATION_LOSS','WEATHER_ENVIRONMENTAL','OTHER'].map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Severity</label>
                <select className="form-select" name="severity" value={form.severity} onChange={handleChange}>
                  {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Reported By *</label>
              <input className="form-input" name="reported_by" value={form.reported_by} onChange={handleChange} placeholder="Name or system source" required />
            </div>
            <div className="form-field">
              <label className="form-label">Location Name</label>
              <input className="form-input" name="location_name" value={form.location_name} onChange={handleChange} placeholder="e.g., Schirmacher Glacier Sector 4" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-field">
                <label className="form-label">Latitude (optional)</label>
                <input className="form-input" name="latitude" type="number" step="any" value={form.latitude} onChange={handleChange} placeholder="-70.7670" />
              </div>
              <div className="form-field">
                <label className="form-label">Longitude (optional)</label>
                <input className="form-input" name="longitude" type="number" step="any" value={form.longitude} onChange={handleChange} placeholder="11.7400" />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Describe the emergency situation in detail..." />
            </div>
          </div>
          <div className="sar-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <><RefreshCw size={14} className="spin-icon" /> Submitting...</> : <><Send size={14} /> Report Incident</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TriageModal({ incident, onClose, onSubmit, isLoading }) {
  const [severity, setSeverity] = useState(incident?.severity || 'HIGH');
  const [notes, setNotes] = useState('');
  return (
    <div className="sar-modal-overlay">
      <div className="sar-modal">
        <div className="sar-modal-header">
          <h3><Shield size={16} style={{ display: 'inline', marginRight: 6, color: '#c4b5fd' }} />Triage — {incident?.incident_code}</h3>
          <button className="drawer-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="sar-modal-body">
          <div className="form-field">
            <label className="form-label">Update Severity Assessment</label>
            <select className="form-select" value={severity} onChange={e => setSeverity(e.target.value)}>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Triage Notes</label>
            <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Document triage assessment and clinical reasoning..." />
          </div>
        </div>
        <div className="sar-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ background: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.4)', color: '#c4b5fd' }} onClick={() => onSubmit({ severity, notes: notes || undefined })} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Confirm Triage'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolveModal({ incident, onClose, onSubmit, isLoading }) {
  const [notes, setNotes] = useState('');
  const [unitNextStatus, setUnitNextStatus] = useState('AVAILABLE');
  return (
    <div className="sar-modal-overlay">
      <div className="sar-modal">
        <div className="sar-modal-header">
          <h3><CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6, color: '#34d399' }} />Resolve — {incident?.incident_code}</h3>
          <button className="drawer-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="sar-modal-body">
          <div className="form-field">
            <label className="form-label">Resolution Notes *</label>
            <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Document how the incident was resolved, personnel status, and any follow-up required..." required />
          </div>
          {incident?.assigned_unit_id && (
            <div className="form-field">
              <label className="form-label">Response Unit Next Status</label>
              <select className="form-select" value={unitNextStatus} onChange={e => setUnitNextStatus(e.target.value)}>
                <option value="AVAILABLE">AVAILABLE (Return to base)</option>
                <option value="RETURNING">RETURNING (In transit back)</option>
              </select>
            </div>
          )}
        </div>
        <div className="sar-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}
            onClick={() => onSubmit({ resolution_notes: notes, unit_next_status: unitNextStatus })}
            disabled={!notes.trim() || isLoading}
          >
            {isLoading ? 'Resolving...' : 'Resolve Incident'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Incident Detail Drawer ─────────────────────────────────────────────────

function IncidentDetailDrawer({ incidentId, onClose, onRefresh, responseUnits }) {
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'triage' | 'resolve'
  const [selectedUnitId, setSelectedUnitId] = useState(null);

  const load = useCallback(async () => {
    if (!incidentId) return;
    setIsLoading(true);
    setError('');
    const [d, h] = await Promise.all([
      api.getIncidentById(incidentId),
      api.getIncidentHistory(incidentId)
    ]);
    if (d) { setDetail(d); setSelectedUnitId(d.assigned_unit_id || null); }
    else setError('Failed to load incident details.');
    setHistory(Array.isArray(h) ? h : []);
    setIsLoading(false);
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setIsActing(true);
    setError('');
    try { await fn(); await load(); onRefresh(); }
    catch (e) { setError(e.message || 'Action failed.'); }
    finally { setIsActing(false); }
  };

  const handleAcknowledge = () => act(() => api.acknowledgeIncident(incidentId, { actor: 'Operations Commander' }));
  const handleDispatch = () => act(() => api.dispatchIncident(incidentId, { actor: 'SAR Dispatcher' }));
  const handleStart = () => act(() => api.startIncident(incidentId, { actor: 'Field Team Lead' }));
  const handleCancel = () => {
    if (!window.confirm('Cancel this incident? This cannot be undone.')) return;
    act(() => api.cancelIncident(incidentId, { actor: 'Operations Commander', notes: 'Cancelled by operator.' }));
  };
  const handleAssignUnit = () => {
    if (!selectedUnitId) return;
    act(() => api.assignIncidentUnit(incidentId, { response_unit_id: selectedUnitId, actor: 'SAR Dispatch Controller' }));
  };

  const isTerminal = detail && ['RESOLVED','CANCELLED'].includes(detail.status);

  if (isLoading) return (
    <>
      <div className="incident-drawer-overlay" onClick={onClose} />
      <div className="incident-drawer">
        <div className="drawer-header"><div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading incident...</div></div>
      </div>
    </>
  );

  return (
    <>
      <div className="incident-drawer-overlay" onClick={onClose} />
      <div className="incident-drawer">
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-top">
            <span className="drawer-inc-code">{detail?.incident_code}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <SeverityBadge severity={detail?.severity} />
              <IncidentStatusBadge status={detail?.status} />
            </div>
            <button className="drawer-close-btn" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="drawer-title">{detail?.title}</div>
          <div className="drawer-meta-row">
            <IncidentTypeLabel type={detail?.incident_type} />
            {detail?.location_name && (
              <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} />{detail.location_name}
              </span>
            )}
            <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />{detail?.created_at}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 22px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', gap: 2 }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'units', label: 'Response Units' },
            { key: 'timeline', label: 'Timeline' }
          ].map(t => (
            <button key={t.key} className={`drawer-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="drawer-body">
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          {tab === 'overview' && detail && (
            <>
              {/* Core Info */}
              <div>
                <div className="drawer-section-title"><FileText size={12} />Incident Details</div>
                <div className="drawer-info-grid">
                  <div className="drawer-info-item">
                    <span className="drawer-info-label">Reported By</span>
                    <span className="drawer-info-value">{detail.reported_by || '—'}</span>
                  </div>
                  <div className="drawer-info-item">
                    <span className="drawer-info-label">Affected Personnel</span>
                    <span className="drawer-info-value">{detail.personnel_name ? `${detail.personnel_name} (${detail.personnel_code})` : '—'}</span>
                  </div>
                  <div className="drawer-info-item">
                    <span className="drawer-info-label">Coordinates</span>
                    <span className="drawer-info-value" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {detail.latitude != null ? `${detail.latitude.toFixed(4)}°, ${detail.longitude?.toFixed(4)}°` : '—'}
                    </span>
                  </div>
                  <div className="drawer-info-item">
                    <span className="drawer-info-label">Assigned Unit</span>
                    <span className="drawer-info-value">{detail.assigned_unit_code ? `${detail.assigned_unit_code} — ${detail.assigned_unit_name}` : 'Unassigned'}</span>
                  </div>
                  {detail.acknowledged_at && <div className="drawer-info-item">
                    <span className="drawer-info-label">Acknowledged</span>
                    <span className="drawer-info-value">{detail.acknowledged_at}</span>
                  </div>}
                  {detail.dispatched_at && <div className="drawer-info-item">
                    <span className="drawer-info-label">Dispatched</span>
                    <span className="drawer-info-value">{detail.dispatched_at}</span>
                  </div>}
                  {detail.resolved_at && <div className="drawer-info-item">
                    <span className="drawer-info-label">Resolved</span>
                    <span className="drawer-info-value">{detail.resolved_at}</span>
                  </div>}
                </div>
              </div>
              {detail.description && (
                <div>
                  <div className="drawer-section-title"><FileText size={12} />Description</div>
                  <div className="drawer-description">{detail.description}</div>
                </div>
              )}
              {detail.resolution_notes && (
                <div>
                  <div className="drawer-section-title"><CheckCircle2 size={12} />Resolution Notes</div>
                  <div className="drawer-description" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>{detail.resolution_notes}</div>
                </div>
              )}
            </>
          )}

          {tab === 'units' && (
            <>
              {/* Assign unit */}
              {!isTerminal && (
                <div>
                  <div className="drawer-section-title"><Send size={12} />Assign Response Unit</div>
                  <div className="assign-unit-select-list">
                    {(responseUnits || []).slice(0, 8).map(u => (
                      <div
                        key={u.id}
                        className={`assign-unit-option ${selectedUnitId === u.id ? 'selected' : ''}`}
                        onClick={() => setSelectedUnitId(selectedUnitId === u.id ? null : u.id)}
                      >
                        <div className="unit-left">
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                            <span className="rec-unit-code">{u.unit_code}</span>
                            <UnitStatusBadge status={u.status} />
                          </div>
                          <div className="rec-unit-name">{u.name}</div>
                          <div className="rec-unit-reason">{u.capabilities?.slice(0, 60)}{(u.capabilities?.length > 60) ? '…' : ''}</div>
                        </div>
                        {selectedUnitId === u.id && <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-sar btn-sar-dispatch"
                    style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                    onClick={handleAssignUnit}
                    disabled={!selectedUnitId || isActing}
                  >
                    <Send size={13} />Assign Selected Unit
                  </button>
                </div>
              )}

              {/* Recommendations */}
              {detail?.recommended_units?.length > 0 && (
                <div>
                  <div className="drawer-section-title"><Navigation size={12} />AI-Ranked Recommendations</div>
                  <div className="recommended-units-list">
                    {detail.recommended_units.slice(0, 5).map((rec, i) => (
                      <div
                        key={rec.unit.id}
                        className={`rec-unit-card ${i === 0 ? 'best-match' : ''}`}
                        onClick={() => !isTerminal && setSelectedUnitId(rec.unit.id)}
                      >
                        <div className="rec-unit-info">
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="rec-unit-code">{rec.unit.unit_code}</span>
                            <UnitStatusBadge status={rec.unit.status} />
                            {i === 0 && <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>★ BEST MATCH</span>}
                          </div>
                          <div className="rec-unit-name">{rec.unit.name}</div>
                          <div className="rec-unit-reason">{rec.reason}</div>
                        </div>
                        <div className="rec-unit-dist">
                          {rec.distance_km < 99990 ? `${rec.distance_km.toFixed(0)} km` : '—'}
                          {rec.capability_match && <div style={{ color: '#34d399', fontSize: '0.68rem', marginTop: 2 }}>Cap. match</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'timeline' && (
            <div>
              <div className="drawer-section-title"><Activity size={12} />Incident Audit Timeline</div>
              {history.length === 0 ? (
                <div className="sar-empty-state"><Clock size={32} /><p>No audit events found.</p></div>
              ) : (
                <div className="event-timeline">
                  {history.map(ev => (
                    <div key={ev.id} className="timeline-event">
                      <div className={`timeline-dot ${timelineClass(ev.event_type)}`}>
                        <Activity size={10} />
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-event-type">{ev.event_type.replace(/_/g, ' ')}</div>
                        {ev.notes && <div className="timeline-notes">{ev.notes}</div>}
                        <div className="timeline-meta">
                          <span className="timeline-actor">{ev.actor}</span>
                          <span>•</span>
                          <span>{ev.timestamp}</span>
                          {ev.previous_status && ev.new_status && (
                            <><span>•</span><span>{ev.previous_status} → {ev.new_status}</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Bar */}
        {!isTerminal && (
          <div className="drawer-action-bar">
            {detail?.status === 'REPORTED' && (
              <button className="btn-sar btn-sar-acknowledge" onClick={handleAcknowledge} disabled={isActing}>
                <Radio size={13} />Acknowledge
              </button>
            )}
            {['REPORTED','ACKNOWLEDGED','TRIAGED'].includes(detail?.status) && (
              <button className="btn-sar btn-sar-triage" onClick={() => setModal('triage')} disabled={isActing}>
                <Shield size={13} />Triage
              </button>
            )}
            {detail?.assigned_unit_id && ['REPORTED','ACKNOWLEDGED','TRIAGED'].includes(detail?.status) && (
              <button className="btn-sar btn-sar-dispatch" onClick={handleDispatch} disabled={isActing}>
                <Send size={13} />Dispatch
              </button>
            )}
            {detail?.status === 'DISPATCHED' && (
              <button className="btn-sar btn-sar-start" onClick={handleStart} disabled={isActing}>
                <Activity size={13} />Start Mission
              </button>
            )}
            {['REPORTED','ACKNOWLEDGED','TRIAGED','DISPATCHED','IN_PROGRESS'].includes(detail?.status) && (
              <button className="btn-sar btn-sar-resolve" onClick={() => setModal('resolve')} disabled={isActing}>
                <CheckCircle2 size={13} />Resolve
              </button>
            )}
            <button className="btn-sar btn-sar-cancel" onClick={handleCancel} disabled={isActing} style={{ marginLeft: 'auto' }}>
              <X size={13} />Cancel
            </button>
          </div>
        )}
      </div>

      {/* Sub-modals */}
      {modal === 'triage' && (
        <TriageModal
          incident={detail}
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            await act(() => api.triageIncident(incidentId, body));
            setModal(null);
          }}
          isLoading={isActing}
        />
      )}
      {modal === 'resolve' && (
        <ResolveModal
          incident={detail}
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            await act(() => api.resolveIncident(incidentId, body));
            setModal(null);
          }}
          isLoading={isActing}
        />
      )}
    </>
  );
}

// ─── Main EmergencyPage ──────────────────────────────────────────────────────

export default function EmergencyPage({ onSelectAlert, onAlertStateChange }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [responseUnits, setResponseUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [view, setView] = useState('incidents'); // 'incidents' | 'fleet'
  const [showReportModal, setShowReportModal] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    search: '', status: 'ALL', severity: 'ALL', incident_type: 'ALL', is_active: null
  });

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    const [incs, s, units] = await Promise.all([
      api.getIncidents({
        status: filters.status !== 'ALL' ? filters.status : undefined,
        severity: filters.severity !== 'ALL' ? filters.severity : undefined,
        incident_type: filters.incident_type !== 'ALL' ? filters.incident_type : undefined,
        is_active: filters.is_active,
        search: filters.search || undefined
      }),
      api.getIncidentSummary(),
      api.getResponseUnits()
    ]);
    if (incs) setIncidents(incs);
    if (s) setStats(s);
    if (units) setResponseUnits(units);
    setIsLoading(false);
  }, [filters]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleReportIncident = async (payload) => {
    setIsSubmitting(true);
    setError('');
    try {
      await api.createIncident(payload);
      setShowReportModal(false);
      await loadAll();
      if (onAlertStateChange) onAlertStateChange();
    } catch (e) {
      setError(e.message || 'Failed to report incident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI data
  const kpiCards = [
    { label: 'Total Incidents', value: stats?.total_incidents ?? '—', cls: 'total' },
    { label: 'Active Incidents', value: stats?.active_incidents ?? '—', cls: 'active' },
    { label: 'Critical Active', value: stats?.critical_count ?? '—', cls: 'critical' },
    { label: 'High Severity', value: stats?.high_count ?? '—', cls: 'high' },
    { label: 'Units Available', value: stats ? `${stats.units_available}/${stats.units_total}` : '—', cls: 'units' },
    { label: 'Resolved', value: stats?.resolved_count ?? '—', cls: 'resolved' },
  ];

  return (
    <div className="emergency-page">
      {/* Hero Header */}
      <div className="emergency-hero">
        <div className="emergency-hero-info">
          <div className="module-meta-badge" style={{ borderColor: 'var(--hazard-red)', color: 'var(--hazard-red)', background: 'var(--hazard-red-bg)' }}>
            <ShieldAlert size={14} />
            <span>EMERGENCY RESPONSE & SAR OPERATIONS — TASK 7</span>
          </div>
          <h2>Antarctic Polar SAR Command Center</h2>
          <p>Full incident lifecycle management from distress beacon to resolution. Triage, assign response units, dispatch, track, and resolve polar emergencies.</p>
        </div>
        <div className="emergency-hero-actions">
          <button className="btn-secondary" onClick={loadAll} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} style={{ display: 'inline', marginRight: 4 }} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowReportModal(true)}>
            <Plus size={14} style={{ display: 'inline', marginRight: 4 }} />
            Report Incident
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: '#f87171', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="sar-kpi-grid">
        {kpiCards.map(k => (
          <div key={k.label} className={`sar-kpi-card ${k.cls}`}>
            <div className="sar-kpi-label">{k.label}</div>
            <div className="sar-kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className={view === 'incidents' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          onClick={() => setView('incidents')}
        >
          <List size={14} style={{ display: 'inline', marginRight: 4 }} />Incidents
        </button>
        <button
          className={view === 'fleet' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          onClick={() => setView('fleet')}
        >
          <Grid3x3 size={14} style={{ display: 'inline', marginRight: 4 }} />Response Fleet
        </button>
        <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginLeft: 4 }}>
          {view === 'incidents' ? `${incidents.length} incidents` : `${responseUnits.length} units`}
        </span>
      </div>

      {/* Incidents View */}
      {view === 'incidents' && (
        <div className="command-panel">
          {/* Filter Bar */}
          <div className="sar-filter-bar">
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              className="search-input"
              placeholder="Search by code, title, location, reporter..."
              value={filters.search}
              onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
            />
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
              <option value="ALL">All Statuses</option>
              {['REPORTED','ACKNOWLEDGED','TRIAGED','DISPATCHED','IN_PROGRESS','RESOLVED','CANCELLED'].map(s =>
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              )}
            </select>
            <select value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}>
              <option value="ALL">All Severities</option>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.incident_type} onChange={e => setFilters(p => ({ ...p, incident_type: e.target.value }))}>
              <option value="ALL">All Types</option>
              {['MEDICAL','MISSING_PERSON','VEHICLE','CARGO','FIRE','COMMUNICATION_LOSS','WEATHER_ENVIRONMENTAL','OTHER'].map(t =>
                <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
              )}
            </select>
            <select
              value={filters.is_active === null ? 'ALL' : filters.is_active ? 'ACTIVE' : 'CLOSED'}
              onChange={e => setFilters(p => ({
                ...p,
                is_active: e.target.value === 'ALL' ? null : e.target.value === 'ACTIVE'
              }))}
            >
              <option value="ALL">All States</option>
              <option value="ACTIVE">Active Only</option>
              <option value="CLOSED">Closed Only</option>
            </select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="sar-empty-state"><RefreshCw size={28} className="spin-icon" /><p>Loading incidents...</p></div>
          ) : incidents.length === 0 ? (
            <div className="sar-empty-state"><ShieldAlert size={36} /><p>No incidents found matching current filters.</p></div>
          ) : (
            <div className="incident-table-wrapper">
              <table className="incident-table">
                <thead>
                  <tr>
                    <th>Incident Code</th>
                    <th>Title / Location</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Assigned Unit</th>
                    <th>Reported</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map(inc => (
                    <tr
                      key={inc.id}
                      className={`incident-row ${selectedIncidentId === inc.id ? 'selected-row' : ''}`}
                      onClick={() => setSelectedIncidentId(inc.id)}
                    >
                      <td><span className="incident-code-chip">{inc.incident_code}</span></td>
                      <td>
                        <div className="incident-title-cell">
                          <div className="title-text">{inc.title}</div>
                          {inc.location_name && <div className="sub-text"><MapPin size={9} style={{ display: 'inline' }} /> {inc.location_name}</div>}
                        </div>
                      </td>
                      <td><IncidentTypeLabel type={inc.incident_type} /></td>
                      <td><SeverityBadge severity={inc.severity} /></td>
                      <td><IncidentStatusBadge status={inc.status} /></td>
                      <td>
                        {inc.assigned_unit_code ? (
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#60a5fa' }}>{inc.assigned_unit_code}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{inc.created_at}</td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedIncidentId(inc.id); }}
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Response Fleet View */}
      {view === 'fleet' && (
        <div className="command-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Truck size={16} style={{ color: 'var(--accent-blue)' }} />
              <span className="panel-title">SAR Response Unit Fleet</span>
            </div>
            <span className="mono-badge">
              {responseUnits.filter(u => u.status === 'AVAILABLE').length} AVAILABLE
            </span>
          </div>
          <div className="panel-body">
            {isLoading ? (
              <div className="sar-empty-state"><RefreshCw size={28} className="spin-icon" /><p>Loading fleet...</p></div>
            ) : responseUnits.length === 0 ? (
              <div className="sar-empty-state"><Truck size={36} /><p>No response units found.</p></div>
            ) : (
              <div className="unit-fleet-grid">
                {responseUnits.map(u => (
                  <div key={u.id} className={`unit-fleet-card ${u.status}`}>
                    <div className="unit-fleet-header">
                      <span className="unit-fleet-code">{u.unit_code}</span>
                      <UnitStatusBadge status={u.status} />
                    </div>
                    <div className="unit-fleet-name">{u.name}</div>
                    <div className="unit-fleet-team">{u.team}</div>
                    {u.capabilities && <div className="unit-fleet-caps">{u.capabilities}</div>}
                    <div className="unit-fleet-location">
                      <MapPin size={11} />
                      <span>{u.current_location}</span>
                    </div>
                    {u.active_incident_code && (
                      <div className="unit-fleet-incident">
                        <Zap size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {u.active_incident_code}
                      </div>
                    )}
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                      {u.latitude?.toFixed(4)}°, {u.longitude?.toFixed(4)}°
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incident Detail Drawer */}
      {selectedIncidentId && (
        <IncidentDetailDrawer
          incidentId={selectedIncidentId}
          onClose={() => setSelectedIncidentId(null)}
          onRefresh={() => {
            loadAll();
            if (onAlertStateChange) onAlertStateChange();
          }}
          responseUnits={responseUnits}
        />
      )}

      {/* Report Incident Modal */}
      {showReportModal && (
        <ReportIncidentModal
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReportIncident}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
