import React from 'react';
import { 
  Compass, 
  LayoutDashboard, 
  Flag, 
  Box, 
  Boxes, 
  Users, 
  MapPin, 
  AlertTriangle, 
  FileText, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Radio,
  Cpu,
  Building
} from 'lucide-react';
import { SYSTEM_META } from '../../data/mockData';
import { api } from '../../services/api';

const ROLE_PERMISSIONS = {
  ADMIN: ['dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency', 'reports', 'automation', 'stations', 'settings'],
  EXPEDITION_DIRECTOR: ['dashboard', 'expeditions', 'cargo', 'inventory', 'personnel', 'map', 'emergency', 'reports', 'automation', 'stations'],
  STATION_HEAD: ['dashboard', 'stations', 'inventory', 'map'],
  LOGISTICS_OFFICER: ['dashboard', 'cargo', 'inventory', 'expeditions', 'reports', 'map', 'automation'],
  EXPEDITION_LEADER: ['dashboard', 'expeditions', 'personnel', 'map', 'emergency', 'reports', 'automation'],
  SAR_OFFICER: ['dashboard', 'emergency', 'map', 'personnel', 'reports', 'automation'],
  FIELD_OPERATOR: ['dashboard', 'personnel', 'map', 'automation']
};

export default function Sidebar({ activeTab, onSelectTab, isCollapsed, onToggleCollapse, criticalAlertCount = 2, currentUser }) {
  const [personnelCount, setPersonnelCount] = React.useState(null);

  React.useEffect(() => {
    api.getPersonnelSummary()
      .then(res => {
        if (res && res.total_personnel != null) {
          setPersonnelCount(res.total_personnel);
        }
      })
      .catch(() => {});
  }, [activeTab]);

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'expeditions', label: 'Expeditions', icon: Flag, badge: '3' },
    { id: 'stations', label: currentUser?.role === 'STATION_HEAD' ? 'Station Command' : 'Station Management', icon: Building },
    { id: 'cargo', label: 'Cargo & Assets', icon: Box },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'personnel', label: 'Personnel', icon: Users, badge: personnelCount != null ? String(personnelCount) : null },
    { id: 'map', label: 'Map & Tracking', icon: MapPin },
    { id: 'emergency', label: 'Emergency Response', icon: AlertTriangle, badge: criticalAlertCount > 0 ? `${criticalAlertCount} SOS` : null, badgeClass: 'danger' },
    { id: 'automation', label: 'Smart Operations', icon: Cpu },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const allowedTabs = currentUser?.permissions || (currentUser?.role ? ROLE_PERMISSIONS[currentUser.role] : null);
  const navItems = allowedTabs ? allNavItems.filter(item => allowedTabs.includes(item.id)) : allNavItems;

  return (
    <aside className={`polar-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header / Brand */}
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-icon-box">
            <Compass size={22} className="radar-sweep-icon" />
          </div>
          {!isCollapsed && (
            <div className="brand-text">
              <span className="brand-title">{SYSTEM_META.appName}</span>
              <span className="brand-subtitle">MoES • NCPOR POLAR-OPS</span>
            </div>
          )}
        </div>
        <button 
          className="collapse-btn" 
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {!isCollapsed && <div className="nav-section-title">Operations Control</div>}
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="nav-icon" />
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className={`nav-badge ${item.badgeClass || ''}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer / SAT-COM Live Link */}
      <div className="sidebar-footer">
        <div className="satlink-status-box">
          <div className="satlink-indicator"></div>
          {!isCollapsed && (
            <div className="satlink-info">
              <span className="satlink-label">IRIDIUM SAT-LINK</span>
              <span className="satlink-sub">Maitri Base • 99.8%</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
