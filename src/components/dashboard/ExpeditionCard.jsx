import React from 'react';
import { Flag, Users, Box, Navigation, Thermometer, Wind, CheckCircle2, ShieldAlert } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function ExpeditionCard({ expedition, onInspect }) {
  if (!expedition) return null;

  return (
    <div className="expedition-hero-card">
      {/* Top Title Row */}
      <div className="exp-top-row">
        <div className="exp-title-block">
          <h3>
            <Flag size={20} className="glow-cyan" />
            {expedition.name}
          </h3>
          <div className="exp-subtitle">{expedition.subTitle}</div>
        </div>
        <StatusBadge status={expedition.status} label="Active Mission" />
      </div>

      {/* Metrics Row */}
      <div className="exp-metrics-grid">
        <div className="exp-metric-item">
          <span className="exp-metric-label">Location</span>
          <span className="exp-metric-val">{expedition.location.split('(')[0].trim()}</span>
        </div>
        <div className="exp-metric-item">
          <span className="exp-metric-label">Personnel Deployed</span>
          <span className="exp-metric-val">{expedition.personnel} Scientists</span>
        </div>
        <div className="exp-metric-item">
          <span className="exp-metric-label">Cargo Allocation</span>
          <span className="exp-metric-val">{expedition.cargo}</span>
        </div>
        <div className="exp-metric-item">
          <span className="exp-metric-label">Support Vessel</span>
          <span className="exp-metric-val" style={{ fontSize: '13px' }}>MV Vasiliy Golovnin</span>
        </div>
      </div>

      {/* Mission Readiness Progress */}
      <div className="readiness-bar-container">
        <div className="readiness-header">
          <span style={{ color: 'var(--text-secondary)' }}>Operational Mission Readiness</span>
          <span style={{ color: 'var(--cyan-300)', fontWeight: '700' }}>{expedition.readiness}%</span>
        </div>
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${expedition.readiness}%` }}
          ></div>
        </div>
      </div>

      {/* Key Field Objectives */}
      <div className="exp-objectives-list">
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Active Field Directives
        </span>
        {expedition.keyObjectives.map((obj, i) => (
          <div key={i} className="exp-obj-item">
            <span className="obj-bullet"></span>
            <span>{obj}</span>
          </div>
        ))}
      </div>

      {/* Footer Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(56, 189, 248, 0.1)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Leader: <strong style={{ color: '#fff' }}>{expedition.leader}</strong>
        </span>
        {onInspect && (
          <button className="btn-secondary" onClick={() => onInspect(expedition)} style={{ fontSize: '11.5px', padding: '5px 12px' }}>
            Inspect Manifest & Telemetry
          </button>
        )}
      </div>
    </div>
  );
}
