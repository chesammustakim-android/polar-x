import React from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert, Radio, Send, Check } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function EmergencyPanel({ alerts = [], onAcknowledgeAlert, onOpenDetails }) {
  return (
    <div className="alert-feed">
      {alerts.map((alert) => {
        const isCritical = alert.severity === 'CRITICAL';
        const isWarning = alert.severity === 'WARNING';
        const isInfo = alert.severity === 'INFO';

        return (
          <div 
            key={alert.id} 
            className={`emergency-item ${isCritical ? 'critical' : isWarning ? 'warning' : 'info'}`}
          >
            {/* Top Row */}
            <div className="emergency-item-top">
              <div className="emergency-title">
                {isCritical ? (
                  <ShieldAlert size={18} style={{ color: 'var(--hazard-red)' }} />
                ) : isWarning ? (
                  <AlertTriangle size={18} style={{ color: 'var(--hazard-amber)' }} />
                ) : (
                  <Info size={18} style={{ color: 'var(--cyan-400)' }} />
                )}
                <span>{alert.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge status={alert.severity} />
                <span className="emergency-timestamp">{alert.timestamp}</span>
              </div>
            </div>

            {/* Description */}
            <div className="emergency-desc">{alert.description}</div>

            {/* Action Bar */}
            <div className="emergency-action-bar">
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Action Protocol: </span>
                <span>{alert.actionRequired}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isCritical && (
                  <button 
                    className="btn-danger"
                    style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => onOpenDetails && onOpenDetails(alert)}
                  >
                    <Radio size={12} />
                    Track SAR Intercept
                  </button>
                )}
                {onAcknowledgeAlert && alert.status !== 'RESOLVED' && (
                  <button 
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => onAcknowledgeAlert(alert.id)}
                  >
                    <Check size={12} />
                    ACK
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
