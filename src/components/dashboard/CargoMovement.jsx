import React from 'react';
import { Box, Truck, Ship, Plane, Thermometer, QrCode } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function CargoMovement({ cargoList = [], onSelectCargo }) {
  return (
    <div className="polar-table-wrapper">
      <table className="polar-table">
        <thead>
          <tr>
            <th>Cargo ID & Item</th>
            <th>Weight</th>
            <th>Route (Origin → Dest)</th>
            <th>Mode</th>
            <th>Cold-Chain Temp</th>
            <th>Status</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {cargoList.map((item) => (
            <tr 
              key={item.id}
              onClick={() => onSelectCargo && onSelectCargo(item)}
              style={{ cursor: onSelectCargo ? 'pointer' : 'default' }}
            >
              <td>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="cargo-code">{item.id}</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>{item.name}</span>
                </div>
              </td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>{item.weight}</td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11.5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.origin}</span>
                  <span style={{ color: 'var(--cyan-300)', fontWeight: '600' }}>→ {item.destination}</span>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={13} style={{ color: 'var(--cyan-400)' }} />
                  <span style={{ fontSize: '11.5px' }}>{item.transitMode}</span>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan-200)' }}>
                  <Thermometer size={12} />
                  <span>{item.temperatureLog}</span>
                </div>
              </td>
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: item.priority === 'Critical' ? 'var(--hazard-red)' : 'var(--text-secondary)' }}>
                {item.eta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
