import React, { useState, useEffect } from 'react';
import { 
  X, 
  Box, 
  MapPin, 
  Clock, 
  QrCode, 
  Printer, 
  Download, 
  Edit3, 
  History, 
  Truck, 
  Thermometer, 
  ShieldCheck, 
  Save,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import StatusBadge from '../common/StatusBadge';
import CargoTimeline from './CargoTimeline';
import { api } from '../../services/api';

export default function CargoDetailModal({ cargoId, isOpen, onClose, onCargoUpdated }) {
  const [cargo, setCargo] = useState(null);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, update, qr, history
  const [isLoading, setIsLoading] = useState(true);
  
  // Status Update Form State
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateLocation, setUpdateLocation] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadDetails = async () => {
    if (!cargoId) return;
    setIsLoading(true);
    try {
      const data = await api.getCargoById(cargoId);
      if (data) {
        setCargo(data);
        setUpdateStatus(data.status);
        setUpdateLocation(data.current_location || data.origin);
        setUpdateNotes(data.notes || '');
        if (data.movements) {
          setMovements(data.movements);
        } else {
          const hist = await api.getCargoHistory(cargoId);
          setMovements(hist || []);
        }
      }
    } catch (err) {
      console.error('Error loading cargo details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cargoId) {
      loadDetails();
      setActiveTab('overview');
    }
  }, [isOpen, cargoId]);

  if (!isOpen) return null;

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await api.updateCargo(cargoId, {
        status: updateStatus,
        current_location: updateLocation,
        notes: updateNotes
      });
      await loadDetails();
      if (onCargoUpdated) onCargoUpdated();
      setActiveTab('overview');
      alert(`Cargo ${cargo.cargo_code} successfully updated to '${updateStatus}'. Movement history logged.`);
    } catch (err) {
      alert(`Failed to update cargo: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>POLAR-X Cargo Label — ${cargo?.cargo_code}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 30px; text-align: center; color: #000; }
            .label-card { border: 2px solid #000; border-radius: 12px; padding: 24px; max-width: 400px; margin: auto; }
            h2 { margin: 0 0 10px; font-size: 20px; }
            p { margin: 4px 0; font-size: 13px; text-align: left; }
            .qr-box { margin: 20px auto; }
            .badge { display: inline-block; background: #000; color: #fff; padding: 4px 10px; font-weight: bold; border-radius: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <span class="badge">NCPOR POLAR-X CARGO MANIFEST</span>
            <h2 style="margin-top: 14px;">${cargo?.cargo_code}</h2>
            <p><strong>Item:</strong> ${cargo?.name}</p>
            <p><strong>Category:</strong> ${cargo?.category}</p>
            <p><strong>Weight:</strong> ${cargo?.weight}</p>
            <p><strong>Origin:</strong> ${cargo?.origin}</p>
            <p><strong>Destination:</strong> ${cargo?.destination}</p>
            <p><strong>Priority:</strong> ${cargo?.priority}</p>
            <p><strong>Cold-Chain Temp:</strong> ${cargo?.temperature_log}</p>
            <div class="qr-box">
              ${document.getElementById('cargo-qr-code-svg')?.outerHTML || ''}
            </div>
            <p style="font-size: 10px; text-align: center; color: #555;">National Centre for Polar and Ocean Research (MoES)</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const qrPayload = `POLAR-X:${cargo?.cargo_code}|${cargo?.name}|${cargo?.weight}|${cargo?.origin}->${cargo?.destination}|PRIORITY:${cargo?.priority}|STATUS:${cargo?.status}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stat-icon-wrapper">
              <Box size={18} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0 }}>
                {cargo ? cargo.cargo_code : 'Cargo Item Details'}
                {cargo && <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}> — {cargo.name}</span>}
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                {cargo?.expedition_name || 'Polar Operations Directorate'}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="cargo-modal-tabs">
          <button 
            className={`cargo-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <FileText size={14} />
            Overview & Timeline
          </button>
          <button 
            className={`cargo-tab-btn ${activeTab === 'update' ? 'active' : ''}`}
            onClick={() => setActiveTab('update')}
          >
            <Edit3 size={14} />
            Update Status
          </button>
          <button 
            className={`cargo-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            Movement History ({movements.length})
          </button>
          <button 
            className={`cargo-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
            onClick={() => setActiveTab('qr')}
          >
            <QrCode size={14} />
            QR Code
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ minHeight: '380px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div className="radar-sweep-icon" style={{ display: 'inline-block', marginBottom: '10px' }}>
                <Box size={28} />
              </div>
              <p>Loading polar cargo telemetry...</p>
            </div>
          ) : !cargo ? (
            <p style={{ color: 'var(--hazard-red)' }}>Cargo item not found.</p>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & TIMELINE */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Status & Priority Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(8, 13, 26, 0.6)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Status:</span>
                      <StatusBadge status={cargo.status} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Priority Level:</span>
                      <StatusBadge status={cargo.priority} />
                    </div>
                  </div>

                  {/* Visual Shipment Timeline */}
                  <div className="command-panel" style={{ padding: '16px 20px', background: 'rgba(10, 15, 29, 0.9)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                        Shipment Traverse Timeline
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Stage: <strong style={{ color: '#fff' }}>{cargo.stage || cargo.status}</strong>
                      </span>
                    </div>
                    <CargoTimeline currentStage={cargo.stage} currentStatus={cargo.status} />
                  </div>

                  {/* Detailed Specs Grid */}
                  <div className="exp-metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Equipment / Item</span>
                      <span className="exp-metric-val" style={{ fontSize: '13px' }}>{cargo.name}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Category</span>
                      <span className="exp-metric-val">{cargo.category}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Net Weight</span>
                      <span className="exp-metric-val">{cargo.weight}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Origin Location</span>
                      <span className="exp-metric-val" style={{ fontSize: '12.5px' }}>{cargo.origin}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Final Destination</span>
                      <span className="exp-metric-val" style={{ fontSize: '12.5px', color: 'var(--cyan-300)' }}>{cargo.destination}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Transit Mode</span>
                      <span className="exp-metric-val" style={{ fontSize: '12.5px' }}>{cargo.transit_mode}</span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Current Checkpoint</span>
                      <span className="exp-metric-val" style={{ fontSize: '12.5px', color: '#fff' }}>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '3px', color: 'var(--cyan-400)' }} />
                        {cargo.current_location || cargo.origin}
                      </span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Cold-Chain Temp</span>
                      <span className="exp-metric-val" style={{ fontSize: '12.5px' }}>
                        <Thermometer size={12} style={{ display: 'inline', marginRight: '3px', color: 'var(--cyan-300)' }} />
                        {cargo.temperature_log}
                      </span>
                    </div>
                    <div className="exp-metric-item">
                      <span className="exp-metric-label">Last Updated</span>
                      <span className="exp-metric-val" style={{ fontSize: '12px' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {cargo.last_updated}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Remarks */}
                  {cargo.notes && (
                    <div style={{ background: 'rgba(8, 13, 26, 0.7)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Operational Notes & Condition
                      </span>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {cargo.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: UPDATE STATUS */}
              {activeTab === 'update' && (
                <form onSubmit={handleUpdateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid var(--border-medium)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ color: '#fff', fontSize: '13.5px', marginBottom: '4px' }}>
                      Update Cargo Checkpoint & Status
                    </h4>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      Changing the status or location automatically appends an authenticated timestamped entry to the cargo movement history.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                        Status State
                      </label>
                      <select 
                        className="search-input" 
                        value={updateStatus} 
                        onChange={(e) => setUpdateStatus(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px' }}
                        required
                      >
                        <option value="Preparing">Preparing (Warehouse)</option>
                        <option value="At Port">At Port (Customs / Staging)</option>
                        <option value="Loaded">Loaded (Vessel / Aircraft / Sled)</option>
                        <option value="In Transit">In Transit (Sea / Inland Traverse)</option>
                        <option value="Delivered">Delivered (Station Received)</option>
                        <option value="Delayed">Delayed (Storm / Weather Caution)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                        Current Location Checkpoint
                      </label>
                      <input 
                        type="text" 
                        className="search-input" 
                        value={updateLocation} 
                        onChange={(e) => setUpdateLocation(e.target.value)}
                        placeholder="e.g. Cape Town Port Berth 4, Queen Maud Traverse, Maitri Bay"
                        style={{ width: '100%', padding: '9px 12px' }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Movement Checkpoint Notes
                    </label>
                    <textarea 
                      className="search-input" 
                      rows={3}
                      value={updateNotes} 
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      placeholder="e.g. Offloaded from MV Vasiliy Golovnin via heavy barge. Sealed intact."
                      style={{ width: '100%', padding: '9px 12px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setActiveTab('overview')}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isUpdating}>
                      <Save size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      {isUpdating ? 'Saving Update...' : 'Commit Status Update'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: MOVEMENT HISTORY */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ color: '#fff', fontSize: '14px' }}>Audit Trail & Location Checkpoints</h4>
                    <span className="mono-badge" style={{ color: 'var(--cyan-300)' }}>{movements.length} CHECKPOINTS</span>
                  </div>

                  {movements.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                      No movement checkpoints recorded yet.
                    </p>
                  ) : (
                    <div className="movement-trail-list">
                      {movements.map((mov, idx) => (
                        <div key={mov.id || idx} className="movement-trail-item">
                          <div className="trail-dot-line">
                            <div className="trail-dot"></div>
                            {idx < movements.length - 1 && <div className="trail-line"></div>}
                          </div>
                          <div className="trail-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <StatusBadge status={mov.status} />
                                <strong style={{ color: '#fff', fontSize: '13px' }}>{mov.location}</strong>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {mov.timestamp}
                              </span>
                            </div>
                            {mov.notes && (
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {mov.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: QR CODE */}
              {activeTab === 'qr' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '10px 0' }}>
                  <div className="cargo-qr-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', textAlign: 'center', color: '#0f172a' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#0284c7', marginBottom: '8px' }}>
                      NCPOR POLAR-X ASSET TAG
                    </div>
                    <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontFamily: 'monospace' }}>
                      {cargo.cargo_code}
                    </h3>
                    
                    <div style={{ padding: '8px', background: '#fff', display: 'inline-block' }}>
                      <QRCodeSVG 
                        id="cargo-qr-code-svg"
                        value={qrPayload}
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#475569', textAlign: 'left', lineHeight: '1.4' }}>
                      <div><strong>Item:</strong> {cargo.name}</div>
                      <div><strong>Weight:</strong> {cargo.weight} • <strong>Dest:</strong> {cargo.destination}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-primary" onClick={handlePrintQR}>
                      <Printer size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      Download / Print QR Label
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
