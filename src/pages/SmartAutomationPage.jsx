import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ShieldAlert,
  AlertTriangle,
  Compass,
  Package,
  Users,
  Boxes,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  Radio,
  Zap,
  ChevronRight,
  Info,
  Eye,
  Building,
  MapPin,
  Truck,
  Calendar,
  Clock,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import QuickModal from '../components/common/QuickModal';
import { RequestTransferModal } from './InventoryPage';

export default function SmartAutomationPage() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, expeditions, inventory, cargo, personnel, emergency
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Automation Datasets
  const [summary, setSummary] = useState(null);
  const [expeditionsAnalysis, setExpeditionsAnalysis] = useState([]);
  const [inventoryRisks, setInventoryRisks] = useState([]);
  const [cargoRisks, setCargoRisks] = useState([]);
  const [personnelRisks, setPersonnelRisks] = useState([]);
  const [emergencyQueue, setEmergencyQueue] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [stationIntel, setStationIntel] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [stations, setStations] = useState([]);
  const [transferModalTarget, setTransferModalTarget] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [selectedExplainInv, setSelectedExplainInv] = useState(null);

  const currentUser = api.getStoredUser();
  const canRequestTransfer = currentUser && ['ADMIN', 'EXPEDITION_DIRECTOR', 'STATION_HEAD'].includes((currentUser.role || '').toUpperCase());

  // Station Intelligence Map keyed by item_code
  const intelByCode = React.useMemo(() => {
    const map = {};
    (stationIntel || []).forEach(si => {
      if (!map[si.item_code] || (si.surplus_deficit < (map[si.item_code].surplus_deficit || 0))) {
        map[si.item_code] = si;
      }
    });
    return map;
  }, [stationIntel]);

  const pendingTransfers = React.useMemo(() => {
    return (transfers || []).filter(t => t.status === 'REQUESTED' || t.status === 'APPROVED');
  }, [transfers]);

  const getProjectedBreachDate = (daysToMin, stock, min) => {
    if (stock !== null && stock !== undefined && min !== null && min !== undefined && stock <= min) {
      return 'Immediate (Breached)';
    }
    if (typeof daysToMin === 'number' && daysToMin === 0) {
      return 'Immediate (Breached)';
    }
    if (typeof daysToMin === 'number' && daysToMin > 0) {
      const target = new Date();
      target.setDate(target.getDate() + daysToMin);
      return target.toISOString().split('T')[0];
    }
    return null;
  };

  const getProjectedShortageDate = (runway, stock) => {
    if (stock === 0) return 'Immediate (0 Stock)';
    if (typeof runway === 'number' && runway > 0) {
      const target = new Date();
      target.setDate(target.getDate() + runway);
      return target.toISOString().split('T')[0];
    }
    return null;
  };

  const getConciseWhyFlagged = (inv, si) => {
    if (si && si.why_flagged && si.why_flagged.length > 0) {
      return si.why_flagged[0];
    }
    if (inv && inv.why_flagged && inv.why_flagged.length > 0) {
      return inv.why_flagged[0];
    }
    if (inv && inv.factors && inv.factors.length > 0) {
      const neg = inv.factors.find(f => f.impact === 'NEGATIVE');
      if (neg) return neg.description || neg.name;
    }
    const currentStock = si?.current_stock ?? inv.quantity;
    const minQty = si?.minimum_quantity ?? inv.minimum_quantity;
    if (currentStock <= minQty) return 'Current stock is below safety minimum reserve';
    return 'Reserve within nominal parameters';
  };

  const handleOpenTransfer = (inv, si, preselectedDonor = null) => {
    if (!canRequestTransfer) return;
    const targetStationId = si?.station_id || currentUser?.assigned_station_id || (stations[0]?.id);
    const targetStationName = si?.station_name || currentUser?.assigned_station_name || inv.station_name || 'Station';
    const currentStock = si?.current_stock ?? inv.quantity;
    const minQty = si?.minimum_quantity ?? inv.minimum_quantity;
    const deficitVal = Math.max(0, minQty - currentStock);

    setTransferModalTarget({
      destStation: { id: targetStationId, name: targetStationName },
      itemInfo: {
        item_code: inv.item_code,
        item_name: inv.item_name,
        current_stock: currentStock,
        minimum_quantity: minQty,
        unit: inv.unit || 'Units',
        surplus_deficit: -deficitVal
      }
    });
  };

  // Load all analysis from backend
  const runLiveAnalysis = async (isManual = false) => {
    try {
      if (isManual) setAnalyzing(true);
      else setLoading(true);
      setError(null);

      const user = api.getStoredUser();
      const stationIdParam = user?.role === 'STATION_HEAD' ? user.assigned_station_id : null;

      const [sumRes, expRes, invRes, crgRes, persRes, emRes, recRes, intelRes, transRes, stationsRes] = await Promise.all([
        api.getAutomationSummary(),
        api.getExpeditionReadinessAnalysis(),
        api.getInventoryRiskAnalysis(),
        api.getCargoRiskAnalysis(),
        api.getPersonnelRiskAnalysis(),
        api.getEmergencyPriorityQueue(),
        api.getAutomationRecommendations(),
        api.getStationInventoryIntelligence(stationIdParam).catch(() => []),
        api.getTransfers().catch(() => []),
        api.getStations().catch(() => [])
      ]);

      if (sumRes) setSummary(sumRes);
      if (expRes) setExpeditionsAnalysis(expRes);
      if (invRes) setInventoryRisks(invRes);
      if (crgRes) setCargoRisks(crgRes);
      if (persRes) setPersonnelRisks(persRes);
      if (emRes) setEmergencyQueue(emRes);
      if (recRes) setRecommendations(recRes);
      if (intelRes) setStationIntel(Array.isArray(intelRes) ? intelRes : []);
      if (transRes) setTransfers(Array.isArray(transRes) ? transRes : []);
      if (stationsRes) setStations(Array.isArray(stationsRes) ? stationsRes : []);

      if (isManual) {
        setActionFeedback('Live predictive analysis successfully re-evaluated against active database state.');
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err) {
      console.error('[POLAR-X Smart Operations] Analysis error:', err);
      setError(err.message || 'Failed to execute smart predictive risk analysis.');
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    runLiveAnalysis();
  }, []);

  const getLevelBadgeClass = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'READY':
      case 'LOW':
        return 'badge-success';
      case 'ATTENTION':
      case 'MEDIUM':
        return 'badge-warning';
      case 'AT_RISK':
      case 'HIGH':
        return 'badge-warning';
      case 'CRITICAL':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="automation-page-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Command Center Hero & Analysis Bar */}
      <div className="command-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div className="module-meta-badge" style={{ borderColor: 'var(--cyan-400)', color: 'var(--cyan-300)' }}>
                <Cpu size={14} />
                <span>EXPLAINABLE PREDICTIVE OPERATIONS & AUTOMATION</span>
              </div>
              {summary?.analyzed_at && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Evaluated: {summary.analyzed_at}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>
              Smart Operations & Mission Risk Engine
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '750px', marginTop: '4px' }}>
              Predictive risk analysis based on current operational data. Evaluates expedition readiness, supply shortages, transit bottlenecks, and SAR urgency with complete factor explainability.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={() => runLiveAnalysis(true)}
              disabled={analyzing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px' }}
            >
              <RefreshCw size={15} className={analyzing ? 'spin-icon' : ''} />
              {analyzing ? 'Evaluating Telemetry...' : 'Run Live Analysis'}
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {actionFeedback && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid var(--cyan-500)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--cyan-300)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--hazard-red-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--hazard-red)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
          <button className="btn-secondary" onClick={() => runLiveAnalysis(true)}>
            Retry Analysis
          </button>
        </div>
      )}

      {/* 2. Executive Analytics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Fleet Readiness Index</span>
            <Compass size={16} className="metric-icon" style={{ color: 'var(--hazard-green)' }} />
          </div>
          <div className="metric-value" style={{ color: (summary?.overall_fleet_readiness || 0) >= 80 ? 'var(--hazard-green)' : 'var(--hazard-amber)' }}>
            {summary?.overall_fleet_readiness ? `${summary.overall_fleet_readiness}%` : '--'}
          </div>
          <div className="metric-subtext">
            <span>{summary?.expeditions_analyzed ?? 0} Expeditions Assessed</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Composite Risk Index</span>
            <Activity size={16} className="metric-icon" style={{ color: (summary?.overall_risk_index || 0) > 40 ? 'var(--hazard-red)' : 'var(--cyan-400)' }} />
          </div>
          <div className="metric-value" style={{ color: (summary?.overall_risk_index || 0) > 40 ? 'var(--hazard-red)' : 'var(--cyan-400)' }}>
            {summary?.overall_risk_index ?? '--'}
          </div>
          <div className="metric-subtext">
            <span>Weighted Vulnerability Score</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Critical Risk Flags</span>
            <ShieldAlert size={16} className="metric-icon" style={{ color: 'var(--hazard-red)' }} />
          </div>
          <div className="metric-value" style={{ color: (summary?.critical_risks_count || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
            {summary?.critical_risks_count ?? '--'}
          </div>
          <div className="metric-subtext">
            <span>{summary?.high_risks_count ?? 0} High-Priority Alerts</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Supply Shortage Risks</span>
            <Boxes size={16} className="metric-icon" style={{ color: 'var(--hazard-amber)' }} />
          </div>
          <div className="metric-value">{summary?.inventory_items_at_risk ?? '--'}</div>
          <div className="metric-subtext">
            <span>Items Breaching Safety Buffer</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Delayed Consignments</span>
            <Package size={16} className="metric-icon" style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div className="metric-value">{summary?.delayed_cargo_count ?? '--'}</div>
          <div className="metric-subtext">
            <span>Transit Pipeline Bottlenecks</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active SAR Backlog</span>
            <ShieldAlert size={16} className="metric-icon" style={{ color: (summary?.active_emergency_count || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)' }} />
          </div>
          <div className="metric-value" style={{ color: (summary?.active_emergency_count || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
            {summary?.active_emergency_count ?? '--'}
          </div>
          <div className="metric-subtext">
            <span>Ranked in Priority Queue</span>
          </div>
        </div>
      </div>

      {/* 3. High-Priority Action Items Banner */}
      {summary?.top_priority_actions && summary.top_priority_actions.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(15, 23, 42, 0.6))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} style={{ color: 'var(--hazard-amber)' }} />
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Top Priority Operational Recommendations
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {summary.top_priority_actions.map((act, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <span style={{ color: 'var(--cyan-400)', fontWeight: '700' }}>#{idx + 1}</span>
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Section Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Executive Operations Overview', icon: Cpu },
          { id: 'expeditions', label: 'Expedition Readiness Analysis', icon: Compass, count: expeditionsAnalysis.length },
          { id: 'inventory', label: 'Inventory Shortage Risks', icon: Boxes, count: inventoryRisks.length, pendingBadge: pendingTransfers.length > 0 ? `${pendingTransfers.length} pending` : null },
          { id: 'cargo', label: 'Cargo Transit Risks', icon: Package, count: cargoRisks.length },
          { id: 'personnel', label: 'Personnel Operational Safety', icon: Users, count: personnelRisks.length },
          { id: 'emergency', label: 'Emergency Urgency & SAR Recs', icon: ShieldAlert, count: emergencyQueue.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.08))' : 'transparent',
                border: `1px solid ${isActive ? 'var(--cyan-500)' : 'transparent'}`,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? '700' : '500',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={15} style={{ color: isActive ? 'var(--cyan-400)' : 'inherit' }} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'var(--cyan-500)' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#000' : 'var(--text-secondary)',
                    fontWeight: '700'
                  }}
                >
                  {tab.count}
                </span>
              )}
              {tab.pendingBadge && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.25)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    fontWeight: '700'
                  }}
                  title="Active transfer requests pending review"
                >
                  {tab.pendingBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 5. TAB PANELS */}

      {/* ─── TAB 1: OVERVIEW ─── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {/* Section 1: Expeditions Summary */}
          <div className="command-panel" style={{ padding: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '14px' }}>
              <div className="panel-title-group">
                <Compass size={16} className="panel-title-icon" />
                <span className="panel-title">Expeditions Readiness Scores</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expeditionsAnalysis.map(exp => (
                <div
                  key={exp.expedition_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{exp.expedition_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{exp.base_station}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`status-badge ${getLevelBadgeClass(exp.level)}`} style={{ fontSize: '10.5px' }}>
                      {exp.level} ({exp.score}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Top Stockout Risks */}
          <div className="command-panel" style={{ padding: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '14px' }}>
              <div className="panel-title-group">
                <Boxes size={16} className="panel-title-icon" />
                <span className="panel-title">Priority Supply Shortages</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {inventoryRisks.slice(0, 3).map(inv => (
                <div
                  key={inv.inventory_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: `1px solid ${inv.risk_level === 'CRITICAL' ? 'var(--hazard-red-border)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '12.5px', color: '#fff' }}>{inv.item_name}</span>
                    <span className={`status-badge ${getLevelBadgeClass(inv.risk_level)}`}>
                      {inv.risk_level} ({inv.risk_score}%)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Available: <strong style={{ color: '#fff' }}>{inv.quantity} {inv.unit}</strong> (Min: {inv.minimum_quantity} {inv.unit}, Runway: {inv.days_remaining}d)
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--cyan-300)', marginTop: '2px' }}>
                    {inv.recommended_action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Emergency Urgency Queue */}
          <div className="command-panel" style={{ padding: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '14px' }}>
              <div className="panel-title-group">
                <ShieldAlert size={16} className="panel-title-icon" />
                <span className="panel-title">Active Emergency Incident Rankings</span>
              </div>
            </div>
            {emergencyQueue.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active emergency incidents currently pending SAR assignment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emergencyQueue.slice(0, 3).map(em => (
                  <div
                    key={em.incident_id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid var(--hazard-red-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '12.5px', color: '#fff' }}>
                        #{em.priority_rank} • {em.title}
                      </span>
                      <span className="mono-badge" style={{ color: 'var(--hazard-red)', borderColor: 'var(--hazard-red-border)' }}>
                        Score: {em.priority_score}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Location: {em.location_name} • Severity: {em.severity} • {em.has_assigned_unit ? `Unit: ${em.assigned_unit_code}` : 'Unassigned'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--cyan-300)' }}>
                      {em.recommended_action}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: EXPEDITIONS READINESS ─── */}
      {activeTab === 'expeditions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {expeditionsAnalysis.map(exp => (
            <div key={exp.expedition_id} className="command-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{exp.expedition_name}</h3>
                    <span className={`status-badge ${getLevelBadgeClass(exp.level)}`}>
                      {exp.level} — {exp.score}%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Base Station: {exp.base_station}
                  </div>
                </div>
              </div>

              {/* Contributing Factors */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Contributing Operational Factors
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                  {exp.factors.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700' }}>
                        <span style={{ color: '#fff' }}>{f.name}</span>
                        <span style={{ color: f.impact === 'POSITIVE' ? 'var(--hazard-green)' : f.impact === 'NEGATIVE' ? 'var(--hazard-red)' : 'var(--cyan-400)' }}>
                          {f.impact}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        {f.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Actions */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.05)',
                  borderLeft: '3px solid var(--cyan-400)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--cyan-300)', textTransform: 'uppercase' }}>
                  Recommended Action Plan
                </div>
                {exp.recommended_actions.map((act, aIdx) => (
                  <div key={aIdx} style={{ fontSize: '12px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowRight size={12} style={{ color: 'var(--cyan-400)' }} />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 3: INVENTORY SHORTAGE RISKS ─── */}
      {activeTab === 'inventory' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="panel-title-group">
              <Boxes size={18} className="panel-title-icon" />
              <span className="panel-title">Inventory Shortage & Stockout Vulnerability Analysis</span>
            </div>
            {pendingTransfers.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#c4b5fd'
                }}
              >
                <Truck size={14} style={{ color: '#a78bfa' }} />
                <span>Pending Cross-Station Transfers: <strong style={{ color: '#fff' }}>{pendingTransfers.length}</strong></span>
              </div>
            )}
          </div>
          <div className="polar-table-wrapper">
            <table className="polar-table" style={{ minWidth: '1080px' }}>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Resource</th>
                  <th>Station</th>
                  <th>Stock vs Min (Deficit)</th>
                  <th>Burn Rate (7d)</th>
                  <th>Trend</th>
                  <th>Runway & Breach</th>
                  <th>Risk Level</th>
                  <th>Why Flagged</th>
                  <th>Eligible Donors</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRisks.map(inv => {
                  const si = intelByCode[inv.item_code];
                  const currentStock = si?.current_stock ?? inv.quantity;
                  const minRequired = si?.minimum_quantity ?? inv.minimum_quantity;
                  const isBreached = currentStock <= minRequired;
                  const deficit = Math.max(0, minRequired - currentStock);
                  const burnRateText = si?.burn_rate_text || inv.burn_rate_text || 'Insufficient history';
                  const trend = si?.trend || inv.trend || 'INSUFFICIENT DATA';
                  const daysToMin = si?.days_to_minimum !== undefined ? si.days_to_minimum : inv.days_to_minimum;
                  const daysRunway = si?.days_remaining !== undefined ? si.days_remaining : inv.days_remaining;
                  const projectedBreach = getProjectedBreachDate(daysToMin, currentStock, minRequired);
                  const projectedShortage = getProjectedShortageDate(daysRunway, currentStock);
                  const whyFlaggedText = getConciseWhyFlagged(inv, si);
                  const donorRecs = (si && si.donor_recommendations) || [];
                  const topDonor = donorRecs.length > 0 ? donorRecs[0] : null;
                  const displayStation = si?.station_name || inv.station_name || 'Central Depot';

                  const enrichedInv = {
                    ...inv,
                    current_stock: currentStock,
                    minimum_quantity: minRequired,
                    deficit,
                    burn_rate_text: burnRateText,
                    trend,
                    days_to_minimum: daysToMin,
                    days_remaining: daysRunway,
                    projected_breach_date: projectedBreach,
                    projected_shortage_date: projectedShortage,
                    why_flagged: (si && si.why_flagged && si.why_flagged.length > 0) ? si.why_flagged : (inv.why_flagged && inv.why_flagged.length > 0 ? inv.why_flagged : [whyFlaggedText]),
                    donor_recommendations: donorRecs,
                    station_name: displayStation,
                    station_id: si?.station_id || currentUser?.assigned_station_id
                  };

                  return (
                    <tr key={inv.inventory_id} onClick={() => setSelectedExplainInv(enrichedInv)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)', whiteSpace: 'nowrap' }}>
                        {inv.item_code}
                      </td>
                      <td style={{ color: '#fff', fontWeight: '600' }}>
                        {inv.item_name}
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{inv.category} • {inv.location}</div>
                      </td>
                      <td style={{ color: 'var(--cyan-300)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={12} style={{ color: 'var(--cyan-400)' }} />
                          {displayStation}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        <span style={{ color: isBreached ? 'var(--hazard-red)' : '#fff', fontWeight: '700' }}>
                          {currentStock} {inv.unit}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}> / {minRequired} {inv.unit}</span>
                        {deficit > 0 ? (
                          <div style={{ color: 'var(--hazard-red)', fontSize: '11px', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <AlertTriangle size={11} /> Deficit: −{deficit} {inv.unit}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--hazard-green)', fontSize: '10px', marginTop: '2px' }}>
                            Surplus: +{Math.max(0, currentStock - minRequired)} {inv.unit}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: burnRateText && !burnRateText.includes('Insufficient') ? 'var(--cyan-300)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {burnRateText}
                      </td>
                      <td>
                        <span className={`status-badge ${trend === 'INCREASING' ? 'badge-danger' : trend === 'DECREASING' ? 'badge-success' : trend === 'STABLE' ? 'badge-info' : 'badge-muted'}`} style={{ whiteSpace: 'nowrap' }}>
                          {trend}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <div>{daysRunway !== null && daysRunway !== undefined ? `${daysRunway}d runway` : 'Runway unavailable'}</div>
                        <div style={{ color: daysToMin !== null && daysToMin <= 7 ? 'var(--hazard-red)' : 'var(--text-muted)', fontSize: '10.5px', marginTop: '1px' }}>
                          {daysToMin !== null && daysToMin !== undefined ? (daysToMin === 0 ? '0d to min (breached)' : `${daysToMin}d to min`) : ''}
                        </div>
                        {projectedBreach && (
                          <div style={{ color: isBreached ? 'var(--hazard-red)' : 'var(--hazard-amber)', fontSize: '10px', fontWeight: '600', marginTop: '2px' }}>
                            Breach: {projectedBreach}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${getLevelBadgeClass(inv.risk_level)}`} style={{ whiteSpace: 'nowrap' }}>
                          {inv.risk_level} ({inv.risk_score}%)
                        </span>
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                          {whyFlaggedText}
                        </div>
                      </td>
                      <td style={{ minWidth: '220px' }}>
                        {deficit > 0 ? (
                          topDonor ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '700', color: '#fff', fontSize: '11.5px' }}>#{topDonor.rank} {topDonor.donor_station_name}</span>
                                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)' }}>{topDonor.distance_km?.toFixed(0)} km</span>
                              </div>
                              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                Stock: {topDonor.donor_current_stock} • <span style={{ color: 'var(--hazard-green)' }}>Surplus: +{topDonor.donor_transferable_surplus} {inv.unit}</span>
                              </div>
                              <div style={{ fontSize: '10px', color: '#a78bfa' }}>
                                Rec Transfer: <strong>{topDonor.recommended_transfer_quantity} {inv.unit}</strong>
                              </div>
                              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                                {topDonor.reason}
                              </div>
                              {canRequestTransfer && (
                                <button
                                  className="btn-primary"
                                  onClick={(e) => { e.stopPropagation(); handleOpenTransfer(inv, si, topDonor); }}
                                  style={{
                                    marginTop: '4px',
                                    padding: '3px 8px',
                                    fontSize: '10.5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: 'fit-content'
                                  }}
                                  title="Request supply transfer from this donor"
                                >
                                  <Truck size={11} /> Request Transfer
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              No eligible donors (reserves &le; min)
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '10.5px', color: 'var(--hazard-green)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Safe Reserve
                          </span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            className="req-explain-btn"
                            onClick={() => setSelectedExplainInv(enrichedInv)}
                            title="View explainable telemetry & donor breakdown"
                          >
                            <Eye size={12} /> Explain
                          </button>
                          {canRequestTransfer && deficit > 0 && (
                            <button
                              className="inv-action-btn"
                              onClick={() => handleOpenTransfer(inv, si)}
                              style={{ padding: '3px 8px', fontSize: '10.5px', color: 'var(--cyan-300)', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                              title="Initiate cross-station transfer request"
                            >
                              <Truck size={11} /> Transfer
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
        </div>
      )}

      {/* ─── TAB 4: CARGO TRANSIT RISKS ─── */}
      {activeTab === 'cargo' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Package size={18} className="panel-title-icon" />
              <span className="panel-title">Cargo Transit Delay & Cold-Chain Risk Pipeline</span>
            </div>
          </div>
          <div className="polar-table-wrapper">
            <table className="polar-table">
              <thead>
                <tr>
                  <th>Cargo Code</th>
                  <th>Manifest Description</th>
                  <th>Destination</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Factors</th>
                  <th>Recommended Logistics Action</th>
                </tr>
              </thead>
              <tbody>
                {cargoRisks.map(c => (
                  <tr key={c.cargo_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)' }}>
                      {c.cargo_code}
                    </td>
                    <td style={{ color: '#fff', fontWeight: '600' }}>
                      {c.name}
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Location: {c.current_location}</div>
                    </td>
                    <td style={{ color: 'var(--cyan-300)' }}>{c.destination}</td>
                    <td>
                      <span className="mono-badge">{c.priority}</span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <span className={`status-badge ${getLevelBadgeClass(c.risk_level)}`}>
                        {c.risk_level} ({c.risk_score}%)
                      </span>
                    </td>
                    <td style={{ maxWidth: '200px' }}>
                      {c.factors.map((f, fIdx) => (
                        <div key={fIdx} style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          • {f.name}
                        </div>
                      ))}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--cyan-300)', maxWidth: '240px' }}>
                      {c.recommended_action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: PERSONNEL OPERATIONAL SAFETY ─── */}
      {activeTab === 'personnel' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Users size={18} className="panel-title-icon" />
              <span className="panel-title">Personnel Deployment & Operational Safety Assessment</span>
            </div>
          </div>
          <div className="polar-table-wrapper">
            <table className="polar-table">
              <thead>
                <tr>
                  <th>Personnel Code</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Current Sector</th>
                  <th>Battery</th>
                  <th>Safety Score</th>
                  <th>Recommended Protocol</th>
                </tr>
              </thead>
              <tbody>
                {personnelRisks.map(p => (
                  <tr key={p.personnel_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)' }}>
                      {p.personnel_code}
                    </td>
                    <td style={{ color: '#fff', fontWeight: '700' }}>
                      {p.name}
                    </td>
                    <td>{p.role}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ color: 'var(--cyan-300)' }}>{p.current_location}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: parseInt(p.battery) < 30 ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
                      {p.battery}
                    </td>
                    <td>
                      <span className={`status-badge ${getLevelBadgeClass(p.risk_level)}`}>
                        {p.risk_level} ({p.operational_risk_score}%)
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--cyan-300)', maxWidth: '280px' }}>
                      {p.recommended_action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 6: EMERGENCY PRIORITY & RESOURCE RECOMMENDATIONS ─── */}
      {activeTab === 'emergency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="command-panel" style={{ padding: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <div className="panel-title-group">
                <ShieldAlert size={18} className="panel-title-icon" />
                <span className="panel-title">Active Emergency Incident Priority Queue</span>
              </div>
            </div>

            {emergencyQueue.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active incidents requiring emergency response prioritization.
              </div>
            ) : (
              <div className="polar-table-wrapper">
                <table className="polar-table">
                  <thead>
                    <tr>
                      <th>Urgency Rank</th>
                      <th>Incident Code</th>
                      <th>Incident Title</th>
                      <th>Severity</th>
                      <th>Sector</th>
                      <th>Priority Score</th>
                      <th>Contributing Scoring Factors</th>
                      <th>Assigned SAR Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencyQueue.map(em => (
                      <tr key={em.incident_id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: em.priority_rank === 1 ? 'var(--hazard-red)' : '#fff' }}>
                          #{em.priority_rank}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--hazard-red)' }}>
                          {em.incident_code}
                        </td>
                        <td style={{ color: '#fff', fontWeight: '700' }}>
                          {em.title}
                        </td>
                        <td>
                          <span className="mono-badge" style={{ color: em.severity === 'CRITICAL' ? 'var(--hazard-red)' : 'var(--hazard-amber)', fontWeight: '700' }}>
                            {em.severity}
                          </span>
                        </td>
                        <td style={{ color: 'var(--cyan-300)' }}>{em.location_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--hazard-red)' }}>
                          {em.priority_score} / 100
                        </td>
                        <td style={{ maxWidth: '240px' }}>
                          {em.factors.map((f, fIdx) => (
                            <div key={fIdx} style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              • {f.name} ({f.weight > 0 ? `+${f.weight}` : f.weight} pts)
                            </div>
                          ))}
                        </td>
                        <td>
                          {em.has_assigned_unit ? (
                            <span style={{ color: 'var(--cyan-400)', fontWeight: '700' }}>{em.assigned_unit_code}</span>
                          ) : (
                            <span className="status-badge badge-danger">UNASSIGNED BACKLOG</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operator-Controlled Response Unit Recommendations */}
          <div className="command-panel" style={{ padding: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <div className="panel-title-group">
                <Radio size={18} className="panel-title-icon" />
                <span className="panel-title">Operator-Controlled SAR Response Unit Recommendations</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {recommendations.map(rec => (
                <div
                  key={rec.incident_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--hazard-red)' }}>
                        {rec.incident_code}
                      </span>
                      <span style={{ fontWeight: '700', color: '#fff' }}>{rec.incident_title}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location: {rec.location_name}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {rec.recommended_units.map(u => (
                      <div
                        key={u.unit.id}
                        style={{
                          background: 'rgba(8, 13, 26, 0.7)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--cyan-300)' }}>
                            {u.unit.unit_code} — {u.unit.name}
                          </span>
                          <span className="mono-badge" style={{ color: u.is_available ? 'var(--hazard-green)' : 'var(--text-muted)' }}>
                            {u.unit.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Distance: <strong style={{ color: '#fff' }}>{u.distance_km} km</strong> • Match Score: <strong style={{ color: 'var(--cyan-400)' }}>{u.score}</strong>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {u.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RESOURCE RISK EXPLAINABILITY MODAL (PASS 2 & 3) ─── */}
      {selectedExplainInv && (
        <QuickModal
          isOpen={true}
          onClose={() => setSelectedExplainInv(null)}
          title={`Resource Risk & Telemetry Analysis — ${selectedExplainInv.item_name} (${selectedExplainInv.item_code})`}
          footerButtons={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {canRequestTransfer && ((selectedExplainInv.deficit || 0) > 0 || ((selectedExplainInv.current_stock ?? selectedExplainInv.quantity) <= selectedExplainInv.minimum_quantity)) && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const targetItem = selectedExplainInv;
                    setSelectedExplainInv(null);
                    handleOpenTransfer(targetItem, intelByCode[targetItem.item_code]);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Truck size={13} /> Request Cross-Station Transfer
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedExplainInv(null)}>
                Close Analysis
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Telemetry */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px',
              background: 'rgba(15,23,42,0.6)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>POLAR FACILITY / DEPOT</div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                  {selectedExplainInv.station_name || selectedExplainInv.location || 'Central Depot'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CURRENT STOCK</div>
                <div style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: (selectedExplainInv.current_stock ?? selectedExplainInv.quantity) <= selectedExplainInv.minimum_quantity ? 'var(--hazard-red)' : '#fff',
                  marginTop: '2px'
                }}>
                  {selectedExplainInv.current_stock ?? selectedExplainInv.quantity} {selectedExplainInv.unit}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SAFETY MINIMUM</div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--cyan-300)', marginTop: '2px' }}>
                  {selectedExplainInv.minimum_quantity} {selectedExplainInv.unit}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>DEFICIT / SURPLUS</div>
                <div style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: (selectedExplainInv.deficit || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)',
                  marginTop: '2px'
                }}>
                  {(selectedExplainInv.deficit || 0) > 0 ? `−${selectedExplainInv.deficit} ${selectedExplainInv.unit}` : `+${Math.max(0, (selectedExplainInv.current_stock ?? selectedExplainInv.quantity) - selectedExplainInv.minimum_quantity)} ${selectedExplainInv.unit}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OPERATIONAL RISK</div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: getLevelBadgeClass(selectedExplainInv.risk_level) === 'badge-danger' ? 'var(--hazard-red)' : 'var(--cyan-300)', marginTop: '2px' }}>
                  {selectedExplainInv.risk_level} ({selectedExplainInv.risk_score}%)
                </div>
              </div>
            </div>

            {/* Burn Rate, Trend, and Projections */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>7-DAY BURN RATE</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: selectedExplainInv.burn_rate_text && !selectedExplainInv.burn_rate_text.includes('Insufficient') ? 'var(--cyan-300)' : 'var(--text-muted)' }}>
                  {selectedExplainInv.burn_rate_text || 'Insufficient consumption history'}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>CONSUMPTION TREND</div>
                <span className={`status-badge ${selectedExplainInv.trend === 'INCREASING' ? 'badge-danger' : selectedExplainInv.trend === 'DECREASING' ? 'badge-success' : selectedExplainInv.trend === 'STABLE' ? 'badge-info' : 'badge-muted'}`}>
                  {selectedExplainInv.trend || 'INSUFFICIENT DATA'}
                </span>
              </div>
              <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>RUNWAY / DAYS TO MIN</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                  {selectedExplainInv.days_remaining !== null && selectedExplainInv.days_remaining !== undefined ? `${selectedExplainInv.days_remaining}d runway` : '—'} • {selectedExplainInv.days_to_minimum !== null && selectedExplainInv.days_to_minimum !== undefined ? (selectedExplainInv.days_to_minimum === 0 ? '0d to min (breached)' : `${selectedExplainInv.days_to_minimum}d to min`) : '—'}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>PROJECTED BREACH DATE</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: selectedExplainInv.projected_breach_date?.includes('Breached') ? 'var(--hazard-red)' : 'var(--cyan-300)' }}>
                  {selectedExplainInv.projected_breach_date || 'Projection unavailable'}
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
                {selectedExplainInv.why_flagged && selectedExplainInv.why_flagged.length > 0 ? (
                  selectedExplainInv.why_flagged.map((f, fIdx) => (
                    <li key={fIdx} style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                      {f}
                    </li>
                  ))
                ) : selectedExplainInv.factors && selectedExplainInv.factors.length > 0 ? (
                  selectedExplainInv.factors.map((f, fIdx) => (
                    <li key={fIdx} style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                      {f.description || f.name}
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Buffer within nominal parameters.
                  </li>
                )}
              </ul>
            </div>

            {/* ELIGIBLE DONOR STATIONS (PASS 3) */}
            <div style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#a78bfa', fontFamily: 'var(--font-mono)', letterSpacing: '0.8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={13} />
                ELIGIBLE DONOR STATIONS & TRANSFER OPPORTUNITIES ({selectedExplainInv.donor_recommendations?.length || 0})
              </div>

              {selectedExplainInv.donor_recommendations && selectedExplainInv.donor_recommendations.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {selectedExplainInv.donor_recommendations.map(d => (
                    <div
                      key={d.donor_station_id}
                      style={{
                        background: 'rgba(8, 13, 26, 0.7)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#fff' }}>
                          #{d.rank} {d.donor_station_name}
                        </span>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-300)' }}>
                          {d.distance_km?.toFixed(0)} km away
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>Current Stock: <strong style={{ color: '#fff' }}>{d.donor_current_stock} {d.unit}</strong></span>
                        <span>Min Reserve: <strong>{d.donor_minimum_required} {d.unit}</strong></span>
                        <span style={{ color: 'var(--hazard-green)' }}>Safe Surplus: <strong>+{d.donor_transferable_surplus} {d.unit}</strong></span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#c4b5fd', background: 'rgba(139,92,246,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                        Recommended Transfer: <strong style={{ color: '#fff' }}>{d.recommended_transfer_quantity} {d.unit}</strong>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {d.reason}
                      </div>
                      {canRequestTransfer && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            const targetItem = selectedExplainInv;
                            setSelectedExplainInv(null);
                            handleOpenTransfer(targetItem, intelByCode[targetItem.item_code]);
                          }}
                          style={{
                            marginTop: '6px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Truck size={12} /> Request Transfer ({d.recommended_transfer_quantity} {d.unit})
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '8px 0' }}>
                  {(selectedExplainInv.deficit || 0) > 0
                    ? 'No eligible donor stations found with surplus exceeding their minimum safety reserves.'
                    : 'Station stock is currently above safety reserve threshold. No replenishment transfer required.'}
                </div>
              )}
            </div>

            {/* Recommended Replenishment Action */}
            <div style={{ padding: '12px', background: 'rgba(56,189,248,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <div style={{ fontSize: '10px', color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                RECOMMENDED OPERATIONAL ACTION
              </div>
              <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.4' }}>
                {selectedExplainInv.recommended_action}
              </div>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              • Deterministic calculation based on active database telemetry and geospatial station coordinates.
            </div>
          </div>
        </QuickModal>
      )}

      {/* ─── REQUEST TRANSFER MODAL (PASS 3 REUSE) ─── */}
      {transferModalTarget && (
        <RequestTransferModal
          destStation={transferModalTarget.destStation}
          stations={stations}
          itemInfo={transferModalTarget.itemInfo}
          onClose={() => setTransferModalTarget(null)}
          onRequested={() => {
            setTransferModalTarget(null);
            runLiveAnalysis(true);
            setActionFeedback('Cross-station transfer request successfully submitted.');
          }}
        />
      )}
    </div>
  );
}
