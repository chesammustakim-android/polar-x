import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes, Plus, RefreshCw, Search, Filter, AlertTriangle,
  CheckCircle2, XCircle, Clock, ArrowRight, ArrowDownRight,
  ArrowUpRight, Edit3, Eye, History, ShieldAlert,
  Compass, MapPin, Layers, X, Loader, Check, Info, ShieldCheck,
  TrendingDown, TrendingUp, AlertCircle, Building,
  Truck, Send, ClipboardList, ChevronDown, ChevronUp, Navigation
} from 'lucide-react';

import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import QuickModal from '../components/common/QuickModal';

const CATEGORIES = [
  'Food',
  'Fuel',
  'Medical',
  'Scientific Equipment',
  'Clothing',
  'Communication',
  'Safety Equipment',
  'Spare Parts',
  'Other'
];

const STATUSES = ['ALL', 'NORMAL', 'LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK'];

// ─── HELPER: Progress bar for stock vs min threshold ────────────────────────
function StockMeter({ quantity, minQuantity, status }) {
  const q = Number(quantity || 0);
  const minQ = Number(minQuantity || 0);
  const target = minQ > 0 ? minQ * 2 : (q > 0 ? q * 1.5 : 100);
  const pct = Math.min(100, Math.round((q / target) * 100));

  const statusKey = (status || '').toLowerCase().replace(/[\s_]+/g, '-');

  return (
    <div className="stock-meter-wrap">
      <div className="stock-meter-labels">
        <span style={{ color: '#fff', fontWeight: 600 }}>{q.toLocaleString()}</span>
        <span style={{ color: 'var(--text-muted)' }}>Min: {minQ.toLocaleString()}</span>
      </div>
      <div className="stock-meter-track">
        <div 
          className={`stock-meter-fill ${statusKey}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

// ─── ADD INVENTORY MODAL ─────────────────────────────────────────────────────
function AddInventoryModal({ expeditions = [], onClose, onCreated }) {
  const generateCode = (cat) => {
    const prefixMap = {
      'Fuel': 'FUEL',
      'Food': 'FOOD',
      'Medical': 'MED',
      'Scientific Equipment': 'SCI',
      'Clothing': 'CLOTH',
      'Communication': 'COMMS',
      'Safety Equipment': 'SAFE',
      'Spare Parts': 'SPARE',
      'Other': 'OTH'
    };
    const pfx = prefixMap[cat] || 'RES';
    return `${pfx}-${Math.floor(100 + Math.random() * 900)}`;
  };

  const [form, setForm] = useState({
    item_code: generateCode('Medical'),
    item_name: '',
    category: 'Medical',
    quantity: '50',
    minimum_quantity: '20',
    unit: 'Kits',
    location: 'Maitri Storage Bunker',
    burn_rate: '1.0 / Day',
    days_remaining: 100,
    expedition_id: expeditions.length > 0 ? String(expeditions[0].id) : ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'category') {
        next.item_code = generateCode(v);
        // sensible default unit
        if (v === 'Fuel') next.unit = 'Litres';
        else if (v === 'Food') next.unit = 'Packs';
        else if (v === 'Medical') next.unit = 'Kits';
        else if (v === 'Clothing') next.unit = 'Suits';
        else if (v === 'Communication') next.unit = 'Beacons';
        else if (v === 'Safety Equipment') next.unit = 'Coils';
        else if (v === 'Spare Parts') next.unit = 'Sets';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.item_name.trim()) {
      setError('Item name is required.');
      return;
    }

    const qty = parseFloat(form.quantity);
    const minQty = parseFloat(form.minimum_quantity);

    if (isNaN(qty) || qty < 0) {
      setError('Quantity cannot be negative.');
      return;
    }
    if (isNaN(minQty) || minQty < 0) {
      setError('Minimum quantity cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      await api.createInventory({
        item_code: form.item_code.trim(),
        item_name: form.item_name.trim(),
        category: form.category,
        quantity: qty,
        minimum_quantity: minQty,
        unit: form.unit.trim() || 'Units',
        location: form.location.trim() || 'Maitri Storage Bunker',
        burn_rate: form.burn_rate || 'Standard',
        days_remaining: parseInt(form.days_remaining) || 100,
        expedition_id: form.expedition_id ? parseInt(form.expedition_id) : null
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to register inventory item.');
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
              <Boxes size={18} />
            </div>
            <div>
              <h3>Register New Inventory Resource</h3>
              <p>Add station consumable, fuel, medical buffer, or expedition equipment</p>
            </div>
          </div>
          <button className="cargo-detail-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cargo-modal-body">
            {error && (
              <div style={{ background: 'var(--hazard-red-bg)', border: '1px solid var(--hazard-red-border)', color: 'var(--hazard-red)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div className="cargo-modal-grid">
              {/* Category */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Category *</label>
                <select 
                  className="cargo-form-select" 
                  value={form.category} 
                  onChange={e => set('category', e.target.value)} 
                  required
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Item Code */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Item Code *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="cargo-form-input"
                    type="text"
                    value={form.item_code}
                    onChange={e => set('item_code', e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-icon-only"
                    onClick={() => set('item_code', generateCode(form.category))}
                    title="Generate Code"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Item Name */}
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Item Name *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Sub-Zero Jet A-1 Fuel or Trauma Pack"
                  value={form.item_name}
                  onChange={e => set('item_name', e.target.value)}
                  required
                />
              </div>

              {/* Initial Quantity */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Initial Quantity *</label>
                <input
                  className="cargo-form-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  required
                />
              </div>

              {/* Minimum Safety Threshold */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Minimum Required (Buffer) *</label>
                <input
                  className="cargo-form-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.0"
                  value={form.minimum_quantity}
                  onChange={e => set('minimum_quantity', e.target.value)}
                  required
                />
              </div>

              {/* Unit */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Unit of Measure *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Litres, Packs, Kits, kg"
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  required
                />
              </div>

              {/* Location */}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Storage Location *</label>
                <input
                  className="cargo-form-input"
                  type="text"
                  placeholder="e.g. Maitri Storage Bunker"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  required
                />
              </div>

              {/* Expedition */}
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Assigned Expedition</label>
                <select 
                  className="cargo-form-select" 
                  value={form.expedition_id} 
                  onChange={e => set('expedition_id', e.target.value)}
                >
                  <option value="">Station General Buffer (Unassigned)</option>
                  {expeditions.map(exp => (
                    <option key={exp.id} value={exp.id}>{exp.name} ({exp.location})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="cargo-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              <X size={13} />
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader size={13} className="radar-sweep-icon" /> : <Plus size={13} />}
              {saving ? 'Registering…' : 'Register to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RECORD CONSUMPTION MODAL (PASS 3) ──────────────────────────────────────
function RecordConsumptionModal({ stations = [], inventoryItems = [], onClose, onRecorded, defaultStationId = null }) {
  const [stationId, setStationId] = useState(defaultStationId ? String(defaultStationId) : '');
  const [itemCode, setItemCode] = useState('');
  const [consumptionDate, setConsumptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [consumedQty, setConsumedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedItem = inventoryItems.find(i => i.item_code === itemCode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!stationId) { setError('Select a station.'); return; }
    if (!itemCode) { setError('Select an item.'); return; }
    const qty = parseFloat(consumedQty);
    if (isNaN(qty) || qty <= 0) { setError('Consumed quantity must be greater than zero.'); return; }
    setSaving(true);
    try {
      await api.recordStationConsumption(parseInt(stationId), {
        item_code: itemCode,
        item_name: selectedItem?.item_name || itemCode,
        consumption_date: consumptionDate,
        consumed_quantity: qty,
        unit: selectedItem?.unit || 'Units',
        notes: notes.trim() || null
      });
      onRecorded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record consumption.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cargo-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-modal" style={{ maxWidth: '560px' }}>
        <div className="cargo-modal-header">
          <div className="cargo-modal-header-left">
            <div className="cargo-modal-icon" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <ClipboardList size={18} style={{ color: 'var(--hazard-green)' }} />
            </div>
            <div>
              <h3>Record Daily Consumption</h3>
              <p>Updates inventory stock (STOCK_OUT) and logs consumption history</p>
            </div>
          </div>
          <button className="cargo-detail-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="cargo-modal-body">
            {error && (
              <div style={{ background: 'var(--hazard-red-bg)', border: '1px solid var(--hazard-red-border)', color: 'var(--hazard-red)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} /><span>{error}</span>
              </div>
            )}
            <div className="cargo-modal-grid">
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Polar Facility *</label>
                {defaultStationId ? (
                  <div className="cargo-form-input" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(6,182,212,0.06)', color: 'var(--cyan-300)', cursor: 'not-allowed', opacity: 0.85 }}>
                    <Building size={13} />
                    {stations.find(s => s.id === defaultStationId)?.name || `Station #${defaultStationId}`}
                  </div>
                ) : (
                  <select className="cargo-form-select" value={stationId} onChange={e => setStationId(e.target.value)} required>
                    <option value="">Select station…</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                  </select>
                )}
              </div>
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Resource / Item *</label>
                <select className="cargo-form-select" value={itemCode} onChange={e => setItemCode(e.target.value)} required>
                  <option value="">Select item code…</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.item_code}>
                      [{item.item_code}] {item.item_name} — {item.quantity} {item.unit} in stock
                    </option>
                  ))}
                </select>
              </div>
              {selectedItem && (
                <div className="cargo-form-field cargo-modal-field-full">
                  <div style={{ display: 'flex', gap: 12, background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <span>Current stock: <strong style={{ color: '#fff' }}>{selectedItem.quantity} {selectedItem.unit}</strong></span>
                    <span>Min required: <strong style={{ color: 'var(--hazard-amber)' }}>{selectedItem.minimum_quantity} {selectedItem.unit}</strong></span>
                    <span>Status: <strong style={{ color: selectedItem.status === 'NORMAL' ? 'var(--hazard-green)' : 'var(--hazard-red)' }}>{selectedItem.status}</strong></span>
                  </div>
                </div>
              )}
              <div className="cargo-form-field">
                <label className="cargo-form-label">Consumption Date *</label>
                <input className="cargo-form-input" type="date" value={consumptionDate} max={new Date().toISOString().split('T')[0]} onChange={e => setConsumptionDate(e.target.value)} required />
              </div>
              <div className="cargo-form-field">
                <label className="cargo-form-label">Consumed Quantity * ({selectedItem?.unit || 'Units'})</label>
                <input className="cargo-form-input" type="number" min="0.001" step="any" placeholder="e.g. 50" value={consumedQty} onChange={e => setConsumedQty(e.target.value)} required />
              </div>
              <div className="cargo-form-field cargo-modal-field-full">
                <label className="cargo-form-label">Notes (optional)</label>
                <input className="cargo-form-input" type="text" placeholder="e.g. Daily heating fuel — Block D winter ops" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="cargo-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}><X size={13} /> Cancel</button>
            <button type="submit" className="btn-primary" style={{ background: 'var(--hazard-green)', borderColor: 'var(--hazard-green)' }} disabled={saving}>
              {saving ? <Loader size={13} className="radar-sweep-icon" /> : <Check size={13} />}
              {saving ? 'Recording…' : 'Record Consumption'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── REQUEST TRANSFER MODAL (PASS 3) ─────────────────────────────────────────
export function RequestTransferModal({ destStation, stations = [], itemInfo, onClose, onRequested }) {
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [reason, setReason] = useState('');
  const [donors, setDonors] = useState([]);
  const [loadingDonors, setLoadingDonors] = useState(true)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const deficit = itemInfo?.surplus_deficit !== null ? Math.abs(itemInfo.surplus_deficit) : null;

  useEffect(() => {
    if (!destStation?.id || !itemInfo?.item_code) return;
    setLoadingDonors(true);
    api.getDonorRecommendations(destStation.id, itemInfo.item_code, deficit)
      .then(d => {
        setDonors(d || []);
        if (d && d.length > 0) {
          setSelectedDonorId(String(d[0].donor_station_id));
          setRequestedQty(String(d[0].recommended_transfer_quantity));
        }
      })
      .catch(() => setDonors([]))
      .finally(() => setLoadingDonors(false));
  }, [destStation?.id, itemInfo?.item_code]);

  const selectedDonor = donors.find(d => String(d.donor_station_id) === selectedDonorId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!selectedDonorId) { setError('Select a donor station.'); return; }
    const qty = parseFloat(requestedQty);
    if (isNaN(qty) || qty <= 0) { setError('Requested quantity must be greater than zero.'); return; }
    if (selectedDonor && qty > selectedDonor.donor_transferable_surplus) {
      setError(`Cannot exceed donor surplus of ${selectedDonor.donor_transferable_surplus} ${selectedDonor.unit}.`);
      return;
    }
    setSaving(true);
    try {
      await api.createTransferRequest(destStation.id, {
        source_station_id: parseInt(selectedDonorId),
        item_code: itemInfo.item_code,
        item_name: itemInfo.item_name,
        requested_quantity: qty,
        request_reason: reason.trim() || `Shortage at ${destStation.name}: deficit ${deficit} ${itemInfo.unit}`
      });
      onRequested();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create transfer request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cargo-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-modal" style={{ maxWidth: '620px' }}>
        <div className="cargo-modal-header">
          <div className="cargo-modal-header-left">
            <div className="cargo-modal-icon" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <Truck size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h3>Request Cross-Station Transfer</h3>
              <p>{itemInfo?.item_name} ({itemInfo?.item_code}) → {destStation?.name}</p>
            </div>
          </div>
          <button className="cargo-detail-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="cargo-modal-body">
            {/* Shortage summary */}
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: 11.5, fontFamily: 'var(--font-mono)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Destination: <strong style={{ color: '#fff' }}>{destStation?.name}</strong></span>
              <span>Current stock: <strong style={{ color: 'var(--hazard-red)' }}>{itemInfo?.current_stock} {itemInfo?.unit}</strong></span>
              <span>Min required: <strong style={{ color: 'var(--hazard-amber)' }}>{itemInfo?.minimum_quantity} {itemInfo?.unit}</strong></span>
              {deficit !== null && <span>Deficit: <strong style={{ color: 'var(--hazard-red)' }}>−{deficit} {itemInfo?.unit}</strong></span>}
            </div>

            {error && (
              <div style={{ background: 'var(--hazard-red-bg)', border: '1px solid var(--hazard-red-border)', color: 'var(--hazard-red)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} /><span>{error}</span>
              </div>
            )}

            {loadingDonors ? (
              <div className="cargo-loading" style={{ minHeight: '80px' }}>
                <Loader size={16} className="radar-sweep-icon" />
                <span>Scanning eligible donor stations…</span>
              </div>
            ) : donors.length === 0 ? (
              <div className="cargo-empty-state" style={{ minHeight: '80px' }}>
                <Navigation size={18} style={{ margin: '0 auto 6px', color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 12 }}>No eligible donor stations found.</p>
                <p style={{ fontSize: 11 }}>All other stations are at or below their minimum reserves for this resource.</p>
              </div>
            ) : (
              <div className="cargo-modal-grid">
                {/* Donor list */}
                <div className="cargo-form-field cargo-modal-field-full">
                  <label className="cargo-form-label">Select Donor Station * ({donors.length} eligible)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {donors.map(d => (
                      <label
                        key={d.donor_station_id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '10px 12px', border: `1px solid ${selectedDonorId === String(d.donor_station_id) ? 'rgba(139,92,246,0.5)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          background: selectedDonorId === String(d.donor_station_id) ? 'rgba(139,92,246,0.06)' : 'rgba(15,23,42,0.4)'
                        }}
                      >
                        <input
                          type="radio" name="donor" value={String(d.donor_station_id)}
                          checked={selectedDonorId === String(d.donor_station_id)}
                          onChange={() => { setSelectedDonorId(String(d.donor_station_id)); setRequestedQty(String(d.recommended_transfer_quantity)); }}
                          style={{ marginTop: 2 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>#{d.rank} {d.donor_station_name}</span>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)' }}>{d.distance_km?.toFixed(0)} km away</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span>Stock: {d.donor_current_stock} {d.unit}</span>
                            <span>Reserve: {d.donor_minimum_required} {d.unit}</span>
                            <span style={{ color: 'var(--hazard-green)' }}>Surplus: +{d.donor_transferable_surplus} {d.unit}</span>
                            <span style={{ color: '#a78bfa' }}>Recommended: {d.recommended_transfer_quantity} {d.unit}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="cargo-form-field">
                  <label className="cargo-form-label">Requested Quantity * ({itemInfo?.unit})</label>
                  <input
                    className="cargo-form-input" type="number" min="0.001" step="any"
                    value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required
                    max={selectedDonor?.donor_transferable_surplus || undefined}
                  />
                  {selectedDonor && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'block' }}>
                      Max transferable: {selectedDonor.donor_transferable_surplus} {selectedDonor.unit}
                    </span>
                  )}
                </div>

                <div className="cargo-form-field">
                  <label className="cargo-form-label">Request Reason</label>
                  <input
                    className="cargo-form-input" type="text"
                    placeholder="e.g. Critical heating fuel shortage — winter storm ops"
                    value={reason} onChange={e => setReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="cargo-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}><X size={13} /> Cancel</button>
            {donors.length > 0 && (
              <button type="submit" className="btn-primary" style={{ background: 'rgba(139,92,246,0.85)', borderColor: '#7c3aed' }} disabled={saving || !selectedDonorId}>
                {saving ? <Loader size={13} className="radar-sweep-icon" /> : <Send size={13} />}
                {saving ? 'Submitting…' : 'Submit Transfer Request'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function TransferManagementPanel({ transfers = [], loading, isDirectorOrAdmin, currentUser, onRefresh, onAction }) {
  const [expanded, setExpanded] = useState(null);
  const user = currentUser || api.getStoredUser() || {};
  const canCancel = (tr) => isDirectorOrAdmin || (user.role === 'STATION_HEAD' && tr.status === 'REQUESTED' && (tr.destination_station_id === user.assigned_station_id || tr.source_station_id === user.assigned_station_id));

  const STATUS_COLORS = {
    REQUESTED: { color: 'var(--cyan-300)', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)' },
    APPROVED: { color: 'var(--hazard-green)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    REJECTED: { color: 'var(--hazard-red)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    COMPLETED: { color: '#9ca3af', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
    CANCELLED: { color: '#6b7280', bg: 'rgba(75,85,99,0.06)', border: 'rgba(75,85,99,0.15)' },
  };

  const [approveId, setApproveId] = useState(null);
  const [approveQty, setApproveQty] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const doApprove = async (tr) => {
    setActionBusy(true); setActionError(null);
    try {
      await api.approveTransfer(tr.id, { action: 'APPROVED', approved_quantity: parseFloat(approveQty) || tr.requested_quantity, approver_notes: approveNotes.trim() || null });
      setApproveId(null); setApproveQty(''); setApproveNotes('');
      onRefresh();
    } catch (e) { setActionError(e.message); }
    finally { setActionBusy(false); }
  };

  const doReject = async (tr) => {
    setActionBusy(true); setActionError(null);
    try {
      await api.rejectTransfer(tr.id, { action: 'REJECTED', approver_notes: rejectNotes.trim() || 'Rejected.' });
      setRejectId(null); setRejectNotes('');
      onRefresh();
    } catch (e) { setActionError(e.message); }
    finally { setActionBusy(false); }
  };

  const doComplete = async (id) => {
    setActionBusy(true); setActionError(null);
    try {
      await api.completeTransfer(id, { completion_notes: 'Transfer completed.' });
      onRefresh();
    } catch (e) { setActionError(e.message); }
    finally { setActionBusy(false); }
  };

  const doCancel = async (id) => {
    setActionBusy(true); setActionError(null);
    try {
      await api.cancelTransfer(id);
      onRefresh();
    } catch (e) { setActionError(e.message); }
    finally { setActionBusy(false); }
  };

  const pending = transfers.filter(t => ['REQUESTED', 'APPROVED'].includes(t.status));
  const history = transfers.filter(t => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status));

  return (
    <div className="station-requirements-view">
      <div className="station-context-banner" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Cross-Station Transfer Requests</span>
          {pending.length > 0 && (
            <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--hazard-red)', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '1px 7px', borderRadius: 12 }}>
              {pending.length} PENDING
            </span>
          )}
        </div>
        <button className="btn-secondary" onClick={onRefresh} style={{ padding: '6px 12px', fontSize: 11 }}>
          <RefreshCw size={13} className={loading ? 'radar-sweep-icon' : ''} /> Refresh
        </button>
      </div>

      {actionError && (
        <div style={{ background: 'var(--hazard-red-bg)', border: '1px solid var(--hazard-red-border)', color: 'var(--hazard-red)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={13} /><span>{actionError}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setActionError(null)}><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="cargo-loading"><Loader size={18} className="radar-sweep-icon" /> Loading transfer requests…</div>
      ) : transfers.length === 0 ? (
        <div className="cargo-empty-state">
          <Truck size={22} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
          <p>No transfer requests found.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>Use the Station Requirements view to request a cross-station transfer for shortage items.</p>
        </div>
      ) : (
        <div>
          {pending.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Pending / Active ({pending.length})</div>
              {pending.map(tr => {
                const sc = STATUS_COLORS[tr.status] || STATUS_COLORS.REQUESTED;
                const isExpanded = expanded === tr.id;
                return (
                  <div key={tr.id} style={{ border: `1px solid ${sc.border}`, borderRadius: 'var(--radius-md)', background: sc.bg, marginBottom: 10, overflow: 'hidden' }}>
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isExpanded ? null : tr.id)}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{tr.status}</span>
                        <span style={{ fontWeight: 600, fontSize: 12, color: '#fff' }}>#{tr.id} — {tr.item_name || tr.item_code}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {tr.source_station_name} → {tr.destination_station_name}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)' }}>
                          {tr.requested_quantity} {tr.unit}
                        </span>
                        {tr.distance_km && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tr.distance_km} km</span>}
                      </div>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${sc.border}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                          <div><div style={{ color: 'var(--text-muted)' }}>ITEM CODE</div><div style={{ color: '#fff', fontWeight: 600 }}>{tr.item_code}</div></div>
                          <div><div style={{ color: 'var(--text-muted)' }}>REQUESTED QTY</div><div style={{ color: 'var(--cyan-300)', fontWeight: 700 }}>{tr.requested_quantity} {tr.unit}</div></div>
                          {tr.approved_quantity && <div><div style={{ color: 'var(--text-muted)' }}>APPROVED QTY</div><div style={{ color: 'var(--hazard-green)', fontWeight: 700 }}>{tr.approved_quantity} {tr.unit}</div></div>}
                          <div><div style={{ color: 'var(--text-muted)' }}>REQUESTED BY</div><div>{tr.requester_name}</div></div>
                          {tr.approver_name && <div><div style={{ color: 'var(--text-muted)' }}>REVIEWED BY</div><div>{tr.approver_name}</div></div>}
                          <div><div style={{ color: 'var(--text-muted)' }}>REQUESTED AT</div><div>{tr.requested_at?.split('T')[0]}</div></div>
                        </div>
                        {tr.request_reason && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Reason: {tr.request_reason}</div>}
                        {tr.approver_notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Director note: {tr.approver_notes}</div>}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                          {isDirectorOrAdmin && tr.status === 'REQUESTED' && (
                            <>
                              {approveId === tr.id ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input className="cargo-form-input" type="number" min="0.001" step="any" style={{ width: 100 }}
                                    placeholder={`Qty (${tr.unit})`} value={approveQty} onChange={e => setApproveQty(e.target.value)} />
                                  <input className="cargo-form-input" type="text" style={{ flex: 1, minWidth: 120 }}
                                    placeholder="Approval notes (optional)" value={approveNotes} onChange={e => setApproveNotes(e.target.value)} />
                                  <button className="btn-primary" style={{ fontSize: 11, padding: '5px 10px', background: 'var(--hazard-green)', borderColor: 'var(--hazard-green)' }}
                                    onClick={() => doApprove(tr)} disabled={actionBusy}>
                                    <Check size={12} /> Confirm Approve
                                  </button>
                                  <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setApproveId(null)}><X size={12} /></button>
                                </div>
                              ) : (
                                <button className="btn-primary" style={{ fontSize: 11, padding: '5px 12px', background: 'var(--hazard-green)', borderColor: 'var(--hazard-green)' }}
                                  onClick={() => { setApproveId(tr.id); setApproveQty(String(tr.requested_quantity)); setRejectId(null); }}>
                                  <Check size={12} /> Approve
                                </button>
                              )}
                              {rejectId === tr.id ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input className="cargo-form-input" type="text" style={{ flex: 1, minWidth: 140 }}
                                    placeholder="Rejection reason…" value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} />
                                  <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px', color: 'var(--hazard-red)', borderColor: 'rgba(239,68,68,0.4)' }}
                                    onClick={() => doReject(tr)} disabled={actionBusy}>
                                    <X size={12} /> Confirm Reject
                                  </button>
                                  <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setRejectId(null)}><X size={12} /></button>
                                </div>
                              ) : (
                                <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 12px', color: 'var(--hazard-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                                  onClick={() => { setRejectId(tr.id); setApproveId(null); }}>
                                  <X size={12} /> Reject
                                </button>
                              )}
                            </>
                          )}
                          {isDirectorOrAdmin && tr.status === 'APPROVED' && (
                            <button className="btn-primary" style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(139,92,246,0.85)', borderColor: '#7c3aed' }}
                              onClick={() => doComplete(tr.id)} disabled={actionBusy}>
                              {actionBusy ? <Loader size={12} className="radar-sweep-icon" /> : <Truck size={12} />}
                              Complete Transfer
                            </button>
                          )}
                          {canCancel(tr) && (
                            <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 12px', color: 'var(--text-muted)' }}
                              onClick={() => doCancel(tr.id)} disabled={actionBusy}>
                              <X size={12} /> Cancel Request
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>History ({history.length})</div>
              {history.map(tr => {
                const sc = STATUS_COLORS[tr.status] || STATUS_COLORS.CANCELLED;
                return (
                  <div key={tr.id} style={{ border: `1px solid ${sc.border}`, borderRadius: 'var(--radius-sm)', background: 'rgba(15,23,42,0.3)', marginBottom: 6, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>{tr.status}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>#{tr.id} {tr.item_name || tr.item_code}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{tr.source_station_name} → {tr.destination_station_name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{tr.transferred_quantity || tr.approved_quantity || tr.requested_quantity} {tr.unit}</span>
                    {tr.completed_at && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tr.completed_at?.split('T')[0]}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STOCK UPDATE MODAL (Stock In / Stock Out / Adjustment) ─────────────────
function StockUpdateModal({ item, onClose, onUpdated }) {
  const [opType, setOpType] = useState('STOCK_IN'); // STOCK_IN, STOCK_OUT, ADJUSTMENT
  const [quantity, setQuantity] = useState('10');
  const [reason, setReason] = useState('');
  const [user, setUser] = useState('Station Logistics Officer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const curQty = Number(item.quantity || 0);
  const enteredQty = parseFloat(quantity) || 0;

  // Calculate projected new quantity
  let projectedQty = curQty;
  if (opType === 'STOCK_IN') {
    projectedQty = curQty + enteredQty;
  } else if (opType === 'STOCK_OUT') {
    projectedQty = curQty - enteredQty;
  } else if (opType === 'ADJUSTMENT') {
    projectedQty = enteredQty;
  }

  const isStockOutInvalid = opType === 'STOCK_OUT' && (enteredQty > curQty || enteredQty <= 0);
  const isAdjustmentInvalid = opType === 'ADJUSTMENT' && enteredQty < 0;
  const isStockInInvalid = opType === 'STOCK_IN' && enteredQty <= 0;
  const isInvalid = isStockOutInvalid || isAdjustmentInvalid || isStockInInvalid;

  // Projected status preview
  let projectedStatus = 'NORMAL';
  if (projectedQty <= 0) projectedStatus = 'OUT_OF_STOCK';
  else if (projectedQty < item.minimum_quantity) projectedStatus = 'CRITICAL';
  else if (projectedQty <= item.minimum_quantity * 1.5) projectedStatus = 'LOW_STOCK';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isInvalid) {
      if (isStockOutInvalid && enteredQty > curQty) {
        setError(`Cannot stock out ${enteredQty} ${item.unit}. Only ${curQty} ${item.unit} available in stock.`);
      } else {
        setError('Please enter a valid stock quantity.');
      }
      return;
    }

    setSaving(true);
    try {
      await api.updateInventoryStock(item.id, {
        transaction_type: opType,
        quantity: enteredQty,
        reason: reason.trim() || `${opType} operation performed`,
        user: user.trim() || 'Station Logistics Officer'
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.message || 'Stock operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cargo-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-modal" style={{ maxWidth: '540px' }}>
        <div className="cargo-modal-header">
          <div className="cargo-modal-header-left">
            <div className="cargo-modal-icon">
              <Edit3 size={18} />
            </div>
            <div>
              <h3>Stock Operations — {item.item_code}</h3>
              <p>{item.item_name}</p>
            </div>
          </div>
          <button className="cargo-detail-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cargo-modal-body">
            {error && (
              <div style={{ background: 'var(--hazard-red-bg)', border: '1px solid var(--hazard-red-border)', color: 'var(--hazard-red)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Operation Type Switcher */}
            <div className="stock-op-buttons">
              <button
                type="button"
                className={`stock-op-btn stock-in ${opType === 'STOCK_IN' ? 'active' : ''}`}
                onClick={() => { setOpType('STOCK_IN'); setError(null); }}
              >
                <ArrowUpRight size={16} />
                STOCK IN
              </button>
              <button
                type="button"
                className={`stock-op-btn stock-out ${opType === 'STOCK_OUT' ? 'active' : ''}`}
                onClick={() => { setOpType('STOCK_OUT'); setError(null); }}
              >
                <ArrowDownRight size={16} />
                STOCK OUT
              </button>
              <button
                type="button"
                className={`stock-op-btn adjustment ${opType === 'ADJUSTMENT' ? 'active' : ''}`}
                onClick={() => { setOpType('ADJUSTMENT'); setQuantity(String(curQty)); setError(null); }}
              >
                <Edit3 size={16} />
                ADJUSTMENT
              </button>
            </div>

            {/* Quantity Input */}
            <div className="cargo-form-field" style={{ marginBottom: 14 }}>
              <label className="cargo-form-label">
                {opType === 'ADJUSTMENT' ? 'New Target Stock Quantity' : 'Operation Amount'} ({item.unit}) *
              </label>
              <input
                className="cargo-form-input"
                type="number"
                step="any"
                min={opType === 'ADJUSTMENT' ? '0' : '0.01'}
                max={opType === 'STOCK_OUT' ? String(curQty) : undefined}
                value={quantity}
                onChange={e => { setQuantity(e.target.value); setError(null); }}
                required
                style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
              />
              {opType === 'STOCK_OUT' && enteredQty > curQty && (
                <span style={{ color: 'var(--hazard-red)', fontSize: '11px', marginTop: '4px' }}>
                  Warning: Cannot exceed current available stock ({curQty} {item.unit})
                </span>
              )}
            </div>

            {/* Live Visual Calculation Preview */}
            <div className="stock-live-preview-box">
              <div className="preview-step">
                <span className="preview-step-label">Current Stock</span>
                <span className="preview-step-val">{curQty.toLocaleString()} {item.unit}</span>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
              <div className="preview-step">
                <span className="preview-step-label">{opType.replace('_', ' ')}</span>
                <span className={`preview-step-val ${opType === 'STOCK_IN' ? 'delta-in' : opType === 'STOCK_OUT' ? 'delta-out' : 'delta-adj'}`}>
                  {opType === 'STOCK_IN' ? `+${enteredQty}` : opType === 'STOCK_OUT' ? `-${enteredQty}` : `set to ${enteredQty}`}
                </span>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
              <div className="preview-step">
                <span className="preview-step-label">Projected Stock</span>
                <span className="preview-step-val" style={{ color: projectedQty < item.minimum_quantity ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
                  {Math.max(0, projectedQty).toLocaleString()} {item.unit}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div className="cargo-form-field" style={{ marginBottom: 12 }}>
              <label className="cargo-form-label">Reason / Protocol Reference</label>
              <input
                className="cargo-form-input"
                type="text"
                placeholder={opType === 'STOCK_IN' ? 'e.g. Vessel landing barge resupply' : opType === 'STOCK_OUT' ? 'e.g. Inland traverse convoy requisition' : 'e.g. Monthly physical audit adjustment'}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            {/* User */}
            <div className="cargo-form-field">
              <label className="cargo-form-label">Authorized Officer</label>
              <input
                className="cargo-form-input"
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
              />
            </div>
          </div>

          <div className="cargo-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              <X size={13} />
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || isInvalid}>
              {saving ? <Loader size={13} className="radar-sweep-icon" /> : <Check size={13} />}
              {saving ? 'Processing…' : `Confirm ${opType.replace('_', ' ')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── INVENTORY DETAIL SLIDE-OVER DRAWER ───────────────────────────────────────
function InventoryDetailPanel({ itemId, onClose, onRefreshList, onOpenStockModal }) {
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, history
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, h] = await Promise.all([
        api.getInventoryById(itemId),
        api.getInventoryHistory(itemId)
      ]);
      setDetail(d);
      setHistory(h || []);
    } catch (err) {
      console.error('[InventoryDetailPanel] Error loading item:', err);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="cargo-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cargo-detail-panel">
        {/* Top Bar */}
        <div className="cargo-detail-topbar">
          <div className="cargo-detail-topbar-left">
            <span className="item-code-cell" style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: 4 }}>
              {detail?.item_code || '…'}
            </span>
            <h3>{detail?.item_name || 'Loading…'}</h3>
          </div>
          <button className="cargo-detail-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="cargo-detail-tabs">
          <button
            className={`cargo-detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Info size={13} />
            Resource Overview
          </button>
          <button
            className={`cargo-detail-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={13} />
            Audit Log ({history.length})
          </button>
        </div>

        {/* Body */}
        <div className="cargo-detail-body">
          {loading ? (
            <div className="cargo-loading">
              <Loader size={18} className="radar-sweep-icon" />
              <span>Loading resource specifications…</span>
            </div>
          ) : !detail ? (
            <div className="cargo-empty-state">
              <p>Failed to load resource details.</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={detail.status} />
                      <span className="item-category-pill">{detail.category}</span>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '11.5px' }}
                      onClick={() => onOpenStockModal(detail)}
                    >
                      <Edit3 size={13} />
                      Perform Stock Op
                    </button>
                  </div>

                  {/* Stock Meter Big View */}
                  <div style={{ background: 'rgba(8, 13, 26, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Stock Level</span>
                        <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                          {detail.quantity.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--cyan-300)' }}>{detail.unit}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Safety Threshold</span>
                        <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-amber)', fontWeight: 600 }}>
                          {detail.minimum_quantity.toLocaleString()} {detail.unit}
                        </div>
                      </div>
                    </div>
                    <div className="stock-meter-track" style={{ height: '8px' }}>
                      <div 
                        className={`stock-meter-fill ${(detail.status || '').toLowerCase().replace(/[\s_]+/g, '-')}`}
                        style={{ width: `${Math.min(100, Math.round((detail.quantity / (detail.minimum_quantity * 2 || 100)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="cargo-info-grid">
                    {[
                      { label: 'Item Code', value: detail.item_code, hi: true },
                      { label: 'Category', value: detail.category },
                      { label: 'Storage Location', value: detail.location, hi: true },
                      { label: 'Unit of Measure', value: detail.unit },
                      { label: 'Assigned Expedition', value: detail.expedition_name || 'Station General Buffer' },
                      { label: 'Burn Rate', value: detail.burn_rate || 'Standard' },
                      { label: 'Days Remaining', value: `${detail.days_remaining || 100} Days Reserve` },
                      { label: 'Registered Timestamp', value: detail.created_at || 'Season 2026-27' },
                      { label: 'Last Transaction', value: detail.updated_at || 'Recent' }
                    ].map(field => (
                      <div className="cargo-info-item" key={field.label}>
                        <span className="cargo-info-label">{field.label}</span>
                        <span className={`cargo-info-value ${field.hi ? 'highlight' : ''}`}>
                          {field.value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* AUDIT LOG TAB */}
              {activeTab === 'history' && (
                <div className="tx-history-list">
                  {history.length === 0 ? (
                    <div className="cargo-empty-state">
                      <History size={20} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                      <p>No recorded transactions yet.</p>
                    </div>
                  ) : (
                    history.map(tx => (
                      <div className="tx-history-item" key={tx.id}>
                        <div className="tx-history-top">
                          <span className={`tx-type-tag ${tx.transaction_type}`}>
                            {tx.transaction_type.replace('_', ' ')}
                          </span>
                          <span className="tx-qty-transition">
                            {tx.previous_quantity.toLocaleString()} → <strong style={{ color: '#fff' }}>{tx.new_quantity.toLocaleString()} {detail.unit}</strong>
                          </span>
                        </div>
                        {tx.reason && (
                          <div className="tx-reason-note">
                            {tx.reason}
                          </div>
                        )}
                        <div className="tx-meta-footer">
                          <span>Officer: {tx.user}</span>
                          <span>{tx.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EXPEDITION READINESS VIEW ────────────────────────────────────────────────
function ExpeditionReadinessView({ readinessList = [], loading, onRefresh }) {
  if (loading) {
    return (
      <div className="cargo-loading">
        <Loader size={20} className="radar-sweep-icon" />
        <span>Calculating live expedition inventory readiness from SQLite database…</span>
      </div>
    );
  }

  if (readinessList.length === 0) {
    return (
      <div className="cargo-empty-state">
        <Compass size={24} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
        <p>No active expedition requirement manifests found.</p>
      </div>
    );
  }

  return (
    <div className="readiness-grid">
      {readinessList.map(exp => {
        const isReady = exp.status === 'READY';
        return (
          <div 
            key={exp.expedition_id} 
            className={`expedition-readiness-card ${isReady ? 'status-ready' : 'status-attention'}`}
          >
            {/* Header */}
            <div className="readiness-card-header">
              <div>
                <h3 className="readiness-exp-name">{exp.expedition_name}</h3>
                <div className="readiness-exp-location">
                  <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {exp.location}
                </div>
              </div>
              <StatusBadge status={exp.status} />
            </div>

            {/* Overall Score Progress Bar */}
            <div className="readiness-progress-box">
              <div className="readiness-pct-row">
                <span className="readiness-pct-label">Supply Fulfillment Score</span>
                <span className={`readiness-pct-number ${isReady ? 'ready' : 'attention'}`}>
                  {exp.readiness_percentage}%
                </span>
              </div>
              <div className="stock-meter-track" style={{ height: '7px' }}>
                <div 
                  className={`stock-meter-fill ${isReady ? 'normal' : 'low-stock'}`}
                  style={{ width: `${exp.readiness_percentage}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Fulfilled: {exp.fulfilled_requirements} / {exp.total_requirements} categories</span>
                {exp.critical_shortages_count > 0 && (
                  <span style={{ color: 'var(--hazard-red)' }}>
                    <AlertTriangle size={10} style={{ display: 'inline', marginRight: 2 }} />
                    {exp.critical_shortages_count} Critical Shortage
                  </span>
                )}
              </div>
            </div>

            {/* Requirements Breakdown Table */}
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Category Requirements & Reserve Availability
              </div>
              <table className="requirements-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Required</th>
                    <th>Available</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exp.requirements.map(req => (
                    <tr key={req.id}>
                      <td style={{ color: '#fff', fontWeight: 500 }}>
                        {req.item_name || req.category}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {req.required_quantity.toLocaleString()} {req.unit}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: req.status === 'READY' ? 'var(--hazard-green)' : 'var(--hazard-red)', fontWeight: 600 }}>
                        {req.available_quantity.toLocaleString()} {req.unit}
                      </td>
                      <td>
                        <span className={`req-status-pill ${req.status}`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── STATION RESOURCE EXPLAINABILITY MODAL (PASS 2) ─────────────────────────
function StationResourceExplainModal({ item, onClose }) {
  if (!item) return null;
  const isBreached = item.current_stock !== null && item.current_stock <= item.minimum_quantity;
  const riskColor = item.risk_level === 'URGENT' || item.risk_level === 'CRITICAL' 
    ? 'var(--hazard-red)' 
    : item.risk_level === 'LOW' 
      ? 'var(--hazard-amber)' 
      : 'var(--hazard-green)';

  return (
    <QuickModal
      isOpen={true}
      onClose={onClose}
      title={`Station Resource Risk Analysis — ${item.item_name} (${item.item_code})`}
      footerButtons={
        <button className="btn-secondary" onClick={onClose}>
          Close Analysis
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Telemetry Summary Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          background: 'rgba(15,23,42,0.6)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>POLAR FACILITY</div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>{item.station_name}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CURRENT STOCK</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: isBreached ? 'var(--hazard-red)' : '#fff', marginTop: '2px' }}>
              {item.current_stock !== null ? `${item.current_stock.toLocaleString()} ${item.unit}` : 'Stock unavailable'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MIN REQUIRED</div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--cyan-300)', marginTop: '2px' }}>
              {item.minimum_quantity.toLocaleString()} {item.unit}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SURPLUS / DEFICIT</div>
            <div style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: item.surplus_deficit !== null && item.surplus_deficit < 0 ? 'var(--hazard-red)' : 'var(--hazard-green)',
              marginTop: '2px'
            }}>
              {item.surplus_deficit !== null ? `${item.surplus_deficit > 0 ? '+' : ''}${item.surplus_deficit.toLocaleString()} ${item.unit}` : '—'}
            </div>
          </div>
        </div>

        {/* Burn Rate & Consumption Trend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>7-DAY BURN RATE</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: item.burn_rate_value ? 'var(--cyan-300)' : 'var(--text-muted)' }}>
              {item.burn_rate_text}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {item.consumption_record_count} real consumption records evaluated
            </div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>CONSUMPTION TREND</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-badge ${item.trend === 'INCREASING' ? 'badge-danger' : item.trend === 'DECREASING' ? 'badge-success' : item.trend === 'STABLE' ? 'badge-info' : 'badge-muted'}`}>
                {item.trend}
              </span>
              {item.trend_pct !== null && (
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  ({item.trend_pct > 0 ? '+' : ''}{item.trend_pct}%)
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Deterministic recent 7d vs prior 7d comparison
            </div>
          </div>
        </div>

        {/* Forecast & Risk Level */}
        <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>FORECAST / DAYS REMAINING</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
              {item.forecast_status}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OPERATIONAL RISK</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: riskColor, marginTop: '2px' }}>
              {item.risk_level} ({item.risk_score}%)
            </div>
          </div>
        </div>

        {/* WHY THIS WAS FLAGGED */}
        <div style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--hazard-red)', fontFamily: 'var(--font-mono)', letterSpacing: '0.8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={13} />
            WHY THIS WAS FLAGGED
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {item.why_flagged && item.why_flagged.length > 0 ? (
              item.why_flagged.map((factor, idx) => (
                <li key={idx} style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {factor}
                </li>
              ))
            ) : (
              <li style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Stock reserve satisfies minimum operational threshold.
              </li>
            )}
          </ul>
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
          • Deterministic calculation based on active database telemetry and StationResourceRequirement thresholds. No machine learning or artificial intelligence claims.
        </div>
      </div>
    </QuickModal>
  );
}

// ─── STATION RESOURCE REQUIREMENTS VIEW (PASS 2 + PASS 3) ──────────────────
function StationRequirementsView({
  intelList = [],
  loading = false,
  stations = [],
  selectedStationId = '',
  onStationChange,
  isStationHead = false,
  isDirectorOrAdmin = false,
  userStationName = '',
  onRefresh,
  onOpenExplain,
  onRequestTransfer
}) {
  const urgentCount = intelList.filter(i => i.risk_level === 'URGENT').length;
  const criticalCount = intelList.filter(i => i.risk_level === 'CRITICAL').length;
  const lowCount = intelList.filter(i => i.risk_level === 'LOW').length;
  const normalCount = intelList.filter(i => i.risk_level === 'NORMAL').length;

  return (
    <div className="station-requirements-view">
      {/* Station Scope & Context Banner */}
      <div className="station-context-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Building size={16} style={{ color: 'var(--cyan-400)' }} />
          {isStationHead ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="station-context-pill">
                Assigned Station: {userStationName || 'Maitri Station'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Station-scoped view • Restricted to assigned facility only
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Polar Facility:</span>
              <select
                className="inventory-filter-select"
                value={selectedStationId}
                onChange={e => onStationChange(e.target.value)}
                style={{ minWidth: '220px' }}
              >
                <option value="">All Polar Facilities & Outposts</option>
                {stations.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.type})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Director / Admin System-wide Access
              </span>
            </div>
          )}
        </div>

        <button
          className="btn-secondary"
          onClick={onRefresh}
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          <RefreshCw size={13} className={loading ? 'radar-sweep-icon' : ''} />
          Refresh Telemetry
        </button>
      </div>

      {/* Summary Stat Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL REQUIREMENTS</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{intelList.length}</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '10px', color: 'var(--hazard-red)', fontFamily: 'var(--font-mono)' }}>URGENT DEFICITS</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--hazard-red)', marginTop: '2px' }}>{urgentCount}</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '10px', color: 'var(--hazard-amber)', fontFamily: 'var(--font-mono)' }}>CRITICAL RISKS</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--hazard-amber)', marginTop: '2px' }}>{criticalCount}</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '10px', color: 'var(--hazard-green)', fontFamily: 'var(--font-mono)' }}>NOMINAL BUFFERS</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--hazard-green)', marginTop: '2px' }}>{normalCount + lowCount}</div>
        </div>
      </div>

      {/* Table Panel */}
      <div className="inventory-table-panel">
        <div className="inventory-table-header">
          <div className="inventory-table-title-group">
            <Boxes size={16} className="inventory-table-icon" />
            <span className="inventory-table-title">Persisted Station Resource Requirements & Burn Rates</span>
            <span className="inventory-count-badge">{intelList.length} REQUIREMENTS</span>
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            NCPOR Antarctic Operations • Deterministic 7-Day Burn Rate
          </span>
        </div>

        {loading ? (
          <div className="cargo-loading">
            <Loader size={18} className="radar-sweep-icon" /> Computing burn rates and inventory intelligence…
          </div>
        ) : intelList.length === 0 ? (
          <div className="cargo-empty-state">
            <Building size={22} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No station resource requirements configured.</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Requirements can be defined by Expedition Directors in Station Management.</p>
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Current Stock</th>
                  <th>Min Required</th>
                  <th>Surplus / Deficit</th>
                  <th>7-Day Burn Rate</th>
                  <th>Trend</th>
                  <th>Forecast / Runway</th>
                  <th>Risk Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {intelList.map(req => {
                  const hasStock = req.current_stock !== null;
                  const isDeficit = req.surplus_deficit !== null && req.surplus_deficit < 0;
                  const isUrgentOrCrit = req.risk_level === 'URGENT' || req.risk_level === 'CRITICAL';

                  return (
                    <tr key={req.requirement_id} onClick={() => onOpenExplain(req)}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={12} style={{ color: 'var(--cyan-400)' }} />
                          {req.station_name}
                        </div>
                      </td>
                      <td>
                        <span className="item-code-cell">{req.item_code}</span>
                      </td>
                      <td style={{ fontWeight: 500, color: '#fff' }}>
                        {req.item_name}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {hasStock ? (
                          <span style={{ color: req.current_stock <= req.minimum_quantity ? 'var(--hazard-red)' : '#fff' }}>
                            {req.current_stock.toLocaleString()} {req.unit}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                            Stock unavailable
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan-300)' }}>
                        {req.minimum_quantity.toLocaleString()} {req.unit}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                        {req.surplus_deficit !== null ? (
                          <span style={{ color: isDeficit ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
                            {req.surplus_deficit > 0 ? '+' : ''}{req.surplus_deficit.toLocaleString()} {req.unit}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                        <span style={{ color: req.burn_rate_value ? 'var(--cyan-300)' : 'var(--text-muted)' }}>
                          {req.burn_rate_text}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${req.trend === 'INCREASING' ? 'badge-danger' : req.trend === 'DECREASING' ? 'badge-success' : req.trend === 'STABLE' ? 'badge-info' : 'badge-muted'}`}>
                          {req.trend}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                        <span style={{ color: isUrgentOrCrit ? 'var(--hazard-red)' : 'var(--text-secondary)' }}>
                          {req.forecast_status}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${req.risk_level === 'URGENT' || req.risk_level === 'CRITICAL' ? 'badge-danger' : req.risk_level === 'LOW' ? 'badge-warning' : 'badge-success'}`}>
                          {req.risk_level}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            className="req-explain-btn"
                            onClick={() => onOpenExplain(req)}
                            title="View contributing factors and explainability analysis"
                          >
                            <Eye size={12} /> Explain
                          </button>
                          {isDeficit && onRequestTransfer && (
                            <button
                              className="req-explain-btn"
                              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                              onClick={(e) => { e.stopPropagation(); onRequestTransfer(req, stations.find(s => s.id === req.station_id)); }}
                              title="Request cross-station transfer to cover this shortage"
                            >
                              <Truck size={12} /> Transfer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN: INVENTORY PAGE ───────────────────────────────────────────────────
export default function InventoryPage({ currentUser }) {
  const user = currentUser || api.getStoredUser() || {};
  const userRole = (user.role || '').toUpperCase();
  const isStationHead = userRole === 'STATION_HEAD';
  const isDirectorOrAdmin = userRole === 'ADMIN' || userRole === 'EXPEDITION_DIRECTOR';
  const canAddInventory = isDirectorOrAdmin || userRole === 'LOGISTICS_OFFICER';
  const canRecordConsumption = isDirectorOrAdmin || isStationHead;
  const canPerformStockOp = isDirectorOrAdmin || userRole === 'LOGISTICS_OFFICER';

  const [viewMode, setViewMode] = useState('catalog'); // 'catalog' | 'station-requirements' | 'readiness' | 'transfers'
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expeditions, setExpeditions] = useState([]);
  const [readinessList, setReadinessList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [readinessLoading, setReadinessLoading] = useState(false);
  
  // Station Intelligence State (Pass 2)
  const [stationIntel, setStationIntel] = useState([]);
  const [stationIntelLoading, setStationIntelLoading] = useState(false);
  const [stations, setStations] = useState([]);
  const [selectedStationFilter, setSelectedStationFilter] = useState('');
  const [explainModalItem, setExplainModalItem] = useState(null);
  
  // Pass 3: Transfer + Consumption state
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [transferModalItem, setTransferModalItem] = useState(null); // { req, station }
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expeditionFilter, setExpeditionFilter] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState(null);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [stockModalItem, setStockModalItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Load Inventory Catalog
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sumData, expList] = await Promise.all([
        api.getInventory({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          expedition_id: expeditionFilter || undefined,
          search: search || undefined
        }),
        api.getInventorySummary(),
        api.getExpeditions()
      ]);
      setItems(list || []);
      setSummary(sumData);
      setExpeditions(expList || []);
    } catch (err) {
      console.error('[InventoryPage] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, expeditionFilter, search]);

  // Load Expedition Readiness
  const loadReadiness = useCallback(async () => {
    setReadinessLoading(true);
    try {
      const data = await api.getExpeditionReadiness();
      setReadinessList(data || []);
    } catch (err) {
      console.error('[InventoryPage] Readiness load error:', err);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  // Load Station Intelligence (Pass 2)
  const loadStationIntel = useCallback(async () => {
    setStationIntelLoading(true);
    try {
      const param = isStationHead ? null : (selectedStationFilter || null);
      const data = await api.getStationInventoryIntelligence(param);
      setStationIntel(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[InventoryPage] Station intel load error:', err);
    } finally {
      setStationIntelLoading(false);
    }
  }, [isStationHead, selectedStationFilter]);

  // Load Stations List (for Director/Admin filter)
  const loadStationsList = useCallback(async () => {
    try {
      const data = await api.getStations();
      setStations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[InventoryPage] Stations load error:', err);
    }
  }, []);

  useEffect(() => {
    loadStationsList();
  }, [loadStationsList]);

  useEffect(() => {
    loadStationIntel();
  }, [loadStationIntel]);

  useEffect(() => {
    const t = setTimeout(loadInventory, 300);
    return () => clearTimeout(t);
  }, [loadInventory]);

  useEffect(() => {
    if (viewMode === 'readiness') {
      loadReadiness();
    } else if (viewMode === 'station-requirements') {
      loadStationIntel();
    } else if (viewMode === 'transfers') {
      loadTransfers();
    }
  }, [viewMode, loadReadiness, loadStationIntel]);

  // Pass 3: load transfers
  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try {
      const data = await api.getTransfers();
      setTransfers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[InventoryPage] Transfers load error:', err);
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  // Quick stat card click filter
  const handleStatFilter = (statusVal) => {
    if (activeStatFilter === statusVal) {
      setActiveStatFilter(null);
      setStatusFilter('ALL');
    } else {
      setActiveStatFilter(statusVal);
      setStatusFilter(statusVal);
    }
  };

  const STAT_CARDS = summary ? [
    { label: 'Total Items', value: summary.total_items, icon: Boxes, iconClass: 'icon-cyan', cardClass: '', filter: null },
    { label: 'Low Stock', value: summary.low_stock, icon: AlertTriangle, iconClass: 'icon-warning', cardClass: 'stat-warning', filter: 'LOW_STOCK' },
    { label: 'Critical', value: summary.critical, icon: ShieldAlert, iconClass: 'icon-danger', cardClass: 'stat-danger', filter: 'CRITICAL' },
    { label: 'Out of Stock', value: summary.out_of_stock, icon: XCircle, iconClass: 'icon-danger', cardClass: 'stat-danger', filter: 'OUT_OF_STOCK' },
    { label: 'Total Volume', value: summary.total_quantity.toLocaleString(), icon: Layers, iconClass: 'icon-info', cardClass: 'stat-info', filter: null }
  ] : [];

  const STAT_SUB = [
    'Cataloged resources',
    'Approaching safety reserve',
    'Below minimum threshold',
    'Stockout emergency',
    'Combined resource units'
  ];

  return (
    <div className="inventory-page">
      {/* ─── Page Header ─── */}
      <div className="inventory-page-header">
        <div className="inventory-header-info">
          <div className="inventory-module-badge">
            <Boxes size={13} />
            Smart Inventory & Requisitions Telemetry — SIH26062
          </div>
          <h2>Station Supplies & Expedition Inventory</h2>
          <p>
            Autonomous tracking of Antarctic life support consumables, sub-zero aviation fuel (Jet A-1), 
            cryogenic medical stores, and multi-mission expedition readiness reserves.
          </p>
        </div>
        <div className="inventory-header-actions">
          <button 
            className="btn-secondary" 
            onClick={() => { loadInventory(); if (viewMode === 'readiness') loadReadiness(); }}
            title="Sync inventory data from SQLite database"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={loading || readinessLoading ? 'radar-sweep-icon' : ''} />
            Sync Stock
          </button>
          {/* Pass 3: Record Consumption button */}
          {canRecordConsumption && (
            <button
              className="btn-secondary"
              onClick={() => setShowConsumptionModal(true)}
              title="Record daily resource consumption (updates inventory stock)"
              style={{ padding: '8px 12px', color: 'var(--hazard-green)', borderColor: 'rgba(16,185,129,0.3)' }}
            >
              <ClipboardList size={14} />
              Record Consumption
            </button>
          )}
          {canAddInventory && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* ─── Summary Stat Cards Row ─── */}
      <div className="inventory-stats-grid">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const isActive = card.filter && activeStatFilter === card.filter;
          return (
            <div
              key={card.label}
              className={`inventory-stat-card ${card.cardClass} ${isActive ? 'active-filter' : ''}`}
              onClick={() => card.filter && handleStatFilter(card.filter)}
              style={{ cursor: card.filter ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={`inventory-stat-icon ${card.iconClass}`}>
                  <Icon size={17} />
                </div>
                {card.filter && isActive && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--cyan-400)', border: '1px solid var(--border-medium)', borderRadius: 4, padding: '1px 5px' }}>
                    FILTERED
                  </span>
                )}
              </div>
              <div className="inventory-stat-value">{summary ? card.value : '—'}</div>
              <div className="inventory-stat-label">{card.label}</div>
              <div className="inventory-stat-sublabel">{STAT_SUB[i]}</div>
            </div>
          );
        })}
      </div>

      {/* ─── Navigation View Switcher (Catalog vs Station Requirements vs Readiness) ─── */}
      <div className="inventory-view-switcher">
        <button
          className={`view-switch-btn ${viewMode === 'catalog' ? 'active' : ''}`}
          onClick={() => setViewMode('catalog')}
        >
          <Boxes size={15} />
          Inventory Resource Catalog
          <span className="view-badge-count">{items.length}</span>
        </button>
        <button
          className={`view-switch-btn ${viewMode === 'station-requirements' ? 'active' : ''}`}
          onClick={() => { setViewMode('station-requirements'); loadStationIntel(); }}
        >
          <Building size={15} />
          Station Requirements & Burn Rates
          <span className="view-badge-count">{stationIntel.length} Monitored</span>
        </button>
        <button
          className={`view-switch-btn ${viewMode === 'readiness' ? 'active' : ''}`}
          onClick={() => setViewMode('readiness')}
        >
          <Compass size={15} />
          Expedition Readiness & Requisitions
          <span className="view-badge-count">{expeditions.length} Missions</span>
        </button>
      </div>

      {/* ─── VIEW 1: INVENTORY CATALOG ─── */}
      {viewMode === 'catalog' && (
        <>
          {/* Controls Bar */}
          <div className="inventory-control-bar">
            {/* Search */}
            <div className="inventory-search-wrap">
              <Search size={14} />
              <input
                className="inventory-search-input"
                type="text"
                placeholder="Search by code, item name, category, storage location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {isStationHead && (
              <span className="station-context-pill" title="Station Head Scoped Context">
                <Building size={12} /> {user.assigned_station_name || (stations.find(s => s.id === user.assigned_station_id)?.name) || 'Maitri Station'} (Assigned)
              </span>
            )}

            <div className="inventory-control-divider" />

            {/* Category Filter */}
            <span className="inventory-filter-label"><Filter size={11} style={{ display: 'inline', marginRight: 4 }} />Category</span>
            <select
              className="inventory-filter-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status Filter */}
            <span className="inventory-filter-label">Status</span>
            <select
              className="inventory-filter-select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setActiveStatFilter(null); }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>

            {/* Expedition Filter */}
            <span className="inventory-filter-label">Expedition</span>
            <select
              className="inventory-filter-select"
              value={expeditionFilter}
              onChange={e => setExpeditionFilter(e.target.value)}
            >
              <option value="">All Expeditions & General</option>
              {expeditions.map(exp => <option key={exp.id} value={exp.id}>{exp.name}</option>)}
            </select>

            {/* Clear button */}
            {(search || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || expeditionFilter) && (
              <button
                className="btn-secondary"
                style={{ padding: '7px 12px', fontSize: 11 }}
                onClick={() => { setSearch(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); setExpeditionFilter(''); setActiveStatFilter(null); }}
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>

          {/* Table Panel */}
          <div className="inventory-table-panel">
            <div className="inventory-table-header">
              <div className="inventory-table-title-group">
                <Boxes size={16} className="inventory-table-icon" />
                <span className="inventory-table-title">Active Station Consumables & Equipment Buffers</span>
                <span className="inventory-count-badge">{items.length} ITEMS</span>
              </div>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                NCPOR Cold-Chain Standard • Real-time Backend Sync
              </span>
            </div>

            {loading ? (
              <div className="cargo-loading">
                <Loader size={18} className="radar-sweep-icon" /> Loading inventory catalog from SQLite database…
              </div>
            ) : items.length === 0 ? (
              <div className="cargo-empty-state">
                <div className="cargo-empty-icon"><Boxes size={22} /></div>
                <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)' }}>No inventory items matched your active filters.</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Try adjusting search parameters or register a new resource item.</p>
              </div>
            ) : (
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Stock vs Min Required</th>
                      <th>Unit</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th className="inventory-col-updated-th">Last Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr 
                        key={item.id}
                        className={selectedItemId === item.id ? 'selected-row' : ''}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <td>
                          <span className="item-code-cell">{item.item_code}</span>
                        </td>
                        <td>
                          <span className="item-name-cell" title={item.item_name}>
                            {item.item_name}
                          </span>
                        </td>
                        <td>
                          <span className="item-category-pill">{item.category}</span>
                        </td>
                        <td>
                          <StockMeter 
                            quantity={item.quantity} 
                            minQuantity={item.minimum_quantity} 
                            status={item.status} 
                          />
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {item.unit}
                        </td>
                        <td>
                          <span className="item-location-cell" title={item.location}>
                            {item.location}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="inventory-col-updated">
                          {item.updated_at ? item.updated_at.replace('T', ' ').substring(0, 16) : 'Recent'}
                        </td>
                        <td>
                          <div className="item-actions-group" onClick={e => e.stopPropagation()}>
                            <button
                              className="inv-action-btn"
                              onClick={() => setSelectedItemId(item.id)}
                              title="View item specs and transaction log"
                            >
                              <Eye size={12} /> View
                            </button>
                            {canPerformStockOp && (
                              <button
                                className="inv-action-btn btn-stock-quick"
                                onClick={() => setStockModalItem(item)}
                                title="Perform Stock In / Stock Out / Adjustment"
                              >
                                <Edit3 size={12} /> Stock Op
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── VIEW 2: STATION REQUIREMENTS & INTELLIGENCE (PASS 2 + 3) ─── */}
      {viewMode === 'station-requirements' && (
        <StationRequirementsView
          intelList={stationIntel}
          loading={stationIntelLoading}
          stations={stations}
          selectedStationId={selectedStationFilter}
          onStationChange={setSelectedStationFilter}
          isStationHead={isStationHead}
          isDirectorOrAdmin={isDirectorOrAdmin}
          userStationName={user.assigned_station_name || (stations.find(s => s.id === user.assigned_station_id)?.name) || 'Maitri Station'}
          onRefresh={loadStationIntel}
          onOpenExplain={(item) => setExplainModalItem(item)}
          onRequestTransfer={(req, station) => setTransferModalItem({ req, station })}
        />
      )}

      {/* ─── VIEW 3: EXPEDITION READINESS ─── */}
      {viewMode === 'readiness' && (
        <ExpeditionReadinessView
          readinessList={readinessList}
          loading={readinessLoading}
          onRefresh={loadReadiness}
        />
      )}

      {/* ─── VIEW 4: CROSS-STATION TRANSFERS (PASS 3) ─── */}
      {viewMode === 'transfers' && (
        <TransferManagementPanel
          transfers={transfers}
          loading={transfersLoading}
          isDirectorOrAdmin={isDirectorOrAdmin}
          currentUser={user}
          onRefresh={loadTransfers}
        />
      )}

      {/* ─── ADD ITEM MODAL ─── */}
      {showAddModal && (
        <AddInventoryModal
          expeditions={expeditions}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { loadInventory(); if (viewMode === 'readiness') loadReadiness(); }}
        />
      )}

      {/* ─── STOCK UPDATE MODAL ─── */}
      {stockModalItem && (
        <StockUpdateModal
          item={stockModalItem}
          onClose={() => setStockModalItem(null)}
          onUpdated={() => {
            loadInventory();
            if (viewMode === 'readiness') loadReadiness();
          }}
        />
      )}

      {/* ─── DETAIL SLIDE-OVER DRAWER ─── */}
      {selectedItemId && (
        <InventoryDetailPanel
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onRefreshList={loadInventory}
          onOpenStockModal={(item) => setStockModalItem(item)}
        />
      )}

      {/* ─── STATION RESOURCE EXPLAINABILITY MODAL (PASS 2) ─── */}
      {explainModalItem && (
        <StationResourceExplainModal
          item={explainModalItem}
          onClose={() => setExplainModalItem(null)}
        />
      )}

      {/* ─── RECORD CONSUMPTION MODAL (PASS 3) ─── */}
      {showConsumptionModal && (
        <RecordConsumptionModal
          stations={stations}
          inventoryItems={items}
          defaultStationId={isStationHead ? (user.assigned_station_id || null) : null}
          onClose={() => setShowConsumptionModal(false)}
          onRecorded={() => { loadInventory(); loadStationIntel(); }}
        />
      )}

      {/* ─── REQUEST TRANSFER MODAL (PASS 3) ─── */}
      {transferModalItem && (
        <RequestTransferModal
          destStation={transferModalItem.station || stations.find(s => s.id === transferModalItem.req?.station_id)}
          stations={stations}
          itemInfo={transferModalItem.req}
          onClose={() => setTransferModalItem(null)}
          onRequested={() => { loadTransfers(); setTransferModalItem(null); if (viewMode !== 'transfers') setViewMode('transfers'); }}
        />
      )}
    </div>
  );
}
