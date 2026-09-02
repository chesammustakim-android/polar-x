import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Compass,
  Package,
  Users,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Layers,
  Activity,
  Boxes,
  ShieldCheck,
  Clock,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { DonutChart, HorizontalBarChart, ReadinessGauge } from '../components/reports/ReportCharts';
import OperationalInsights from '../components/reports/OperationalInsights';

export default function ReportsPage() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState('overview'); // overview, expeditions, cargo, inventory, personnel, emergency

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [expeditionsList, setExpeditionsList] = useState([]);
  const [cargoList, setCargoList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [incidentsList, setIncidentsList] = useState([]);

  // Filters
  const [selectedExpedition, setSelectedExpedition] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportFeedback, setExportFeedback] = useState(null);

  // Load complete reporting data
  const fetchAllReportData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [summaryRes, expRes, cargoRes, invRes, persRes, incRes] = await Promise.all([
        api.getReportsSummary(),
        api.getReportsExpeditions(),
        api.getReportsCargo(),
        api.getReportsInventory(),
        api.getReportsPersonnel(),
        api.getReportsIncidents()
      ]);

      if (summaryRes) setSummaryData(summaryRes);
      if (expRes) setExpeditionsList(expRes);
      if (cargoRes) setCargoList(cargoRes);
      if (invRes) setInventoryList(invRes);
      if (persRes) setPersonnelList(persRes);
      if (incRes) setIncidentsList(incRes);
    } catch (err) {
      console.error('[POLAR-X Reports] Data loading error:', err);
      setError(err.message || 'Failed to communicate with Polar-X analytics telemetry engine.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllReportData();
  }, []);

  // Filtered datasets based on user selection
  const filteredExpeditions = useMemo(() => {
    return expeditionsList.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || (item.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.leader || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [expeditionsList, statusFilter, searchQuery]);

  const filteredCargo = useMemo(() => {
    return cargoList.filter((item) => {
      const matchesExp = selectedExpedition === 'ALL' || String(item.expedition_id) === String(selectedExpedition);
      const matchesStatus = statusFilter === 'ALL' || (item.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'ALL' || (item.category || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.cargo_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.origin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.destination || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExp && matchesStatus && matchesCategory && matchesSearch;
    });
  }, [cargoList, selectedExpedition, statusFilter, categoryFilter, searchQuery]);

  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      const matchesExp = selectedExpedition === 'ALL' || String(item.expedition_id) === String(selectedExpedition);
      const matchesStatus = statusFilter === 'ALL' || (item.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'ALL' || (item.category || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        (item.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.item_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExp && matchesStatus && matchesCategory && matchesSearch;
    });
  }, [inventoryList, selectedExpedition, statusFilter, categoryFilter, searchQuery]);

  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((item) => {
      const matchesExp = selectedExpedition === 'ALL' || String(item.expedition_id) === String(selectedExpedition);
      const matchesStatus = statusFilter === 'ALL' || (item.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'ALL' || (item.department || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.personnel_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.current_location || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExp && matchesStatus && matchesCategory && matchesSearch;
    });
  }, [personnelList, selectedExpedition, statusFilter, categoryFilter, searchQuery]);

  const filteredIncidents = useMemo(() => {
    return incidentsList.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || (item.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'ALL' || (item.severity || '').toLowerCase() === categoryFilter.toLowerCase() || (item.incident_type || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.incident_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [incidentsList, statusFilter, categoryFilter, searchQuery]);

  // CSV Exporter
  const exportToCSV = (tableName, data, headers) => {
    if (!data || data.length === 0) {
      setExportFeedback(`No data available to export for ${tableName}.`);
      setTimeout(() => setExportFeedback(null), 3500);
      return;
    }

    try {
      const headerRow = headers.map(h => `"${h.label}"`).join(',');
      const dataRows = data.map(item => {
        return headers.map(h => {
          let val = h.getter ? h.getter(item) : item[h.key];
          if (val === null || val === undefined) val = '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csvContent = [headerRow, ...dataRows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `POLAR-X_${tableName}_Report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportFeedback(`Exported ${data.length} records to POLAR-X_${tableName}_Report_${dateStr}.csv`);
      setTimeout(() => setExportFeedback(null), 4000);
    } catch (err) {
      console.error('[POLAR-X] CSV Export error:', err);
      setExportFeedback('Export failed: ' + err.message);
      setTimeout(() => setExportFeedback(null), 4000);
    }
  };

  const handleExportCurrentView = () => {
    switch (activeTab) {
      case 'expeditions':
        exportToCSV('Expeditions', filteredExpeditions, [
          { label: 'Expedition Name', key: 'name' },
          { label: 'Location', key: 'location' },
          { label: 'Base Station', key: 'base_station' },
          { label: 'Status', key: 'status' },
          { label: 'Phase', key: 'phase' },
          { label: 'Leader', key: 'leader' },
          { label: 'Personnel Count', key: 'personnel_count' },
          { label: 'Cargo Weight', key: 'cargo_weight' },
          { label: 'Readiness (%)', key: 'readiness' },
          { label: 'Vessel Support', key: 'vessel_support' }
        ]);
        break;
      case 'cargo':
        exportToCSV('Cargo_Assets', filteredCargo, [
          { label: 'Cargo Code', key: 'cargo_code' },
          { label: 'Item Name', key: 'name' },
          { label: 'Category', key: 'category' },
          { label: 'Weight', key: 'weight' },
          { label: 'Origin', key: 'origin' },
          { label: 'Destination', key: 'destination' },
          { label: 'Status', key: 'status' },
          { label: 'Priority', key: 'priority' },
          { label: 'Transit Mode', key: 'transit_mode' },
          { label: 'Temperature Log', key: 'temperature_log' },
          { label: 'Current Location', key: 'current_location' },
          { label: 'Stage', key: 'stage' }
        ]);
        break;
      case 'inventory':
        exportToCSV('Station_Inventory', filteredInventory, [
          { label: 'Item Code', key: 'item_code' },
          { label: 'Item Name', key: 'item_name' },
          { label: 'Category', key: 'category' },
          { label: 'Quantity', key: 'quantity' },
          { label: 'Min Quantity', key: 'minimum_quantity' },
          { label: 'Unit', key: 'unit' },
          { label: 'Location', key: 'location' },
          { label: 'Burn Rate', key: 'burn_rate' },
          { label: 'Days Remaining', key: 'days_remaining' },
          { label: 'Status', key: 'status' }
        ]);
        break;
      case 'personnel':
        exportToCSV('Personnel_Roster', filteredPersonnel, [
          { label: 'Personnel Code', key: 'personnel_code' },
          { label: 'Name', key: 'name' },
          { label: 'Role', key: 'role' },
          { label: 'Department', key: 'department' },
          { label: 'Status', key: 'status' },
          { label: 'Current Location', key: 'current_location' },
          { label: 'Specialization', key: 'specialization' },
          { label: 'Heart Rate', key: 'heart_rate' },
          { label: 'SpO2', key: 'spo2' },
          { label: 'Body Temp', key: 'body_temp' },
          { label: 'Battery', key: 'battery' }
        ]);
        break;
      case 'emergency':
        exportToCSV('Emergency_Incidents', filteredIncidents, [
          { label: 'Incident Code', key: 'incident_code' },
          { label: 'Title', key: 'title' },
          { label: 'Type', key: 'incident_type' },
          { label: 'Severity', key: 'severity' },
          { label: 'Status', key: 'status' },
          { label: 'Location', key: 'location_name' },
          { label: 'Reported By', key: 'reported_by' },
          { label: 'Created At', key: 'created_at' },
          { label: 'Acknowledged At', key: 'acknowledged_at' },
          { label: 'Dispatched At', key: 'dispatched_at' },
          { label: 'Resolved At', key: 'resolved_at' },
          { label: 'Assigned Unit', key: 'assigned_unit_code' }
        ]);
        break;
      default:
        // Overview export: Full Executive Summary CSV
        exportToCSV('Executive_Operations_Summary', [
          {
            metric: 'Total Expeditions',
            value: summaryData?.kpis?.total_expeditions || 0
          },
          {
            metric: 'Active Expeditions',
            value: summaryData?.kpis?.active_expeditions || 0
          },
          {
            metric: 'Average Fleet Readiness',
            value: `${summaryData?.kpis?.average_expedition_readiness || 0}%`
          },
          {
            metric: 'Total Cargo Consignments',
            value: summaryData?.kpis?.total_cargo || 0
          },
          {
            metric: 'Cargo in Transit',
            value: summaryData?.kpis?.cargo_in_transit || 0
          },
          {
            metric: 'Total Inventory SKUs',
            value: summaryData?.kpis?.total_inventory_items || 0
          },
          {
            metric: 'Critical Stock Deficits',
            value: summaryData?.kpis?.critical_stock_items || 0
          },
          {
            metric: 'Personnel Deployed',
            value: summaryData?.kpis?.total_personnel || 0
          },
          {
            metric: 'Personnel in Field',
            value: summaryData?.kpis?.personnel_field || 0
          },
          {
            metric: 'Active Emergency Incidents',
            value: summaryData?.kpis?.active_incidents || 0
          },
          {
            metric: 'Resolved Incidents',
            value: summaryData?.kpis?.resolved_incidents || 0
          }
        ], [
          { label: 'Operational Metric', key: 'metric' },
          { label: 'Calculated Value', key: 'value' }
        ]);
        break;
    }
  };

  const kpis = summaryData?.kpis || {};

  return (
    <div className="reports-page-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Banner & Action Bar */}
      <div className="command-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div className="module-meta-badge">
                <BarChart3 size={14} />
                <span>NCPOR POLAR LOGISTICS & OPERATIONAL AUDIT</span>
              </div>
              {summaryData?.timestamp && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Refreshed: {summaryData.timestamp}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>
              Expedition Reports & Supply Analytics Engine
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '750px', marginTop: '4px' }}>
              Deterministic operational metrics, burn rates, stockout alerts, and SAR dispatch performance generated directly from active database logs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => fetchAllReportData(true)}
              disabled={refreshing}
              title="Reload live database telemetry"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
              {refreshing ? 'Refreshing...' : 'Sync Telemetry'}
            </button>
            <button
              className="btn-primary"
              onClick={handleExportCurrentView}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              Export {activeTab.toUpperCase()} CSV
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {exportFeedback && (
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
            <span>{exportFeedback}</span>
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
          <button className="btn-secondary" onClick={() => fetchAllReportData(true)}>
            Retry Connection
          </button>
        </div>
      )}

      {/* 2. Top-Level Operational KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Expeditions</span>
            <Compass size={16} className="metric-icon" style={{ color: 'var(--cyan-400)' }} />
          </div>
          <div className="metric-value">{kpis.active_expeditions ?? '--'}</div>
          <div className="metric-subtext">
            <span>{kpis.total_expeditions ?? 0} Total in Registry</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Fleet Readiness</span>
            <ShieldCheck size={16} className="metric-icon" style={{ color: 'var(--hazard-green)' }} />
          </div>
          <div className="metric-value" style={{ color: (kpis.average_expedition_readiness || 0) >= 85 ? 'var(--hazard-green)' : 'var(--hazard-amber)' }}>
            {kpis.average_expedition_readiness ? `${kpis.average_expedition_readiness}%` : '--'}
          </div>
          <div className="metric-subtext">
            <span>Operational Benchmark</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Cargo in Transit</span>
            <Package size={16} className="metric-icon" style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div className="metric-value">{kpis.cargo_in_transit ?? '--'}</div>
          <div className="metric-subtext">
            <span style={{ color: kpis.cargo_delayed > 0 ? 'var(--hazard-red)' : 'var(--text-muted)' }}>
              {kpis.cargo_delayed ?? 0} Flagged Delayed
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Inventory SKUs</span>
            <Boxes size={16} className="metric-icon" style={{ color: 'var(--hazard-amber)' }} />
          </div>
          <div className="metric-value">{kpis.total_inventory_items ?? '--'}</div>
          <div className="metric-subtext">
            <span style={{ color: (kpis.critical_stock_items || 0) > 0 ? 'var(--hazard-red)' : 'var(--text-muted)' }}>
              {(kpis.critical_stock_items || 0) + (kpis.out_of_stock_items || 0)} Critical/Stockouts
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Personnel Deployed</span>
            <Users size={16} className="metric-icon" style={{ color: 'var(--cyan-300)' }} />
          </div>
          <div className="metric-value">{kpis.total_personnel ?? '--'}</div>
          <div className="metric-subtext">
            <span>{kpis.personnel_field ?? 0} in Field/Traverse</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Emergencies</span>
            <ShieldAlert size={16} className="metric-icon" style={{ color: (kpis.active_incidents || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)' }} />
          </div>
          <div className="metric-value" style={{ color: (kpis.active_incidents || 0) > 0 ? 'var(--hazard-red)' : 'var(--hazard-green)' }}>
            {kpis.active_incidents ?? '--'}
          </div>
          <div className="metric-subtext">
            <span>{kpis.resolved_incidents ?? 0} Incidents Resolved</span>
          </div>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overview & Distributions', icon: BarChart3 },
          { id: 'expeditions', label: 'Expedition Readiness', icon: Compass, count: filteredExpeditions.length },
          { id: 'cargo', label: 'Cargo & Cold-Chain', icon: Package, count: filteredCargo.length },
          { id: 'inventory', label: 'Supply Deficit & Buffer', icon: Boxes, count: filteredInventory.length },
          { id: 'personnel', label: 'Personnel & Deployments', icon: Users, count: filteredPersonnel.length },
          { id: 'emergency', label: 'Emergency & SAR Response', icon: ShieldAlert, count: filteredIncidents.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setSearchQuery('');
              }}
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
            </button>
          );
        })}
      </div>

      {/* 4. Filter Toolbar (Applicable to tabular views) */}
      {activeTab !== 'overview' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                className="search-input"
                style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Expedition Filter */}
            {activeTab !== 'expeditions' && (
              <select
                className="filter-select"
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
                value={selectedExpedition}
                onChange={(e) => setSelectedExpedition(e.target.value)}
              >
                <option value="ALL">All Expeditions</option>
                {expeditionsList.map(exp => (
                  <option key={exp.id} value={exp.id}>{exp.name}</option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              className="filter-select"
              style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {activeTab === 'cargo' && (
                <>
                  <option value="Preparing">Preparing</option>
                  <option value="In Transit">In Transit</option>
                  <option value="At Port">At Port</option>
                  <option value="Loaded">Loaded</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Delayed">Delayed</option>
                </>
              )}
              {activeTab === 'inventory' && (
                <>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </>
              )}
              {activeTab === 'personnel' && (
                <>
                  <option value="AT_STATION">At Station</option>
                  <option value="FIELD">Field Deployment</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="RESTING">Resting</option>
                </>
              )}
              {activeTab === 'emergency' && (
                <>
                  <option value="REPORTED">Reported</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="TRIAGED">Triaged</option>
                  <option value="DISPATCHED">Dispatched</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </>
              )}
              {activeTab === 'expeditions' && (
                <>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Planning">Planning</option>
                </>
              )}
            </select>

            {/* Category Filter */}
            {activeTab === 'cargo' && (
              <select
                className="filter-select"
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="Fuel">Fuel & Propellants</option>
                <option value="Medical">Medical Supplies</option>
                <option value="Scientific Equipment">Scientific Equipment</option>
                <option value="Heavy Machinery">Heavy Machinery</option>
                <option value="General Supply">General Supply</option>
              </select>
            )}

            {activeTab === 'inventory' && (
              <select
                className="filter-select"
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Supply Categories</option>
                <option value="Food">Food & Rations</option>
                <option value="Fuel">Fuel Reserves</option>
                <option value="Medical">Medical Kits</option>
                <option value="Scientific Equipment">Scientific Kits</option>
                <option value="Clothing">Polar Cold Gear</option>
                <option value="Safety Equipment">Safety Equipment</option>
                <option value="Spare Parts">Spare Parts</option>
              </select>
            )}

            {activeTab === 'personnel' && (
              <select
                className="filter-select"
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                <option value="Science & Research">Science & Research</option>
                <option value="Logistics & Operations">Logistics & Operations</option>
                <option value="Engineering & Maintenance">Engineering & Maintenance</option>
                <option value="Medical & Health">Medical & Health</option>
                <option value="Command & Administration">Command & Administration</option>
                <option value="Field Support & SAR">Field Support & SAR</option>
              </select>
            )}

            {activeTab === 'emergency' && (
              <select
                className="filter-select"
                style={{ height: '34px', fontSize: '12px', background: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            )}

            {/* Reset Filters */}
            {(statusFilter !== 'ALL' || categoryFilter !== 'ALL' || selectedExpedition !== 'ALL' || searchQuery) && (
              <button
                className="btn-secondary"
                style={{ height: '34px', fontSize: '11.5px', padding: '0 10px' }}
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSelectedExpedition('ALL');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB CONTENTS */}

      {/* ─── TAB 1: OVERVIEW & DISTRIBUTIONS ─── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Operational Risk Insights */}
          <OperationalInsights insights={summaryData?.operational_insights || []} />

          {/* Distribution Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            {/* Chart 1: Personnel Status Distribution */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <Users size={16} className="panel-title-icon" />
                  <span className="panel-title">Personnel Deployment Distribution</span>
                </div>
              </div>
              <DonutChart
                data={summaryData?.personnel_by_status || {}}
                totalLabel="Personnel"
                size={170}
              />
            </div>

            {/* Chart 2: Cargo Status Distribution */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <Package size={16} className="panel-title-icon" />
                  <span className="panel-title">Cargo Transit Status Breakdown</span>
                </div>
              </div>
              <DonutChart
                data={summaryData?.cargo_by_status || {}}
                totalLabel="Cargo Items"
                size={170}
              />
            </div>

            {/* Chart 3: Incident Severity Breakdown */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <ShieldAlert size={16} className="panel-title-icon" />
                  <span className="panel-title">Incident Triage & Severity Tally</span>
                </div>
              </div>
              <DonutChart
                data={summaryData?.incidents_by_severity || {}}
                totalLabel="Incidents"
                size={170}
              />
            </div>
          </div>

          {/* Horizontal Bar Breakdown Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
            {/* Horizontal 1: Inventory Stock Status & Shortages */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <Boxes size={16} className="panel-title-icon" />
                  <span className="panel-title">Inventory Stock Level Distribution</span>
                </div>
              </div>
              <HorizontalBarChart
                data={summaryData?.inventory_by_status || {}}
              />
            </div>

            {/* Horizontal 2: Personnel Department Breakdown */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <Activity size={16} className="panel-title-icon" />
                  <span className="panel-title">Personnel Allocation by Department</span>
                </div>
              </div>
              <HorizontalBarChart
                data={summaryData?.personnel_by_department || {}}
              />
            </div>

            {/* Horizontal 3: Incident Types */}
            <div className="command-panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ marginBottom: '16px' }}>
                <div className="panel-title-group">
                  <AlertTriangle size={16} className="panel-title-icon" />
                  <span className="panel-title">Incident Frequency by Classification</span>
                </div>
              </div>
              <HorizontalBarChart
                data={summaryData?.incidents_by_type || {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: EXPEDITIONS AUDIT ─── */}
      {activeTab === 'expeditions' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Compass size={18} className="panel-title-icon" />
              <span className="panel-title">Expeditions Registry & Readiness Audit</span>
            </div>
          </div>

          {filteredExpeditions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No expeditions match your current search/filter query.
            </div>
          ) : (
            <div className="polar-table-wrapper">
              <table className="polar-table">
                <thead>
                  <tr>
                    <th>Expedition Name</th>
                    <th>Base Location</th>
                    <th>Status / Phase</th>
                    <th>Leader</th>
                    <th>Personnel</th>
                    <th>Cargo Weight</th>
                    <th>Vessel Support</th>
                    <th>Readiness Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpeditions.map((exp) => (
                    <tr key={exp.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: '#fff' }}>{exp.name}</div>
                        {exp.sub_title && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{exp.sub_title}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: 'var(--cyan-300)' }}>{exp.base_station || exp.location}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <StatusBadge status={exp.status} />
                          {exp.phase && (
                            <span className="mono-badge" style={{ fontSize: '10px' }}>{exp.phase}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: '#fff' }}>{exp.leader || 'Unassigned'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{exp.personnel_count} Members</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{exp.cargo_weight}</td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{exp.vessel_support || 'None'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '60px',
                              height: '6px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${exp.readiness || 0}%`,
                                height: '100%',
                                background: (exp.readiness || 0) >= 85 ? 'var(--hazard-green)' : 'var(--hazard-amber)'
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: (exp.readiness || 0) >= 85 ? 'var(--hazard-green)' : 'var(--hazard-amber)' }}>
                            {exp.readiness || 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: CARGO & ASSETS ─── */}
      {activeTab === 'cargo' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Package size={18} className="panel-title-icon" />
              <span className="panel-title">Cargo Tracking & Cold-Chain Manifest Audit</span>
            </div>
          </div>

          {filteredCargo.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No cargo consignments match your current filter parameters.
            </div>
          ) : (
            <div className="polar-table-wrapper">
              <table className="polar-table">
                <thead>
                  <tr>
                    <th>Cargo Code</th>
                    <th>Item Description</th>
                    <th>Category</th>
                    <th>Weight</th>
                    <th>Transit Stage / Location</th>
                    <th>Priority</th>
                    <th>Temperature</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCargo.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)' }}>
                        {c.cargo_code}
                      </td>
                      <td style={{ color: '#fff', fontWeight: '600' }}>
                        {c.name}
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {c.origin} → {c.destination}
                        </div>
                      </td>
                      <td>
                        <span className="mono-badge">{c.category}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{c.weight}</td>
                      <td>
                        <div style={{ color: '#fff' }}>{c.current_location}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Stage: {c.stage} ({c.transit_mode})</div>
                      </td>
                      <td>
                        <span
                          className="mono-badge"
                          style={{
                            color: c.priority === 'Critical' ? 'var(--hazard-red)' : c.priority === 'High' ? 'var(--hazard-amber)' : 'var(--text-secondary)',
                            borderColor: c.priority === 'Critical' ? 'var(--hazard-red-border)' : 'var(--border-subtle)'
                          }}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: c.temperature_log && c.temperature_log.includes('-') ? 'var(--cyan-300)' : '#fff' }}>
                        {c.temperature_log || 'N/A'}
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: INVENTORY & DEFICITS ─── */}
      {activeTab === 'inventory' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Boxes size={18} className="panel-title-icon" />
              <span className="panel-title">Station Inventory Levels & Stockout Deficit Analysis</span>
            </div>
          </div>

          {filteredInventory.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No inventory records match the selected criteria.
            </div>
          ) : (
            <div className="polar-table-wrapper">
              <table className="polar-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Available Stock</th>
                    <th>Min Threshold</th>
                    <th>Deficit / Surplus</th>
                    <th>Storage Bunker</th>
                    <th>Days Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const deficit = item.minimum_quantity - item.quantity;
                    const hasShortage = deficit > 0;

                    return (
                      <tr key={item.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)' }}>
                          {item.item_code}
                        </td>
                        <td style={{ color: '#fff', fontWeight: '600' }}>
                          {item.item_name}
                        </td>
                        <td>
                          <span className="mono-badge">{item.category}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: hasShortage ? 'var(--hazard-red)' : '#fff' }}>
                          {item.quantity} {item.unit}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {item.minimum_quantity} {item.unit}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {hasShortage ? (
                            <span style={{ color: 'var(--hazard-red)', fontWeight: '700' }}>
                              -{deficit} {item.unit}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--hazard-green)' }}>
                              +{Math.abs(deficit)} {item.unit}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.location}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: item.days_remaining < 30 ? 'var(--hazard-red)' : '#fff' }}>
                          {item.days_remaining} Days
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: PERSONNEL & VITALS ─── */}
      {activeTab === 'personnel' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <Users size={18} className="panel-title-icon" />
              <span className="panel-title">Personnel Deployment & Vital Telemetry Audit</span>
            </div>
          </div>

          {filteredPersonnel.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No personnel match your query.
            </div>
          ) : (
            <div className="polar-table-wrapper">
              <table className="polar-table">
                <thead>
                  <tr>
                    <th>Personnel ID</th>
                    <th>Full Name</th>
                    <th>Role / Department</th>
                    <th>Status</th>
                    <th>Current Location</th>
                    <th>Heart Rate</th>
                    <th>SpO2</th>
                    <th>Body Temp</th>
                    <th>Battery</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--cyan-300)' }}>
                        {p.personnel_code}
                      </td>
                      <td style={{ color: '#fff', fontWeight: '700' }}>
                        {p.name}
                        {p.specialization && (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '400' }}>
                            {p.specialization}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#fff' }}>{p.role}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{p.department}</div>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ color: 'var(--cyan-300)' }}>{p.current_location}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.heart_rate || '72 bpm'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--hazard-green)' }}>{p.spo2 || '98%'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{p.body_temp || '36.8°C'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: parseInt(p.battery) < 25 ? 'var(--hazard-red)' : 'var(--text-secondary)' }}>
                        {p.battery || '85%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: EMERGENCY & SAR ─── */}
      {activeTab === 'emergency' && (
        <div className="command-panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div className="panel-title-group">
              <ShieldAlert size={18} className="panel-title-icon" />
              <span className="panel-title">Emergency Response & SAR Operations History</span>
            </div>
          </div>

          {filteredIncidents.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No emergency incidents found matching the filter query.
            </div>
          ) : (
            <div className="polar-table-wrapper">
              <table className="polar-table">
                <thead>
                  <tr>
                    <th>Incident Code</th>
                    <th>Incident Title</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Sector / Location</th>
                    <th>Assigned Unit</th>
                    <th>Reported Timestamp</th>
                    <th>Resolution Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((inc) => (
                    <tr key={inc.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--hazard-red)' }}>
                        {inc.incident_code}
                      </td>
                      <td style={{ color: '#fff', fontWeight: '600' }}>
                        {inc.title}
                        {inc.reported_by && (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>By: {inc.reported_by}</div>
                        )}
                      </td>
                      <td>
                        <span className="mono-badge">{inc.incident_type}</span>
                      </td>
                      <td>
                        <span
                          className="mono-badge"
                          style={{
                            color: inc.severity === 'CRITICAL' ? 'var(--hazard-red)' : inc.severity === 'HIGH' ? 'var(--hazard-amber)' : 'var(--cyan-400)',
                            borderColor: inc.severity === 'CRITICAL' ? 'var(--hazard-red-border)' : 'var(--border-subtle)',
                            fontWeight: '700'
                          }}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={inc.status} />
                      </td>
                      <td style={{ color: 'var(--cyan-300)' }}>{inc.location_name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {inc.assigned_unit_code ? (
                          <span style={{ color: 'var(--cyan-400)', fontWeight: '700' }}>
                            {inc.assigned_unit_code}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {inc.created_at}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inc.resolution_notes || inc.description || '—'}
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
  );
}
