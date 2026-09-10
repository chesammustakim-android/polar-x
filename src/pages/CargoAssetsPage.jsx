import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Truck, Package, CheckCircle2, AlertTriangle, Clock,
  Search, Filter, Plus, X, ChevronRight, MapPin, RefreshCw,
  Download, QrCode, Eye, Edit3, ArrowRight, Warehouse, Ship,
  Anchor, Navigation, Home, Info, History, Loader
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';

// ─── Helper: Cargo Status Badge ──────────────────────────────────────────────
function CargoStatusBadge({ status }) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '-');
  const cls = {
    'preparing':  'status-preparing',
    'in-transit': 'status-in-transit',
    'at-port':    'status-at-port',
    'loaded':     'status-loaded',
    'delivered':  'status-delivered',
    'delayed':    'status-delayed',
  }[key] || 'status-preparing';

  return (
    <span className={`cargo-status-badge ${cls}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

// ─── Helper: Priority Badge ───────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const key = (priority || '').toLowerCase();
  return (
    <span className={`cargo-priority-badge priority-${key}`}>
      {priority}
    </span>
  );
}

// ─── Shipment Stage Timeline ──────────────────────────────────────────────────
const STAGES = [
  { key: 'Warehouse',        label: 'Warehouse',        icon: Warehouse,  sub: 'Origin depot / staging area' },
  { key: 'Port',             label: 'Port',             icon: Anchor,     sub: 'Sea port clearance & loading' },
  { key: 'Ship',             label: 'Ship / Transit',   icon: Ship,       sub: 'Active sea / air / land transit' },
  { key: 'Antarctica',       label: 'Antarctica',       icon: Navigation, sub: 'Arrived at ice shelf / traverse' },
  { key: 'Research Station', label: 'Research Station', icon: Home,       sub: 'Final delivery point' },
];

function ShipmentTimeline({ stage }) {
  const stageIdx = STAGES.findIndex(s => s.key === stage);
  return (
    <div className="shipment-timeline">
      <div className="timeline-section-label">
        <ChevronRight size={12} /> Shipment Progress
      </div>
      {STAGES.map((s, i) => {
        const StageIcon = s.icon;
        let state = i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'future';
        return (
          <div className="timeline-step" key={s.key}>
            <div className="timeline-step-line">
              <div className={`timeline-dot ${state}`}>
                {state === 'done' ? <CheckCircle2 size={13} /> : <StageIcon size={13} />}
              </div>
              {i < STAGES.length - 1 && (
                <div className={`timeline-connector ${state === 'done' ? 'done-line' : ''}`} />
              )}
            </div>
            <div className="timeline-step-content">
              <div className={`timeline-step-name ${state}`}>{s.label}</div>
              <div className="timeline-step-sub">{s.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Movement History ─────────────────────────────────────────────────────────
function MovementHistory({ movements }) {
  if (!movements || movements.length === 0) {
    return (
      <div className="cargo-empty-state" style={{ padding: '28px 16px' }}>
        <div className="cargo-empty-icon" style={{ width: 40, height: 40 }}>
          <History size={18} />
        </div>
        <p style={{ fontSize: 12, marginTop: 8 }}>No movement records yet.</p>
      </div>
    );
  }
  return (
    <div className="movement-history-list">
      {movements.map((m, i) => (
        <div className="movement-entry" key={m.id}>
          <div className="movement-entry-line">
            <div className={`movement-entry-dot ${i === 0 ? 'latest' : ''}`} />
            {i < movements.length - 1 && <div className="movement-entry-connector" />}
          </div>
          <div className="movement-entry-content">
            <div className="movement-entry-header">
              <CargoStatusBadge status={m.status} />
              <span className="movement-timestamp">{m.timestamp}</span>
            </div>
            <div className="movement-location">
              <MapPin size={11} />
              {m.location}
            </div>
            {m.notes && <div className="movement-notes">{m.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── QR Code Panel ────────────────────────────────────────────────────────────
function QRPanel({ cargoId }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.getCargoQRData(cargoId).then(d => {
      setQrData(d);
      setLoading(false);
    });
  }, [cargoId]);

  const handleDownload = () => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POLARX_${qrData?.cargo_code || cargoId}_QR.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="cargo-loading">
        <Loader size={18} />
        Generating QR data…
      </div>
    );
  }

  if (!qrData) {
    return <div className="cargo-empty-state"><p>Failed to load QR data.</p></div>;
  }

  return (
    <div className="cargo-qr-section">
      <div className="cargo-qr-card">
        <div className="cargo-qr-meta">
          <div className="cargo-qr-cargo-id">{qrData.cargo_code}</div>
          <div className="cargo-qr-cargo-name">{qrData.name}</div>
        </div>
        <div className="cargo-qr-canvas-wrap" ref={svgRef}>
          <QRCodeSVG
            value={qrData.qr_payload}
            size={200}
            level="H"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#060a12"
          />
        </div>
        <div className="cargo-qr-payload-box">
          {qrData.qr_payload}
        </div>
      </div>
      <div className="cargo-qr-actions">
        <button className="btn-secondary" onClick={handleDownload}>
          <Download size={13} />
          Download QR (SVG)
        </button>
        <button className="btn-secondary" onClick={() => window.print()}>
          Print QR
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
        Scan this QR code to retrieve full cargo manifest, status, and tracking history in POLAR-X.
      </div>
    </div>
  );
}

// ─── Status Update Form ───────────────────────────────────────────────────────
function StatusUpdateForm({ cargo, onUpdated }) {
  const [form, setForm] = useState({
    status: cargo.status || 'Preparing',
    current_location: cargo.current_location || '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const STATUSES = ['Preparing', 'In Transit', 'At Port', 'Loaded', 'Delivered', 'Delayed'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.addCargoMovement(cargo.id, {
        status: form.status,
        location: form.current_location,
        notes: form.notes || `Status updated to ${form.status} at ${form.current_location}`,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onUpdated();
      }, 1200);
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cargo-update-form">
      <div className="cargo-update-form-title">
        <Edit3 size={12} style={{ display: 'inline', marginRight: 6 }} />
        Update Cargo Status
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
        <span>Current:</span>
        <CargoStatusBadge status={cargo.status} />
        <ArrowRight size={12} />
        <span>New:</span>
        <CargoStatusBadge status={form.status} />
      </div>

      <div className="cargo-form-row">
        <div className="cargo-form-field">
          <label className="cargo-form-label">New Status *</label>
          <select
            className="cargo-form-select"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
            required
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="cargo-form-field">
          <label className="cargo-form-label">Current Location *</label>
          <input
            className="cargo-form-input"
            type="text"
            placeholder="e.g. Kochi Port Berth 2"
            value={form.current_location}
            onChange={e => setForm({ ...form, current_location: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="cargo-form-field">
        <label className="cargo-form-label">Notes (optional)</label>
        <textarea
          className="cargo-form-textarea"
          placeholder="Add a note about this status change…"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className="cargo-form-actions">
        {success ? (
          <span style={{ color: 'var(--hazard-green)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> Saved successfully!
          </span>
        ) : (
          <button type="submit" className="btn-success" disabled={saving}>
            {saving ? <Loader size={13} /> : <CheckCircle2 size={13} />}
            {saving ? 'Saving…' : 'Save Update & Record Movement'}
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Cargo Detail Panel ───────────────────────────────────────────────────────
function CargoDetailPanel({ cargoId, onClose, onRefreshList }) {
  const [detail, setDetail] = useState(null);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        api.getCargoById(cargoId),
        api.getCargoHistory(cargoId),
      ]);
      setDetail(d);
      setMovements(m || []);
    } catch (err) {
      console.error('Failed to load cargo detail', err);
    } finally {
      setLoading(false);
    }
  }, [cargoId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const TABS = [
    { key: 'overview',  label: 'Overview',  icon: Info },
    { key: 'timeline',  label: 'Timeline',  icon: Truck },
    { key: 'history',   label: 'Movement',  icon: History },
    { key: 'update',    label: 'Update',    icon: Edit3 },
    { key: 'qr',        label: 'QR Code',   icon: QrCode },
  ];

  return (
    <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-detail-panel">
        {/* Top Bar */}
        <div className="cargo-detail-topbar">
          <div className="cargo-detail-topbar-left">
            <span className="cargo-code-tag">{detail?.cargo_code || '…'}</span>
            <h3>{detail?.name || 'Loading…'}</h3>
          </div>
          <button className="cargo-detail-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="cargo-detail-tabs">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                className={`cargo-detail-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="cargo-detail-body">
          {loading ? (
            <div className="cargo-loading">
              <Loader size={18} /> Loading cargo details…
            </div>
          ) : !detail ? (
            <div className="cargo-empty-state">
              <p>Failed to load cargo details.</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <CargoStatusBadge status={detail.status} />
                      <PriorityBadge priority={detail.priority} />
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      Updated: {detail.last_updated}
                    </div>
                  </div>

                  <div className="cargo-info-grid">
                    {[
                      { label: 'Cargo Code',      value: detail.cargo_code, hi: true },
                      { label: 'Category',         value: detail.category },
                      { label: 'Weight',           value: detail.weight, hi: true },
                      { label: 'Transit Mode',     value: detail.transit_mode },
                      { label: 'Origin',           value: detail.origin },
                      { label: 'Destination',      value: detail.destination, hi: true },
                      { label: 'Current Location', value: detail.current_location, hi: true },
                      { label: 'ETA',              value: detail.eta },
                      { label: 'Temperature Log',  value: detail.temperature_log },
                      { label: 'RFID Tag',         value: detail.rfid_tag || 'Not assigned' },
                      { label: 'Expedition',       value: detail.expedition_name || 'General Polar Inventory' },
                      { label: 'Stage',            value: detail.stage },
                    ].map(item => (
                      <div className="cargo-info-item" key={item.label}>
                        <span className="cargo-info-label">{item.label}</span>
                        <span className={`cargo-info-value ${item.hi ? 'highlight' : ''}`}>
                          {item.value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {detail.notes && (
                    <div className="cargo-info-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="cargo-info-label">Notes</span>
                      <span className="cargo-info-value" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                        {detail.notes}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <ShipmentTimeline stage={detail.stage} />
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <>
                  <div className="panel-section-header">
                    <History size={12} />
                    Movement Log ({movements.length} entries)
                  </div>
                  <MovementHistory movements={movements} />
                </>
              )}

              {/* UPDATE TAB */}
              {activeTab === 'update' && (
                <StatusUpdateForm
                  cargo={detail}
                  onUpdated={() => {
                    loadDetail();
                    onRefreshList();
                  }}
                />
              )}

              {/* QR TAB */}
              {activeTab === 'qr' && (
                <>
                  <div className="panel-section-header">
                    <QrCode size={12} />
                    QR Code — {detail.cargo_code}
                  </div>
                  <QRPanel cargoId={detail.id} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Cargo Modal ──────────────────────────────────────────────────────────
function AddCargoModal({ onClose, onCreated }) {
  const generateCode = () => `CRG-${Math.floor(100 + Math.random() * 900)}`;
  const [form, setForm] = useState({
    cargo_code: generateCode(),
    name: '',
    category: 'Scientific Instruments',
    weight: '1.0 Tons',
    origin: 'Goa HQ, India',
    destination: 'Maitri Station',
    status: 'Preparing',
    priority: 'Medium',
    transit_mode: 'Vessel',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const CATEGORIES = [
    'Scientific Instruments', 'Power Equipment', 'Medical Supplies', 'Life Support',
    'Machinery Spares', 'Hazardous / Fuel', 'Comms & Telemetry', 'Aviation & Robotics', 'General Supply',
  ];
  const STATUSES   = ['Preparing', 'In Transit', 'At Port', 'Loaded', 'Delivered', 'Delayed'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  const TRANSIT_MODES = ['Vessel', 'PistenBully Sled', 'Airbridge Cargo', 'Convoy', 'ORV Vessel', 'Coastal Tender'];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createCargo(form);
      onCreated();
      onClose();
    } catch (err) {
      alert(`Failed to register cargo: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cargo-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-modal">
        <div className="cargo-modal-header">
          <div className="cargo-modal-header-left">
            <div className="cargo-modal-icon">
              <Package size={18} />
            </div>
            <div>
              <h3>Register New Cargo</h3>
              <p>Add a new polar expedition cargo item to POLAR-X</p>
            </div>
          </div>
          <button className="cargo-detail-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cargo-modal-body">
            <div className="cargo-modal-grid">
              {/* Cargo Code */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Cargo Code *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="cargo-form-input"
                    type="text"
                    value={form.cargo_code}
                    onChange={e => set('cargo_code', e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-icon-only"
                    onClick={() => set('cargo_code', generateCode())}
                    title="Generate new code"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Cargo Name */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Cargo Name *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Glaciology Sensor Array"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>

              {/* Category */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Category *</label>
                <select className="cargo-form-select" value={form.category} onChange={e => set('category', e.target.value)} required>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Weight */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Weight</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. 2.4 Tons"
                  value={form.weight}
                  onChange={e => set('weight', e.target.value)}
                />
              </div>

              {/* Origin */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Origin *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Goa HQ, India"
                  value={form.origin}
                  onChange={e => set('origin', e.target.value)}
                  required
                />
              </div>

              {/* Destination */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Destination *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Maitri Station"
                  value={form.destination}
                  onChange={e => set('destination', e.target.value)}
                  required
                />
              </div>

              {/* Priority */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Priority</label>
                <select className="cargo-form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {/* Transit Mode */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Transit Mode</label>
                <select className="cargo-form-select" value={form.transit_mode} onChange={e => set('transit_mode', e.target.value)}>
                  {TRANSIT_MODES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Initial Status */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Initial Status</label>
                <select className="cargo-form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Notes (optional)</label>
                <textarea
                  className="cargo-form-textarea"
                  placeholder="Additional notes about this cargo item…"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="cargo-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              <X size={13} />
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader size={13} /> : <Plus size={13} />}
              {saving ? 'Registering…' : 'Register Cargo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main: CargoAssetsPage ────────────────────────────────────────────────────
export default function CargoAssetsPage({ initialExpeditionId, initialCargoId, onSelectCargo }) {
  const [cargoList, setCargoList]       = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterExpId, setFilterExpId]   = useState(initialExpeditionId || null);
  const [selectedCargoId, setSelectedCargoId] = useState(initialCargoId || null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeStatFilter, setActiveStatFilter] = useState(null);

  const STATUSES   = ['ALL', 'Preparing', 'In Transit', 'At Port', 'Loaded', 'Delivered', 'Delayed'];
  const PRIORITIES = ['ALL', 'Low', 'Medium', 'High', 'Critical'];

  const loadCargo = useCallback(async () => {
    setLoading(true);
    try {
      const [list, statData] = await Promise.all([
        api.getCargo({
          status:        filterStatus   !== 'ALL' ? filterStatus   : undefined,
          priority:      filterPriority !== 'ALL' ? filterPriority : undefined,
          search:        search || undefined,
          expedition_id: filterExpId || undefined,
        }),
        api.getCargoStats(),
      ]);
      setCargoList(list || []);
      setStats(statData);
    } catch (err) {
      console.error('[CargoAssetsPage] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, search, filterExpId]);

  useEffect(() => {
    const t = setTimeout(loadCargo, 350);
    return () => clearTimeout(t);
  }, [loadCargo]);

  // Click stat card to filter
  const handleStatFilter = (statusVal) => {
    if (activeStatFilter === statusVal) {
      setActiveStatFilter(null);
      setFilterStatus('ALL');
    } else {
      setActiveStatFilter(statusVal);
      setFilterStatus(statusVal);
    }
  };

  const STAT_CARDS = stats ? [
    { label: 'Total Cargo',  value: stats.total_cargo,   icon: Box,           iconClass: 'icon-cyan',    cardClass: '',             filter: null },
    { label: 'In Transit',   value: stats.in_transit,    icon: Truck,         iconClass: 'icon-info',    cardClass: 'stat-info',    filter: 'In Transit' },
    { label: 'Delivered',    value: stats.delivered,     icon: CheckCircle2,  iconClass: 'icon-success', cardClass: 'stat-success', filter: 'Delivered' },
    { label: 'High Priority',value: stats.high_priority, icon: AlertTriangle, iconClass: 'icon-warning', cardClass: 'stat-warning', filter: null },
    { label: 'Delayed',      value: stats.delayed,       icon: Clock,         iconClass: 'icon-danger',  cardClass: 'stat-danger',  filter: 'Delayed' },
  ] : [];

  const STAT_SUB = [
    'All registered assets',
    `${stats?.loaded || 0} loaded • ${stats?.at_port || 0} at port`,
    'Reached destination',
    'High + Critical items',
    'Action required',
  ];

  return (
    <div className="cargo-page">
      {/* ─── Page Header ─── */}
      <div className="cargo-page-header">
        <div className="cargo-header-info">
          <div className="cargo-module-badge">
            <Box size={13} />
            Cold-Chain Cargo & Asset Telemetry — SIH26062
          </div>
          <h2>Polar Cargo & Asset Management</h2>
          <p>
            Real-time tracking of mission equipment, cold-chain manifests, polar snowcat fuel pods, and life-support cargo
            across all ISEA expedition routes.
          </p>
        </div>
        <div className="cargo-header-actions">
          <button
            className="btn-secondary"
            onClick={loadCargo}
            title="Refresh cargo list"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'radar-sweep-icon' : ''} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Register Cargo
          </button>
        </div>
      </div>

      {/* ─── Expedition Filter Banner ─── */}
      {filterExpId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '8px', marginBottom: '4px' }}>
          <Box size={14} style={{ color: 'var(--cyan-400)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)' }}>
            Showing cargo for Expedition ID: <strong style={{ color: '#fff' }}>EXP-{filterExpId}</strong>
          </span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', fontSize: '11px', padding: '3px 10px' }}
            onClick={() => setFilterExpId(null)}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* ─── Summary Stat Cards ─── */}
      <div className="cargo-stats-grid">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const isActive = card.filter && activeStatFilter === card.filter;
          return (
            <div
              key={card.label}
              className={`cargo-stat-card ${card.cardClass} ${isActive ? 'active-filter' : ''}`}
              onClick={() => card.filter && handleStatFilter(card.filter)}
              style={{ cursor: card.filter ? 'pointer' : 'default' }}
            >
              <div className="cargo-stat-icon-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={`cargo-stat-icon ${card.iconClass}`}>
                  <Icon size={17} />
                </div>
                {card.filter && isActive && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--cyan-400)', border: '1px solid var(--border-medium)', borderRadius: 4, padding: '1px 5px' }}>
                    FILTERED
                  </span>
                )}
              </div>
              <div className="cargo-stat-value">{stats ? card.value : '—'}</div>
              <div className="cargo-stat-label">{card.label}</div>
              <div className="cargo-stat-sublabel">{STAT_SUB[i]}</div>
            </div>
          );
        })}
      </div>

      {/* ─── Control Bar ─── */}
      <div className="cargo-control-bar">
        {/* Search */}
        <div className="cargo-search-wrap">
          <Search size={14} />
          <input
            className="cargo-search-input"
            type="text"
            placeholder="Search by ID, name, category, destination, origin…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="cargo-control-divider" />

        {/* Status Filter */}
        <span className="cargo-filter-label"><Filter size={11} style={{ display: 'inline', marginRight: 4 }} />Status</span>
        <select
          className="cargo-filter-select"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setActiveStatFilter(null); }}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Priority Filter */}
        <span className="cargo-filter-label">Priority</span>
        <select
          className="cargo-filter-select"
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Clear Filters */}
        {(filterStatus !== 'ALL' || filterPriority !== 'ALL' || search) && (
          <button
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: 11 }}
            onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterPriority('ALL'); setActiveStatFilter(null); }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* ─── Cargo Table ─── */}
      <div className="cargo-table-panel">
        <div className="cargo-table-header">
          <div className="cargo-table-title-group">
            <Truck size={16} className="cargo-table-icon" />
            <span className="cargo-table-title">Active Polar Cargo Manifests</span>
            <span className="cargo-count-badge">{cargoList.length} SHIPMENTS</span>
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Season 2026-27 · NCPOR / ISEA
          </span>
        </div>

        {loading ? (
          <div className="cargo-loading">
            <Loader size={18} /> Loading cargo manifests…
          </div>
        ) : cargoList.length === 0 ? (
          <div className="cargo-empty-state">
            <div className="cargo-empty-icon"><Package size={22} /></div>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)' }}>No cargo items match your filters.</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Try clearing filters or registering a new cargo item.</p>
          </div>
        ) : (
          <div className="cargo-table-wrap">
            <table className="cargo-table">
              <thead>
                <tr>
                  <th>Cargo ID</th>
                  <th>Cargo Name</th>
                  <th>Category</th>
                  <th>Weight</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Last Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cargoList.map(c => (
                  <tr
                    key={c.id}
                    className={selectedCargoId === c.id ? 'selected-row' : ''}
                    onClick={() => setSelectedCargoId(c.id)}
                  >
                    <td><span className="cargo-id-cell">{c.cargo_code}</span></td>
                    <td>
                      <span className="cargo-name-cell" title={c.name}>{c.name}</span>
                    </td>
                    <td>
                      <span className="cargo-category-pill">{c.category}</span>
                    </td>
                    <td><span className="cargo-weight-cell">{c.weight}</span></td>
                    <td><span className="cargo-location-cell" title={c.origin}>{c.origin}</span></td>
                    <td>
                      <span className="cargo-location-cell" title={c.destination} style={{ color: 'var(--cyan-300)' }}>
                        {c.destination}
                      </span>
                    </td>
                    <td><CargoStatusBadge status={c.status} /></td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td><span className="cargo-updated-cell">{c.last_updated}</span></td>
                    <td>
                      <button
                        className="cargo-action-btn"
                        onClick={e => { e.stopPropagation(); setSelectedCargoId(c.id); }}
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Cargo Detail Panel ─── */}
      {selectedCargoId && (
        <CargoDetailPanel
          cargoId={selectedCargoId}
          onClose={() => setSelectedCargoId(null)}
          onRefreshList={loadCargo}
        />
      )}

      {/* ─── Add Cargo Modal ─── */}
      {showAddModal && (
        <AddCargoModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { loadCargo(); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
