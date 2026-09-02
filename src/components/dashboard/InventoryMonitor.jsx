import React from 'react';
import { Fuel, Utensils, HeartPulse, Wrench, Shield, AlertTriangle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function InventoryMonitor({ resources = [] }) {
  return (
    <div className="inventory-list">
      {resources.map((res) => {
        const isCritical = res.percentage <= 35;
        const isWarning = res.percentage > 35 && res.percentage <= 65;

        return (
          <div key={res.id} className="inventory-row">
            <div className="inventory-info-row">
              <span className="inv-name">{res.name}</span>
              <span className="inv-amount">
                {res.currentStock.toLocaleString()} / {res.totalCapacity.toLocaleString()} {res.unit}
              </span>
            </div>

            {/* Progress bar */}
            <div className="progress-track" style={{ height: '7px' }}>
              <div 
                className={`progress-fill ${isCritical ? 'danger' : isWarning ? 'warning' : ''}`}
                style={{ width: `${res.percentage}%` }}
              ></div>
            </div>

            <div className="inv-meta-row">
              <span>Consumption: <strong style={{ color: '#fff' }}>{res.burnRate}</strong></span>
              <span style={{ color: isCritical ? 'var(--hazard-red)' : 'var(--cyan-300)' }}>
                {isCritical && <AlertTriangle size={10} style={{ display: 'inline', marginRight: '3px' }} />}
                {res.daysRemaining} Days Reserve Remaining
              </span>
              <StatusBadge status={res.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
