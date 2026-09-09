import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExpeditionsPage from './pages/ExpeditionsPage';
import CargoAssetsPage from './pages/CargoAssetsPage';
import InventoryPage from './pages/InventoryPage';
import PersonnelPage from './pages/PersonnelPage';
import MapTrackingPage from './pages/MapTrackingPage';
import EmergencyPage from './pages/EmergencyPage';
import ReportsPage from './pages/ReportsPage';
import SmartAutomationPage from './pages/SmartAutomationPage';
import SettingsPage from './pages/SettingsPage';
import QuickModal from './components/common/QuickModal';
import StatusBadge from './components/common/StatusBadge';
import { ShieldAlert, Box, Users, Radio, Check } from 'lucide-react';
import { api } from './services/api';
import './styles/index.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/cargo.css';
import './styles/inventory.css';
import './styles/personnel.css';
import './styles/map.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState(null);
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  // Expedition-scoped navigation filter (set when jumping from Expeditions page)
  const [expeditionNavFilter, setExpeditionNavFilter] = useState(null);

  useEffect(() => {
    // Check existing stored authentication session
    const storedUser = api.getStoredUser();
    if (storedUser && api.isAuthenticated()) {
      setCurrentUser(storedUser);
      // Validate with server in background
      api.getCurrentUser().then(user => {
        if (user) setCurrentUser(user);
        else setCurrentUser(null);
        setIsAuthLoading(false);
      }).catch(() => {
        setIsAuthLoading(false);
      });
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleOpenAlert = (alert) => {
    setSelectedAlert(alert);
    setDispatchFeedback(null);
  };

  const handleConfirmSARDispatch = async () => {
    if (!selectedAlert || isDispatching || selectedAlert.status === 'DISPATCHED') return;
    setIsDispatching(true);
    setDispatchFeedback(null);

    try {
      // 1. Parse coordinates if available
      const coords = selectedAlert.coordinates || '';
      let lat = null;
      let lon = null;
      if (coords) {
        const decMatch = coords.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
        if (decMatch) {
          const pLat = parseFloat(decMatch[1]);
          const pLon = parseFloat(decMatch[2]);
          if (!isNaN(pLat) && !isNaN(pLon) && pLat >= -90 && pLat <= 90 && pLon >= -180 && pLon <= 180) {
            lat = pLat;
            lon = pLon;
          }
        }
      }

      // 2. Find matching active incident or create one
      const activeIncidents = await api.getActiveIncidents();
      let targetIncident = null;

      if (Array.isArray(activeIncidents) && activeIncidents.length > 0) {
        targetIncident = activeIncidents.find(inc =>
          (selectedAlert.title && inc.title && (inc.title.toLowerCase().includes(selectedAlert.title.toLowerCase()) || selectedAlert.title.toLowerCase().includes(inc.title.toLowerCase()))) ||
          (lat !== null && inc.latitude !== null && Math.abs(inc.latitude - lat) < 0.05 && Math.abs(inc.longitude - lon) < 0.05)
        );

        if (!targetIncident) {
          targetIncident = activeIncidents.find(inc => ['REPORTED', 'ACKNOWLEDGED', 'TRIAGED'].includes(inc.status));
        }
      }

      // If no active incident exists to dispatch, register a new one for this alert
      if (!targetIncident) {
        targetIncident = await api.createIncident({
          title: selectedAlert.title || 'Emergency Distress Beacon',
          incident_type: 'MEDICAL',
          severity: selectedAlert.severity || 'CRITICAL',
          reported_by: selectedAlert.source || 'Station Telemetry',
          location_name: selectedAlert.coordinates || selectedAlert.source || 'Maitri Sector',
          latitude: lat !== null ? lat : -70.7670,
          longitude: lon !== null ? lon : 11.7400,
          description: selectedAlert.description || 'Emergency distress beacon. Immediate SAR dispatch authorized.'
        });
      }

      let unitCode = '';
      let unitName = '';

      if (targetIncident) {
        // 3. Ensure a response unit is assigned
        if (!targetIncident.assigned_unit_id) {
          const units = await api.getResponseUnits();
          const availableUnit = Array.isArray(units) ? units.find(u => u.status === 'AVAILABLE') || units[0] : null;
          if (availableUnit) {
            await api.assignIncidentUnit(targetIncident.id, {
              response_unit_id: availableUnit.id,
              actor: currentUser?.full_name || currentUser?.username || 'Operations Commander',
              notes: `Assigned unit ${availableUnit.unit_code} for immediate SAR intercept at coordinates (${targetIncident.latitude || lat || -70.767}, ${targetIncident.longitude || lon || 11.74}).`
            });
            unitCode = availableUnit.unit_code;
            unitName = availableUnit.name;
          }
        } else {
          unitCode = targetIncident.assigned_unit_code || '';
          unitName = targetIncident.assigned_unit_name || '';
        }

        // 4. Dispatch the incident if not already dispatched
        if (['REPORTED', 'ACKNOWLEDGED', 'TRIAGED'].includes(targetIncident.status)) {
          await api.dispatchIncident(targetIncident.id, {
            actor: currentUser?.full_name || currentUser?.username || 'Operations Commander',
            notes: `Immediate SAR Unit dispatched to coordinates: ${selectedAlert.coordinates || targetIncident.location_name || 'Maitri Sector'}.`
          });
        }
      }

      // 5. Update backend alert if ID is numeric
      if (selectedAlert.id && typeof selectedAlert.id === 'number') {
        try {
          await api.updateAlert(selectedAlert.id, {
            status: 'DISPATCHED',
            action_required: `SAR Unit ${unitCode || 'Alpha-1'} dispatched to ${selectedAlert.coordinates || 'Maitri Sector'}. Tracking beacon active.`
          });
        } catch (updateErr) {
          console.warn('[POLAR-X] Alert status update sync warning:', updateErr);
        }
      }

      // 6. Update local selectedAlert state & feedback
      const unitLabel = unitCode ? `${unitCode} (${unitName || 'Field Rescue'})` : 'SAR Alpha-1';
      const coordLabel = selectedAlert.coordinates || (targetIncident?.location_name) || 'Maitri Sector';

      setSelectedAlert(prev => prev ? ({
        ...prev,
        status: 'DISPATCHED',
        actionRequired: `SAR Unit ${unitLabel} dispatched to coordinates: ${coordLabel}. Real-time telemetry tracking active.`
      }) : null);

      setDispatchFeedback({
        type: 'success',
        message: `SAR Unit ${unitLabel} successfully dispatched to coordinates: ${coordLabel}. Incident status updated to DISPATCHED.`
      });
    } catch (err) {
      console.error('[POLAR-X] SAR Dispatch failed:', err);
      setDispatchFeedback({
        type: 'error',
        message: `Dispatch failed: ${err.message || 'Unable to contact emergency response units.'}`
      });
    } finally {
      setIsDispatching(false);
    }
  };

  // If user is not authenticated, render Login Page
  if (!isAuthLoading && !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Loading spinner while validating token
  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--cyan-400)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="radar-sweep-icon" style={{ width: '36px', height: '36px', border: '2px solid var(--cyan-400)', borderRadius: '50%', borderTopColor: 'transparent' }} />
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Verifying Polar Command Security Clearance...</span>
        </div>
      </div>
    );
  }

  // Role permissions check
  const allowedTabs = currentUser?.permissions || [
    'dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency', 'reports', 'settings'
  ];

  const renderActivePage = () => {
    // If current user does not have permission for activeTab, fallback to dashboard
    const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : (allowedTabs[0] || 'dashboard');

    switch (effectiveTab) {
      case 'dashboard':
        return (
          <DashboardPage 
            onNavigateTab={setActiveTab}
            onSelectAlert={handleOpenAlert}
            onSelectCargo={(cargo) => setSelectedCargo(cargo)}
            onSelectPersonnel={(person) => setSelectedPerson(person)}
          />
        );
      case 'expeditions':
        return (
          <ExpeditionsPage
            onNavigate={(tab, opts) => {
              setExpeditionNavFilter(opts || null);
              setActiveTab(tab);
            }}
          />
        );
      case 'cargo':
        return (
          <CargoAssetsPage
            key={expeditionNavFilter?.expeditionId ?? 'cargo'}
            onSelectCargo={(cargo) => setSelectedCargo(cargo)}
            initialExpeditionId={expeditionNavFilter?.expeditionId || null}
          />
        );
      case 'inventory':
        return <InventoryPage />;
      case 'personnel':
        return (
          <PersonnelPage
            key={expeditionNavFilter?.expeditionId ?? 'personnel'}
            onSelectPersonnel={(person) => setSelectedPerson(person)}
            initialExpeditionId={expeditionNavFilter?.expeditionId || null}
          />
        );
      case 'map':
        return (
          <MapTrackingPage 
            onSelectPersonnel={(person) => setSelectedPerson(person)}
            onSelectCargo={(cargo) => setSelectedCargo(cargo)}
          />
        );
      case 'emergency':
        return <EmergencyPage onSelectAlert={handleOpenAlert} />;
      case 'automation':
        return <SmartAutomationPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage currentUser={currentUser} />;
      default:
        return <DashboardPage onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={(tab) => { setExpeditionNavFilter(null); setActiveTab(tab); }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentUser={currentUser}
      />

      {/* Main App Canvas */}
      <div className="main-content-wrapper">
        <Header 
          activeTab={activeTab} 
          onOpenAlertModal={handleOpenAlert} 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        
        <main className="page-container">
          {renderActivePage()}
        </main>
      </div>

      {/* Inspection Modal for Emergency Alerts */}
      {selectedAlert && (
        <QuickModal
          isOpen={true}
          onClose={() => { setSelectedAlert(null); setDispatchFeedback(null); }}
          title={`Incident Details — ${selectedAlert.title}`}
          footerButtons={
            <>
              <button 
                className="btn-secondary" 
                onClick={() => { setSelectedAlert(null); setDispatchFeedback(null); }}
              >
                {selectedAlert.status === 'DISPATCHED' ? 'Close' : 'Dismiss'}
              </button>
              {selectedAlert.status === 'DISPATCHED' ? (
                <button 
                  className="btn-primary" 
                  disabled={true}
                  style={{ opacity: 0.9, cursor: 'default', background: 'rgba(16, 185, 129, 0.2)', borderColor: '#34d399', color: '#34d399' }}
                >
                  <Check size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  SAR Unit Dispatched
                </button>
              ) : (
                <button 
                  className="btn-danger" 
                  onClick={handleConfirmSARDispatch}
                  disabled={isDispatching}
                  style={{ opacity: isDispatching ? 0.7 : 1 }}
                >
                  <Radio size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  {isDispatching ? 'Dispatching SAR Unit...' : 'Confirm Immediate SAR Dispatch'}
                </button>
              )}
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <StatusBadge status={selectedAlert.status === 'DISPATCHED' ? 'DISPATCHED' : selectedAlert.severity} />
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {selectedAlert.timestamp}
              </span>
            </div>
            <div>
              <strong style={{ color: '#fff', fontSize: '14px' }}>Source Locator:</strong>
              <div style={{ color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '2px' }}>
                {selectedAlert.source}
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
              {selectedAlert.description}
            </p>
            <div style={{ background: 'rgba(8, 13, 26, 0.7)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Action Protocol
              </span>
              <div style={{ color: '#fff', fontSize: '12.5px', marginTop: '4px', fontWeight: '500' }}>
                {selectedAlert.actionRequired}
              </div>
            </div>

            {/* In-App Dispatch Status / Feedback */}
            {dispatchFeedback && (
              <div style={{
                background: dispatchFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${dispatchFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Check size={18} style={{ color: dispatchFeedback.type === 'success' ? '#34d399' : '#f87171', flexShrink: 0 }} />
                <div>
                  <div style={{ color: dispatchFeedback.type === 'success' ? '#34d399' : '#f87171', fontSize: '12.5px', fontWeight: '600' }}>
                    {dispatchFeedback.type === 'success' ? 'SAR Unit Successfully Dispatched' : 'Dispatch Action Failed'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: '2px' }}>
                    {dispatchFeedback.message}
                  </div>
                </div>
              </div>
            )}

            {!dispatchFeedback && selectedAlert.status === 'DISPATCHED' && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Check size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#34d399', fontSize: '12.5px', fontWeight: '600' }}>
                    SAR Mission In Progress
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: '2px' }}>
                    SAR response unit has been deployed to coordinates: {selectedAlert.coordinates || 'Maitri Sector'}.
                  </div>
                </div>
              </div>
            )}
          </div>
        </QuickModal>
      )}

      {/* Inspection Modal for Cargo Items */}
      {selectedCargo && (
        <QuickModal
          isOpen={true}
          onClose={() => setSelectedCargo(null)}
          title={`Cargo Manifest — ${selectedCargo.id}`}
          footerButtons={
            <button className="btn-primary" onClick={() => setSelectedCargo(null)}>
              Done
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ color: '#fff', fontSize: '16px' }}>{selectedCargo.name}</h4>
              <StatusBadge status={selectedCargo.status} />
            </div>
            <div className="exp-metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Weight</span>
                <span className="exp-metric-val">{selectedCargo.weight}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">RFID Tag</span>
                <span className="exp-metric-val" style={{ fontSize: '11px' }}>{selectedCargo.rfidTag}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Origin</span>
                <span className="exp-metric-val" style={{ fontSize: '12px' }}>{selectedCargo.origin}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Destination</span>
                <span className="exp-metric-val" style={{ fontSize: '12px', color: 'var(--cyan-300)' }}>{selectedCargo.destination}</span>
              </div>
            </div>
          </div>
        </QuickModal>
      )}

      {/* Inspection Modal for Personnel */}
      {selectedPerson && (
        <QuickModal
          isOpen={true}
          onClose={() => setSelectedPerson(null)}
          title={`Personnel Dossier — ${selectedPerson.id}`}
          footerButtons={
            <button className="btn-primary" onClick={() => setSelectedPerson(null)}>
              Close Dossier
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ color: '#fff', fontSize: '16px' }}>{selectedPerson.name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedPerson.role}</p>
              </div>
              <StatusBadge status={selectedPerson.status} />
            </div>
            <div className="exp-metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Base Station</span>
                <span className="exp-metric-val" style={{ fontSize: '13px' }}>{selectedPerson.station || selectedPerson.current_location || '—'}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Heart Rate</span>
                <span className="exp-metric-val">{selectedPerson.vitals?.hr || '—'}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Oxygen Saturation</span>
                <span className="exp-metric-val">{selectedPerson.vitals?.spo2 || '—'}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Core Body Temp</span>
                <span className="exp-metric-val">{selectedPerson.vitals?.temp || '—'}</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <strong>Current Activity: </strong> {selectedPerson.currentActivity || selectedPerson.current_activity || '—'}
            </div>
          </div>
        </QuickModal>
      )}
    </div>
  );
}
