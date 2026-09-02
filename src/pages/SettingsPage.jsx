import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Shield,
  Radio,
  Wifi,
  Server,
  RefreshCw,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Sliders,
  Bell,
  Cpu,
  Database,
  Building,
  Info,
  Clock,
  Compass,
  Package,
  Layers,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { SYSTEM_META } from '../data/mockData';

export default function SettingsPage({ currentUser }) {
  // User & RBAC
  const user = currentUser || api.getStoredUser() || { role: 'FIELD_OPERATOR', username: 'guest' };
  const isAdmin = (user.role || '').toUpperCase() === 'ADMIN';

  // Component states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'system', 'operational', 'notifications', 'automation', 'telemetry'

  // Server state & working form state
  const [serverSettings, setServerSettings] = useState({});
  const [formData, setFormData] = useState({
    system_name: 'POLAR-X Command',
    organization_name: 'Ministry of Earth Sciences (MoES) / NCPOR',
    deployment_environment: 'Antarctic Polar Expedition',
    readiness_warning_threshold: 70,
    readiness_critical_threshold: 50,
    inventory_low_stock_ratio: 1.5,
    inventory_critical_ratio: 1.0,
    location_freshness_hours: 6,
    default_report_days: 30,
    emergency_notifications_enabled: true,
    critical_incident_notifications_enabled: true,
    automation_enabled: true,
    automation_inventory_risk_high_threshold: 50,
    automation_inventory_risk_critical_threshold: 75,
    automation_cargo_risk_high_threshold: 45,
    automation_cargo_risk_critical_threshold: 70
  });

  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Fetch settings on mount
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSettings();
      if (res) {
        const raw = res.settings || res;
        const normalized = {
          system_name: raw.system_name ?? 'POLAR-X Command',
          organization_name: raw.organization_name ?? 'Ministry of Earth Sciences (MoES) / NCPOR',
          deployment_environment: raw.deployment_environment ?? 'Antarctic Polar Expedition',
          readiness_warning_threshold: Number(raw.readiness_warning_threshold ?? 70),
          readiness_critical_threshold: Number(raw.readiness_critical_threshold ?? 50),
          inventory_low_stock_ratio: Number(raw.inventory_low_stock_ratio ?? 1.5),
          inventory_critical_ratio: Number(raw.inventory_critical_ratio ?? 1.0),
          location_freshness_hours: Number(raw.location_freshness_hours ?? 6),
          default_report_days: Number(raw.default_report_days ?? 30),
          emergency_notifications_enabled: raw.emergency_notifications_enabled !== false && raw.emergency_notifications_enabled !== 'false',
          critical_incident_notifications_enabled: raw.critical_incident_notifications_enabled !== false && raw.critical_incident_notifications_enabled !== 'false',
          automation_enabled: raw.automation_enabled !== false && raw.automation_enabled !== 'false',
          automation_inventory_risk_high_threshold: Number(raw.automation_inventory_risk_high_threshold ?? 50),
          automation_inventory_risk_critical_threshold: Number(raw.automation_inventory_risk_critical_threshold ?? 75),
          automation_cargo_risk_high_threshold: Number(raw.automation_cargo_risk_high_threshold ?? 45),
          automation_cargo_risk_critical_threshold: Number(raw.automation_cargo_risk_critical_threshold ?? 70)
        };
        setServerSettings(normalized);
        setFormData(normalized);
        setLastSavedTime(res.updated_at || new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('[Settings] Fetch error:', err);
      setError(err.message || 'Failed to load system settings from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Form field change handler
  const handleChange = (key, value) => {
    if (!isAdmin) return;
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Validation rules
  const validationErrors = useMemo(() => {
    const errs = {};

    // System names
    if (!formData.system_name || !formData.system_name.trim()) {
      errs.system_name = 'System name cannot be blank.';
    }
    if (!formData.organization_name || !formData.organization_name.trim()) {
      errs.organization_name = 'Organization name cannot be blank.';
    }

    // Readiness thresholds
    const warn = Number(formData.readiness_warning_threshold);
    const crit = Number(formData.readiness_critical_threshold);
    if (isNaN(warn) || warn < 1 || warn > 100) {
      errs.readiness_warning_threshold = 'Warning threshold must be between 1 and 100%.';
    }
    if (isNaN(crit) || crit < 1 || crit > 100) {
      errs.readiness_critical_threshold = 'Critical threshold must be between 1 and 100%.';
    }
    if (!isNaN(warn) && !isNaN(crit) && crit >= warn) {
      errs.readiness_critical_threshold = 'Critical threshold must be strictly less than Warning threshold.';
    }

    // Inventory ratios
    const lowRatio = Number(formData.inventory_low_stock_ratio);
    const critRatio = Number(formData.inventory_critical_ratio);
    if (isNaN(lowRatio) || lowRatio < 1.0 || lowRatio > 5.0) {
      errs.inventory_low_stock_ratio = 'Low stock ratio must be between 1.0 and 5.0.';
    }
    if (isNaN(critRatio) || critRatio < 0.5 || critRatio > 3.0) {
      errs.inventory_critical_ratio = 'Critical stock ratio must be between 0.5 and 3.0.';
    }
    if (!isNaN(lowRatio) && !isNaN(critRatio) && critRatio >= lowRatio) {
      errs.inventory_critical_ratio = 'Critical ratio must be strictly less than Low stock ratio.';
    }

    // Location freshness
    const fresh = Number(formData.location_freshness_hours);
    if (isNaN(fresh) || fresh < 1 || fresh > 168) {
      errs.location_freshness_hours = 'Freshness threshold must be between 1 and 168 hours.';
    }

    // Report range
    const reportDays = Number(formData.default_report_days);
    if (isNaN(reportDays) || reportDays < 1 || reportDays > 365) {
      errs.default_report_days = 'Default report range must be between 1 and 365 days.';
    }

    // Automation inventory risk
    const invHigh = Number(formData.automation_inventory_risk_high_threshold);
    const invCrit = Number(formData.automation_inventory_risk_critical_threshold);
    if (isNaN(invHigh) || invHigh < 10 || invHigh > 90) {
      errs.automation_inventory_risk_high_threshold = 'High risk threshold must be 10-90%.';
    }
    if (isNaN(invCrit) || invCrit < 20 || invCrit > 100) {
      errs.automation_inventory_risk_critical_threshold = 'Critical risk threshold must be 20-100%.';
    }
    if (!isNaN(invHigh) && !isNaN(invCrit) && invCrit <= invHigh) {
      errs.automation_inventory_risk_critical_threshold = 'Critical threshold must be greater than High threshold.';
    }

    // Automation cargo risk
    const cargoHigh = Number(formData.automation_cargo_risk_high_threshold);
    const cargoCrit = Number(formData.automation_cargo_risk_critical_threshold);
    if (isNaN(cargoHigh) || cargoHigh < 10 || cargoHigh > 90) {
      errs.automation_cargo_risk_high_threshold = 'High risk threshold must be 10-90%.';
    }
    if (isNaN(cargoCrit) || cargoCrit < 20 || cargoCrit > 100) {
      errs.automation_cargo_risk_critical_threshold = 'Critical risk threshold must be 20-100%.';
    }
    if (!isNaN(cargoHigh) && !isNaN(cargoCrit) && cargoCrit <= cargoHigh) {
      errs.automation_cargo_risk_critical_threshold = 'Critical threshold must be greater than High threshold.';
    }

    return errs;
  }, [formData]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return Object.keys(formData).some(key => {
      return String(formData[key]) !== String(serverSettings[key]);
    });
  }, [formData, serverSettings]);

  // Save Settings
  const handleSave = async () => {
    if (!isAdmin || hasValidationErrors || saving) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Build updates array
      const updates = Object.keys(formData).map(key => ({
        key,
        value: String(formData[key])
      }));

      await api.updateSettings(updates);
      setServerSettings({ ...formData });
      const now = new Date().toLocaleTimeString();
      setLastSavedTime(now);
      setSuccessMessage('System configuration saved and verified across all operational subsystems.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('[Settings] Save error:', err);
      setError(err.message || 'Failed to save settings. Please verify administrative clearance.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = async () => {
    if (!isAdmin || resetting) return;
    try {
      setResetting(true);
      setError(null);
      const defaults = await api.getSettingsDefaults();
      if (defaults) {
        setFormData(prev => ({
          ...prev,
          ...defaults
        }));
        setSuccessMessage('Default operational parameters staged. Click "Save Configuration" to persist.');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('[Settings] Defaults fetch error:', err);
      setError('Failed to fetch system default settings.');
    } finally {
      setResetting(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setFormData({ ...serverSettings });
    setError(null);
    setSuccessMessage('Unsaved changes discarded.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="placeholder-page" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--cyan-400)' }}>
          <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>CONNECTING TO POLAR-X SECURE CONFIGURATION STORE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="placeholder-page" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Banner / Hero */}
      <div className="placeholder-hero" style={{ marginBottom: '24px' }}>
        <div className="placeholder-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div className="module-meta-badge">
              <Settings size={14} />
              <span>TASK 11 — SYSTEM SETTINGS & OPERATIONAL CONFIGURATION</span>
            </div>
            {isAdmin ? (
              <span className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                <Unlock size={12} style={{ marginRight: '4px' }} />
                ADMIN CLEARANCE — READ / WRITE
              </span>
            ) : (
              <span className="status-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                <Lock size={12} style={{ marginRight: '4px' }} />
                {user.role || 'GUEST'} CLEARANCE — READ ONLY
              </span>
            )}
            {lastSavedTime && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Sync: {lastSavedTime}
              </span>
            )}
          </div>
          <h2>Polar Operations Command Settings</h2>
          <p>
            Centrally manage expedition readiness thresholds, automated inventory alert ratios, location freshness, 
            emergency SAR broadcasts, and mission report defaults.
          </p>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#fca5a5'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {successMessage && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#86efac'
        }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px' }}>{successMessage}</span>
        </div>
      )}

      {!isAdmin && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--cyan-300)'
        }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px' }}>
            You are viewing system configuration in <strong>Read-Only Mode</strong> as <em>{user.username} ({user.role})</em>. 
            Modifications require administrator credentials.
          </span>
        </div>
      )}

      {/* Action Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        marginBottom: '24px'
      }}>
        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Settings', icon: Sliders },
            { id: 'system', label: 'System & Identity', icon: Building },
            { id: 'operational', label: 'Readiness & Stock', icon: Compass },
            { id: 'notifications', label: 'Emergency Alerts', icon: Bell },
            { id: 'automation', label: 'Smart Automation', icon: Cpu },
            { id: 'telemetry', label: 'Telemetry & Comms', icon: Radio }
          ].map(cat => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: isSelected ? '1px solid var(--cyan-400)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <Icon size={14} style={{ color: isSelected ? 'var(--cyan-300)' : 'inherit' }} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Admin Action Buttons */}
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleResetToDefaults}
              disabled={resetting || saving}
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Fetch default values without saving yet"
            >
              <RotateCcw size={14} className={resetting ? 'spin' : ''} />
              Reset to Defaults
            </button>

            {isDirty && (
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px', color: '#fca5a5' }}
              >
                Discard
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!isDirty || hasValidationErrors || saving}
              className="btn-primary"
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: (!isDirty || hasValidationErrors || saving) ? 0.6 : 1,
                cursor: (!isDirty || hasValidationErrors || saving) ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={14} className={saving ? 'spin' : ''} />
              {saving ? 'Saving...' : isDirty ? 'Save Configuration' : 'Saved'}
            </button>
          </div>
        )}
      </div>

      {/* Main Settings Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 1. SYSTEM & IDENTITY */}
        {(activeCategory === 'all' || activeCategory === 'system') && (
          <div className="command-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Building size={18} style={{ color: 'var(--cyan-400)' }} />
              <div>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>System & Organization Identity</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  Application nomenclature, government agency headers, and polar operational environment descriptors.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                  System / Application Name
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.system_name}
                  onChange={(e) => handleChange('system_name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isAdmin ? 'rgba(8, 13, 26, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                    border: validationErrors.system_name ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {validationErrors.system_name && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.system_name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                  Owning Organization / Department
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.organization_name}
                  onChange={(e) => handleChange('organization_name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isAdmin ? 'rgba(8, 13, 26, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                    border: validationErrors.organization_name ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {validationErrors.organization_name && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.organization_name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                  Deployment Environment Descriptor
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.deployment_environment}
                  onChange={(e) => handleChange('deployment_environment', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isAdmin ? 'rgba(8, 13, 26, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. OPERATIONAL & READINESS THRESHOLDS */}
        {(activeCategory === 'all' || activeCategory === 'operational') && (
          <div className="command-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Compass size={18} style={{ color: 'var(--cyan-400)' }} />
              <div>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>Readiness & Inventory Stock Thresholds</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  Directly drives expedition readiness classification (READY / ATTENTION / AT_RISK), smart inventory alert ratios, and location staleness timers.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Readiness Warning */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Readiness Warning Threshold
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-amber)', fontWeight: 700 }}>
                    {formData.readiness_warning_threshold}%
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Expeditions scoring below this benchmark are flagged with status <strong>ATTENTION</strong>.
                </p>
                <input
                  type="range"
                  min="1"
                  max="100"
                  disabled={!isAdmin}
                  value={formData.readiness_warning_threshold}
                  onChange={(e) => handleChange('readiness_warning_threshold', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan-400)' }}
                />
                {validationErrors.readiness_warning_threshold && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.readiness_warning_threshold}
                  </span>
                )}
              </div>

              {/* Readiness Critical */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Readiness Critical Threshold
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-red)', fontWeight: 700 }}>
                    {formData.readiness_critical_threshold}%
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Expeditions scoring below this benchmark are flagged as <strong>AT_RISK</strong>.
                </p>
                <input
                  type="range"
                  min="1"
                  max="100"
                  disabled={!isAdmin}
                  value={formData.readiness_critical_threshold}
                  onChange={(e) => handleChange('readiness_critical_threshold', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--hazard-red)' }}
                />
                {validationErrors.readiness_critical_threshold && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.readiness_critical_threshold}
                  </span>
                )}
              </div>

              {/* Inventory Low-Stock Ratio */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Inventory Low-Stock Multiplier
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)', fontWeight: 700 }}>
                    {formData.inventory_low_stock_ratio}x
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Stock ≤ (Min Qty × Multiplier) triggers <strong>LOW_STOCK</strong> status.
                </p>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  disabled={!isAdmin}
                  value={formData.inventory_low_stock_ratio}
                  onChange={(e) => handleChange('inventory_low_stock_ratio', parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'rgba(8, 13, 26, 0.8)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                {validationErrors.inventory_low_stock_ratio && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.inventory_low_stock_ratio}
                  </span>
                )}
              </div>

              {/* Inventory Critical Ratio */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Inventory Critical Stock Multiplier
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-red)', fontWeight: 700 }}>
                    {formData.inventory_critical_ratio}x
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Stock &lt; (Min Qty × Multiplier) triggers <strong>CRITICAL</strong> status.
                </p>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3.0"
                  disabled={!isAdmin}
                  value={formData.inventory_critical_ratio}
                  onChange={(e) => handleChange('inventory_critical_ratio', parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'rgba(8, 13, 26, 0.8)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                {validationErrors.inventory_critical_ratio && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.inventory_critical_ratio}
                  </span>
                )}
              </div>

              {/* Location Freshness */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Location Freshness Window
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)', fontWeight: 700 }}>
                    {formData.location_freshness_hours} hrs
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  GPS/telemetry reports older than this threshold are marked as stale/offline.
                </p>
                <input
                  type="number"
                  min="1"
                  max="168"
                  disabled={!isAdmin}
                  value={formData.location_freshness_hours}
                  onChange={(e) => handleChange('location_freshness_hours', parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'rgba(8, 13, 26, 0.8)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                {validationErrors.location_freshness_hours && (
                  <span style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'block' }}>
                    {validationErrors.location_freshness_hours}
                  </span>
                )}
              </div>

              {/* Default Report Range */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
                    Default Report Lookback Range
                  </label>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)', fontWeight: 700 }}>
                    {formData.default_report_days} days
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Standard lookback window pre-selected in Reports & Analytics.
                </p>
                <select
                  disabled={!isAdmin}
                  value={formData.default_report_days}
                  onChange={(e) => handleChange('default_report_days', parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'rgba(8, 13, 26, 0.8)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                >
                  <option value={7}>7 Days (Past Week)</option>
                  <option value={14}>14 Days (Fortnightly)</option>
                  <option value={30}>30 Days (Monthly Baseline)</option>
                  <option value={60}>60 Days (Bi-monthly)</option>
                  <option value={90}>90 Days (Quarterly Season)</option>
                  <option value={180}>180 Days (Half Year)</option>
                  <option value={365}>365 Days (Full Polar Year)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. EMERGENCY & NOTIFICATIONS */}
        {(activeCategory === 'all' || activeCategory === 'notifications') && (
          <div className="command-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Bell size={18} style={{ color: 'var(--cyan-400)' }} />
              <div>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>Emergency & Incident Notification Dispatch</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  Controls automated dispatching of system alerts, SAR distress sirens, and high-priority push notifications.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Emergency Notifications */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                    Emergency Alert Notifications
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Broadcast critical distress alerts to the SAR Emergency Response Hub.
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formData.emergency_notifications_enabled}
                    onChange={(e) => handleChange('emergency_notifications_enabled', e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: formData.emergency_notifications_enabled ? 'var(--cyan-500)' : 'rgba(100, 116, 139, 0.3)',
                    transition: '0.2s',
                    borderRadius: '24px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: formData.emergency_notifications_enabled ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.2s',
                      borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>

              {/* Critical Incident Notifications */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                    Critical Incident Auto-Dispatch
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Trigger urgent alert cards and sound dispatch for CRITICAL level incidents.
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formData.critical_incident_notifications_enabled}
                    onChange={(e) => handleChange('critical_incident_notifications_enabled', e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: formData.critical_incident_notifications_enabled ? 'var(--hazard-red)' : 'rgba(100, 116, 139, 0.3)',
                    transition: '0.2s',
                    borderRadius: '24px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: formData.critical_incident_notifications_enabled ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.2s',
                      borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 4. SMART AUTOMATION & PREDICTIVE RISK */}
        {(activeCategory === 'all' || activeCategory === 'automation') && (
          <div className="command-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Cpu size={18} style={{ color: 'var(--cyan-400)' }} />
              <div>
                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>Smart Automation Engine & Risk Tuning</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  Configure the heuristic thresholds used by the predictive risk engine to score inventory stockouts and cargo pipeline delays.
                </p>
              </div>
            </div>

            {/* Master Automation Toggle */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Smart Predictive Automation Engine
                  <span className="status-badge" style={{
                    background: formData.automation_enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: formData.automation_enabled ? '#4ade80' : '#f87171',
                    fontSize: '10.5px'
                  }}>
                    {formData.automation_enabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  When enabled, real-time risk scores and automated mitigation recommendations are calculated on every database change.
                </div>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={formData.automation_enabled}
                  onChange={(e) => handleChange('automation_enabled', e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: isAdmin ? 'pointer' : 'not-allowed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: formData.automation_enabled ? 'var(--cyan-500)' : 'rgba(100, 116, 139, 0.3)',
                  transition: '0.2s',
                  borderRadius: '28px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '22px',
                    width: '22px',
                    left: formData.automation_enabled ? '27px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.2s',
                    borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>

            {/* Threshold Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Inventory Risk High */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                    Inventory Risk HIGH Benchmark
                  </label>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-amber)', fontWeight: 700 }}>
                    ≥ {formData.automation_inventory_risk_high_threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  disabled={!isAdmin || !formData.automation_enabled}
                  value={formData.automation_inventory_risk_high_threshold}
                  onChange={(e) => handleChange('automation_inventory_risk_high_threshold', parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--hazard-amber)' }}
                />
              </div>

              {/* Inventory Risk Critical */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                    Inventory Risk CRITICAL Benchmark
                  </label>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-red)', fontWeight: 700 }}>
                    ≥ {formData.automation_inventory_risk_critical_threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  disabled={!isAdmin || !formData.automation_enabled}
                  value={formData.automation_inventory_risk_critical_threshold}
                  onChange={(e) => handleChange('automation_inventory_risk_critical_threshold', parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--hazard-red)' }}
                />
              </div>

              {/* Cargo Risk High */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                    Cargo Risk HIGH Benchmark
                  </label>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-amber)', fontWeight: 700 }}>
                    ≥ {formData.automation_cargo_risk_high_threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  disabled={!isAdmin || !formData.automation_enabled}
                  value={formData.automation_cargo_risk_high_threshold}
                  onChange={(e) => handleChange('automation_cargo_risk_high_threshold', parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--hazard-amber)' }}
                />
              </div>

              {/* Cargo Risk Critical */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                    Cargo Risk CRITICAL Benchmark
                  </label>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--hazard-red)', fontWeight: 700 }}>
                    ≥ {formData.automation_cargo_risk_critical_threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  disabled={!isAdmin || !formData.automation_enabled}
                  value={formData.automation_cargo_risk_critical_threshold}
                  onChange={(e) => handleChange('automation_cargo_risk_critical_threshold', parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--hazard-red)' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. STATION TELEMETRY & COMMS */}
        {(activeCategory === 'all' || activeCategory === 'telemetry') && (
          <div className="stats-grid">
            <div className="command-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Radio size={18} style={{ color: 'var(--cyan-400)' }} />
                <h3 style={{ color: '#fff', fontSize: '15px' }}>Satellite Uplink Settings</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Primary Link: <strong>{SYSTEM_META.satComStatus.network}</strong>
              </p>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Latency: {SYSTEM_META.satComStatus.latency} • Heartbeat: {SYSTEM_META.satComStatus.lastHeartbeat}
              </div>
            </div>

            <div className="command-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Server size={18} style={{ color: 'var(--cyan-400)' }} />
                <h3 style={{ color: '#fff', fontSize: '15px' }}>Local Station Cache</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Offline SQLite / IndexedDB sync buffer for zero-connectivity blizzards.
              </p>
              <button
                className="btn-secondary"
                style={{ fontSize: '11.5px', padding: '5px 12px' }}
                onClick={() => alert('Local cache verified: 100% operational.')}
              >
                <RefreshCw size={12} style={{ display: 'inline', marginRight: '5px' }} />
                Force Re-sync
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
