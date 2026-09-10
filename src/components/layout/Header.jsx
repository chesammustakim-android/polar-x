import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Clock, 
  ShieldCheck, 
  Radio, 
  User, 
  Activity,
  CheckCircle2,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { SYSTEM_META, EMERGENCY_ALERTS } from '../../data/mockData';
import { api } from '../../services/api';
import StatusBadge from '../common/StatusBadge';

export default function Header({ activeTab, onOpenAlertModal, currentUser, onLogout, refreshTrigger }) {
  const [utcTime, setUtcTime] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  const userName = currentUser?.full_name || SYSTEM_META.adminUser.name;
  const userRole = (currentUser?.role || SYSTEM_META.adminUser.role).replace('_', ' ');
  const userStation = currentUser?.station || SYSTEM_META.adminUser.station;
  const userEmail = currentUser?.email || 'operator@ncpor.res.in';

  // Compute initials
  const initials = userName
    .split(' ')
    .filter(n => !n.startsWith('Dr.') && !n.startsWith('Capt.') && !n.startsWith('Lt.') && !n.startsWith('Cdr.'))
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PX';

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${mins}:${secs} UTC`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      setIsLoadingAlerts(true);
      const data = await api.getAlerts();
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data);
      } else {
        setAlerts(EMERGENCY_ALERTS);
      }
    } catch (err) {
      console.warn('[POLAR-X Header] Failed to fetch alerts:', err);
      setAlerts(EMERGENCY_ALERTS);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [activeTab, refreshTrigger]);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Command Center Dashboard';
      case 'expeditions': return 'Polar Expeditions Registry';
      case 'cargo': return 'Cargo Tracking & Cold-Chain Assets';
      case 'inventory': return 'Station Inventory & Supply Levels';
      case 'personnel': return 'Personnel Roster & Vital Telemetry';
      case 'map': return 'Polar Geospatial Tracking & Radar';
      case 'emergency': return 'Emergency Response & SAR Hub';
      case 'automation': return 'Smart Operations & Predictive Analytics';
      case 'reports': return 'Expedition Analytics & Supply Reports';
      case 'settings': return 'Station Systems & Comms Configuration';
      default: return 'Polar Expedition Command Center';
    }
  };

  return (
    <header className="polar-header">
      {/* Page Title & Breadcrumb */}
      <div className="header-left">
        <div className="header-title-block">
          <h1>{getPageTitle()}</h1>
          <div className="header-breadcrumb">
            <span>NCPOR POLAR-X</span>
            <span>/</span>
            <span style={{ color: 'var(--cyan-400)' }}>{activeTab.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div className="header-search-bar">
        <Search className="search-icon" />
        <input 
          type="text" 
          placeholder="Search assets, cargo IDs (CRG-102), personnel (P-042)..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Right Controls: Clock, Sat Status, Notifications, User Profile */}
      <div className="header-right">
        {/* UTC Clock */}
        <div className="telemetry-pill">
          <Clock size={14} className="clock-icon" />
          <span>{utcTime || '00:00:00 UTC'}</span>
        </div>

        {/* SAT LINK */}
        <div className="telemetry-pill" title={SYSTEM_META.satComStatus.network}>
          <Radio size={14} style={{ color: 'var(--hazard-green)' }} />
          <span>SAT-COM 99.8%</span>
        </div>

        {/* Direct Logout button — 1-click session switch */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Log out of current session"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'rgba(239,100,100,0.9)',
              fontSize: '11.5px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
            }}
          >
            <LogOut size={13} />
            Log Out
          </button>
        )}

        {/* Notifications Button */}
        <div style={{ position: 'relative' }}>
          <button 
            className="action-btn" 
            onClick={() => {
              const next = !isNotifOpen;
              setIsNotifOpen(next);
              if (next) loadAlerts();
              if (isProfileOpen) setIsProfileOpen(false);
            }}
            title="Emergency Alerts & Notifications"
          >
            <Bell size={18} />
            {alerts.some(a => (a.severity || '').toUpperCase() === 'CRITICAL' && (a.status || '').toUpperCase() !== 'RESOLVED') && (
              <span className="btn-ping-badge"></span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <div 
              style={{
                position: 'absolute',
                top: '70px',
                right: '0',
                width: '360px',
                maxHeight: '480px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                zIndex: 60,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>Live Telemetry Feeds</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                    {alerts.length} Alerts
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); loadAlerts(); }}
                    title="Refresh alerts"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Activity size={13} className={isLoadingAlerts ? 'spin-icon' : ''} />
                  </button>
                </div>
              </div>

              {/* Scrollable list of alerts */}
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflowY: 'auto',
                  maxHeight: '380px',
                  paddingRight: '4px'
                }}
              >
                {alerts.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No alerts logged in telemetry.
                  </div>
                ) : (
                  alerts.map(alert => {
                    const isCritical = (alert.severity || '').toUpperCase() === 'CRITICAL';
                    const isDispatched = (alert.status || '').toUpperCase() === 'DISPATCHED';
                    const isResolved = (alert.status || '').toUpperCase() === 'RESOLVED';

                    return (
                      <div 
                        key={alert.id}
                        onClick={() => {
                          if (onOpenAlertModal) {
                            onOpenAlertModal({
                              ...alert,
                              description: alert.message || alert.description,
                              actionRequired: alert.action_required || alert.actionRequired || 'None'
                            });
                          }
                          setIsNotifOpen(false);
                        }}
                        style={{
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          background: isCritical 
                            ? (isResolved ? 'rgba(15, 23, 42, 0.8)' : 'rgba(239, 68, 68, 0.12)')
                            : 'rgba(15, 23, 42, 0.8)',
                          border: isCritical && !isResolved
                            ? '1px solid var(--hazard-red-border)' 
                            : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ 
                            fontSize: '11.5px', 
                            fontWeight: '700', 
                            color: isCritical && !isResolved ? 'var(--hazard-red)' : '#fff',
                            lineHeight: '1.3'
                          }}>
                            {alert.title}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {alert.timestamp}
                          </span>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {alert.message || alert.description}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <StatusBadge status={alert.severity} />
                            {alert.status && alert.status !== 'ACTIVE' && (
                              <StatusBadge status={alert.status} />
                            )}
                          </div>
                          {alert.coordinates && (
                            <span style={{ fontSize: '9.5px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                              {alert.coordinates}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Card & Dropdown */}
        <div style={{ position: 'relative' }}>
          <div 
            className="user-profile-btn" 
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              if (isNotifOpen) setIsNotifOpen(false);
            }}
            style={{ cursor: 'pointer' }}
            title={`${userName} (${userRole}) • Click for session options`}
          >
            <div className="avatar-box">{initials}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">{userRole}</span>
            </div>
          </div>

          {/* User Profile Menu */}
          {isProfileOpen && (
            <div
              style={{
                position: 'absolute',
                top: '70px',
                right: '0',
                width: '280px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                zIndex: 60,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.1))',
                    border: '1px solid var(--cyan-400)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#fff'
                  }}
                >
                  {initials}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--cyan-400)', fontFamily: 'var(--font-mono)' }}>
                    {userRole}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <div><strong>Station:</strong> {userStation}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>Email:</strong> {userEmail}
                </div>
                {currentUser?.permissions && (
                  <div>
                    <strong>Modules Access:</strong> {currentUser.permissions.length} Operational Views
                  </div>
                )}
              </div>

              {onLogout && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  Sign Out of Session
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

