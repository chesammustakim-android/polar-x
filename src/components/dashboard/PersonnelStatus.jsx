import React from 'react';
import { Users, HeartPulse, BatteryCharging, Radio, ShieldAlert } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function PersonnelStatus({ personnelList = [], onSelectPersonnel }) {
  return (
    <div className="personnel-list">
      {personnelList.slice(0, 5).map((person) => {
        const isSOS = person.status.includes('SOS');
        return (
          <div 
            key={person.id}
            className={`personnel-card ${isSOS ? 'alert-active' : ''}`}
            onClick={() => onSelectPersonnel && onSelectPersonnel(person)}
            style={{ cursor: onSelectPersonnel ? 'pointer' : 'default' }}
          >
            <div className="personnel-left">
              <div className={`personnel-avatar ${isSOS ? 'danger' : ''}`}>
                {person.id}
              </div>
              <div className="personnel-details">
                <h4>{person.name}</h4>
                <p>{person.role} • <strong style={{ color: 'var(--cyan-300)' }}>{person.station}</strong></p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="vitals-pill">
                <HeartPulse size={11} style={{ display: 'inline', marginRight: '4px', color: isSOS ? 'var(--hazard-red)' : 'var(--hazard-green)' }} />
                <span>{person.vitals.hr}</span>
              </div>
              <StatusBadge status={person.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
