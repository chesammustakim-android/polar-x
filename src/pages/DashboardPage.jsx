import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Box, 
  Users, 
  Truck, 
  AlertTriangle, 
  Activity, 
  Radio, 
  Layers, 
  ArrowUpRight,
  ShieldCheck,
  Fuel,
  RefreshCw,
  Server
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import ExpeditionCard from '../components/dashboard/ExpeditionCard';
import PolarMapPanel from '../components/dashboard/PolarMapPanel';
import EmergencyPanel from '../components/dashboard/EmergencyPanel';
import CargoMovement from '../components/dashboard/CargoMovement';
import PersonnelStatus from '../components/dashboard/PersonnelStatus';
import InventoryMonitor from '../components/dashboard/InventoryMonitor';
import { api } from '../services/api';
import { 
  SUMMARY_STATS as DEFAULT_STATS, 
  EXPEDITIONS as DEFAULT_EXPEDITIONS, 
  EMERGENCY_ALERTS as DEFAULT_ALERTS, 
  CARGO_MOVEMENTS as DEFAULT_CARGO, 
  PERSONNEL_ROSTER as DEFAULT_PERSONNEL, 
  INVENTORY_RESOURCES as DEFAULT_INVENTORY 
} from '../data/mockData';

export default function DashboardPage({ onNavigateTab, onSelectAlert, onSelectCargo, onSelectPersonnel, onNavigateToMapWithEntity }) {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [expedition, setExpedition] = useState(DEFAULT_EXPEDITIONS[0]);
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS);
  const [cargo, setCargo] = useState(DEFAULT_CARGO);
  const [personnel, setPersonnel] = useState(DEFAULT_PERSONNEL);
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live dashboard data from FastAPI backend
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDashboardData();
      if (data && data.summary) {
        setIsBackendConnected(true);
        
        // 1. Map summary statistics
        setStats({
          activeExpeditions: {
            value: data.summary.active_expeditions_count,
            subtext: "2 Antarctic • 1 Arctic",
            trend: "+1 vs last season",
            status: "good"
          },
          totalAssets: {
            value: data.summary.total_assets_count.toLocaleString(),
            subtext: "Tracked via Cold-RFID",
            trend: "99.4% Operational",
            status: "good"
          },
          personnelDeployed: {
            value: data.summary.personnel_deployed_count,
            subtext: "42 Maitri • 28 Bharati • 16 Himadri",
            trend: data.summary.critical_alerts_count > 0 ? `${data.summary.critical_alerts_count} Emergency Flag` : "All Nominal",
            status: data.summary.critical_alerts_count > 0 ? "warning" : "good"
          },
          cargoInTransit: {
            value: data.summary.cargo_in_transit_weight,
            subtext: `Across ${data.summary.cargo_in_transit_count || 4} Vessels/Convoys`,
            trend: "2 Convoys In-Route",
            status: "good"
          },
          criticalAlerts: {
            value: data.summary.critical_alerts_count,
            subtext: `${data.summary.critical_alerts_count} SOS Active • Low Medical`,
            trend: data.summary.critical_alerts_count > 0 ? "Immediate Action Required" : "All Nominal",
            status: data.summary.critical_alerts_count > 0 ? "critical" : "good"
          }
        });

        // 2. Map Expedition
        if (data.expeditions && data.expeditions.length > 0) {
          const mainExp = data.expeditions[0];
          setExpedition({
            id: mainExp.id,
            name: mainExp.name,
            subTitle: mainExp.sub_title || "43rd Indian Scientific Expedition to Antarctica",
            location: mainExp.location,
            baseStation: mainExp.base_station || "Maitri Station",
            status: mainExp.status,
            phase: mainExp.phase || "Phase 2: Scientific Deployment",
            leader: mainExp.leader || "Dr. Rajesh Sharma",
            personnel: mainExp.personnel_count || 42,
            cargo: mainExp.cargo_weight || "8.5 Tons",
            readiness: mainExp.readiness || 94,
            vesselSupport: mainExp.vessel_support || "MV Vasiliy Golovnin",
            keyObjectives: [
              "Subglacial lake sediment core analysis (Lake Priyadarshini)",
              "Long-term geomagnetic field monitoring & upper atmospheric studies",
              "Permafrost thermal sensor telemetry integration"
            ]
          });
        }

        // 3. Map Alerts
        if (data.alerts && data.alerts.length > 0) {
          setAlerts(data.alerts.map(a => ({
            id: a.id,
            severity: a.severity,
            timestamp: a.timestamp,
            source: a.source,
            title: a.title,
            description: a.message,
            actionRequired: a.action_required,
            status: a.status,
            coordinates: a.coordinates
          })));
        }

        // 4. Map Cargo
        if (data.recent_cargo && data.recent_cargo.length > 0) {
          setCargo(data.recent_cargo.map(c => ({
            id: c.cargo_code || `CRG-${c.id}`,
            name: c.name,
            category: c.category,
            weight: c.weight,
            origin: c.origin,
            destination: c.destination,
            transitMode: c.transit_mode,
            status: c.status,
            rfidTag: c.rfid_tag,
            temperatureLog: c.temperature_log,
            eta: c.eta,
            priority: c.priority
          })));
        }

        // 5. Map Personnel
        if (data.personnel && data.personnel.length > 0) {
          setPersonnel(data.personnel.map(p => ({
            id: p.personnel_code || `P-${p.id}`,
            name: p.name,
            role: p.role,
            station: p.current_location,
            status: p.status,
            vitals: {
              hr: p.heart_rate || "72 bpm",
              temp: p.body_temp || "36.8°C",
              spo2: p.spo2 || "98%",
              battery: p.battery || "90%"
            },
            currentActivity: p.current_location,
            specialization: p.specialization,
            emergencyContact: p.emergency_contact
          })));
        }

        // 6. Map Inventory
        if (data.inventory && data.inventory.length > 0) {
          setInventory(data.inventory.map(i => {
            const pct = i.minimum_quantity > 0 ? Math.min(100, Math.round((i.quantity / (i.minimum_quantity * 2)) * 100)) : (i.quantity > 0 ? 80 : 0);
            return {
              id: `RES-${i.id}`,
              itemCode: i.item_code,
              name: i.item_name,
              category: i.category,
              currentStock: i.quantity,
              totalCapacity: i.minimum_quantity * 2,
              unit: i.unit,
              percentage: pct,
              burnRate: i.burn_rate || "Standard",
              daysRemaining: i.days_remaining || 100,
              status: i.status || "NORMAL",
              location: i.location
            };
          }));
        }
      } else {
        setIsBackendConnected(false);
      }
    } catch (err) {
      console.warn('[POLAR-X] Using offline/fallback dataset:', err);
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="dashboard-page">
      {/* Top Mission Control Banner */}
      <div className="mission-control-banner">
        <div className="banner-left">
          <div className="banner-pulse-icon">
            <Radio size={22} className="pulse-beacon" />
          </div>
          <div className="banner-title-group">
            <h2>NCPOR EXPEDITION OPERATIONS COMMAND</h2>
            <p>PRIMARY SATELLITE TELEMETRY • MAITRI & BHARATI STATIONS ONLINE</p>
          </div>
        </div>
        <div className="banner-right">
          {/* Backend Status Indicator */}
          <div 
            className="quick-tag" 
            style={{ 
              borderColor: isBackendConnected ? 'var(--hazard-green)' : 'var(--hazard-amber)',
              color: isBackendConnected ? 'var(--hazard-green)' : 'var(--hazard-amber)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={isBackendConnected ? "Connected to FastAPI REST Backend (SQLite)" : "Running in Fallback Mock Mode"}
          >
            <Server size={12} />
            <span>API: {isBackendConnected ? "FASTAPI LIVE (SQLITE)" : "OFFLINE FALLBACK"}</span>
          </div>

          <button 
            className="btn-secondary" 
            style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={loadDashboardData}
            title="Refresh live telemetry from FastAPI"
          >
            <RefreshCw size={12} className={isLoading ? "radar-sweep-icon" : ""} />
            Sync
          </button>
        </div>
      </div>

      {/* Summary Stat Cards Row */}
      <div className="stats-grid">
        <StatCard 
          title="Active Expeditions"
          value={stats.activeExpeditions.value}
          subtext={stats.activeExpeditions.subtext}
          trend={stats.activeExpeditions.trend}
          status={stats.activeExpeditions.status}
          icon={Compass}
          onClick={() => onNavigateTab('expeditions')}
        />
        <StatCard 
          title="Total Assets"
          value={stats.totalAssets.value}
          subtext={stats.totalAssets.subtext}
          trend={stats.totalAssets.trend}
          status={stats.totalAssets.status}
          icon={Box}
          onClick={() => onNavigateTab('cargo')}
        />
        <StatCard 
          title="Personnel Deployed"
          value={stats.personnelDeployed.value}
          subtext={stats.personnelDeployed.subtext}
          trend={stats.personnelDeployed.trend}
          status={stats.personnelDeployed.status}
          icon={Users}
          onClick={() => onNavigateTab('personnel')}
        />
        <StatCard 
          title="Cargo In Transit"
          value={stats.cargoInTransit.value}
          subtext={stats.cargoInTransit.subtext}
          trend={stats.cargoInTransit.trend}
          status={stats.cargoInTransit.status}
          icon={Truck}
          onClick={() => onNavigateTab('cargo')}
        />
        <StatCard 
          title="Critical Alerts"
          value={stats.criticalAlerts.value}
          subtext={stats.criticalAlerts.subtext}
          trend={stats.criticalAlerts.trend}
          status={stats.criticalAlerts.status}
          icon={AlertTriangle}
          isDanger={stats.criticalAlerts.value > 0}
          onClick={() => onNavigateTab('emergency')}
        />
      </div>

      {/* Main Grid: Expedition Showcase + Emergency Alerts */}
      <div className="dashboard-main-grid">
        {/* Left Column: Expedition Overview & Polar Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Expedition Overview Card */}
          <div className="command-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <Compass size={18} className="panel-title-icon" />
                <span className="panel-title">Active Expedition Mission Overview</span>
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => onNavigateTab('expeditions')}
                style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                All Expeditions <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="panel-body">
              <ExpeditionCard 
                expedition={expedition} 
                onInspect={() => onNavigateTab('expeditions')}
              />
            </div>
          </div>

          {/* Interactive Polar Map Section */}
          <div className="command-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <Layers size={18} className="panel-title-icon" />
                <span className="panel-title">Polar Geospatial Radar & Convoy Tracking</span>
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => onNavigateTab('map')}
                style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Expand Full View <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="panel-body" style={{ padding: '12px' }}>
              <PolarMapPanel onSelectMarker={(marker) => {
                if (onNavigateToMapWithEntity) {
                  onNavigateToMapWithEntity(marker);
                } else {
                  onNavigateTab('map');
                }
              }} />
            </div>
          </div>
        </div>

        {/* Right Column: Emergency Alerts & Inventory Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Emergency Alert Panel */}
          <div className="command-panel">
            <div className="panel-header" style={{ borderBottomColor: 'var(--hazard-red-border)' }}>
              <div className="panel-title-group">
                <AlertTriangle size={18} style={{ color: 'var(--hazard-red)' }} />
                <span className="panel-title" style={{ color: 'var(--hazard-red)' }}>Emergency Response Feed</span>
              </div>
              <span className="mono-badge glow-red" style={{ color: 'var(--hazard-red)' }}>
                {alerts.length} EVENTS LOGGED
              </span>
            </div>
            <div className="panel-body">
              <EmergencyPanel 
                alerts={alerts}
                onOpenDetails={onSelectAlert}
              />
            </div>
          </div>

          {/* Station Critical Resources / Inventory Monitor */}
          <div className="command-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <Fuel size={18} className="panel-title-icon" />
                <span className="panel-title">Station Consumables & Stock Levels</span>
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => onNavigateTab('inventory')}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                Manage Stock
              </button>
            </div>
            <div className="panel-body">
              <InventoryMonitor resources={inventory.slice(0, 4)} />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Bottom Grid: Recent Cargo Movements & Personnel Telemetry */}
      <div className="dashboard-secondary-grid">
        {/* Recent Cargo Movements */}
        <div className="command-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Truck size={18} className="panel-title-icon" />
              <span className="panel-title">Active Cargo & Asset Movements</span>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => onNavigateTab('cargo')}
              style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Full Cargo Manifest <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="panel-body">
            <CargoMovement 
              cargoList={cargo} 
              onSelectCargo={onSelectCargo}
            />
          </div>
        </div>

        {/* Personnel Status */}
        <div className="command-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Users size={18} className="panel-title-icon" />
              <span className="panel-title">Field Personnel Vitals & Status</span>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => onNavigateTab('personnel')}
              style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Full Roster <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="panel-body">
            <PersonnelStatus 
              personnelList={personnel} 
              onSelectPersonnel={onSelectPersonnel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
