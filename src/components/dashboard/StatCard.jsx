import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export default function StatCard({ title, value, subtext, trend, status, icon: Icon, isDanger = false, onClick }) {
  return (
    <div 
      className={`stat-card ${isDanger ? 'alert-card-danger' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className={`stat-icon-wrapper ${isDanger ? 'danger' : status === 'warning' ? 'warning' : ''}`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-footer">
        <span>{subtext}</span>
        {trend && (
          <span className={`stat-trend ${status || 'good'}`}>
            {status === 'critical' ? <AlertTriangle size={12} /> : <TrendingUp size={12} />}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
