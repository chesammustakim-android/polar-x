import React, { useState, useEffect } from 'react';
import { Flag, Compass, Calendar, Users, Box, CheckCircle, ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { EXPEDITIONS as DEFAULT_EXPEDITIONS } from '../data/mockData';
import StatusBadge from '../components/common/StatusBadge';

export default function ExpeditionsPage({ onSelectExpedition }) {
  const [expeditions, setExpeditions] = useState(DEFAULT_EXPEDITIONS);
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await api.getExpeditions();
      if (data && data.length > 0) {
        setExpeditions(data.map(e => ({
          id: e.id,
          name: e.name,
          subTitle: e.sub_title || e.phase,
          location: e.location,
          baseStation: e.base_station || "Maitri Station",
          status: e.status,
          phase: e.phase,
          leader: e.leader,
          personnel: e.personnel_count,
          cargo: e.cargo_weight,
          readiness: e.readiness,
          vesselSupport: e.vessel_support
        })));
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const filtered = expeditions.filter(exp => {
    if (filterRegion === 'ANTARCTICA') return (exp.location || '').includes('Antarctica');
    if (filterRegion === 'ARCTIC') return (exp.location || '').includes('Arctic');
    return true;
  });

  return (
    <div className="placeholder-page">
      <div className="placeholder-hero">
        <div className="placeholder-info">
          <div className="module-meta-badge">
            <Compass size={14} />
            <span>EXPEDITIONS MANAGEMENT DIRECTORY • MOES / NCPOR</span>
          </div>
          <h2>Scientific Expedition Planning & Roster</h2>
          <p>
            Centralized coordination for Indian Scientific Expeditions to Antarctica (ISEA), 
            Arctic Svalbard operations at Himadri, and Southern Ocean expeditions.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['ALL', 'ANTARCTICA', 'ARCTIC'].map(tab => (
            <button 
              key={tab}
              className={`btn-secondary ${filterRegion === tab ? 'active' : ''}`}
              onClick={() => setFilterRegion(tab)}
              style={{
                background: filterRegion === tab ? 'rgba(56, 189, 248, 0.2)' : undefined,
                borderColor: filterRegion === tab ? 'var(--cyan-400)' : undefined,
                color: filterRegion === tab ? '#fff' : undefined
              }}
            >
              {tab} Missions
            </button>
          ))}
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {filtered.length} MISSIONS LOADED FROM API
        </span>
      </div>

      {/* Expeditions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {filtered.map(exp => (
          <div key={exp.id} className="command-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Flag size={18} style={{ color: 'var(--cyan-400)' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{exp.name}</h3>
                  <StatusBadge status={exp.status} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
                  {exp.subTitle} • {exp.phase}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="mono-badge" style={{ color: 'var(--text-muted)' }}>ID: EXP-{exp.id}</span>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginTop: '4px' }}>
                  Readiness: <span style={{ color: 'var(--cyan-300)' }}>{exp.readiness}%</span>
                </div>
              </div>
            </div>

            <div className="exp-metrics-grid" style={{ marginBottom: '16px' }}>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Base Station</span>
                <span className="exp-metric-val">{exp.baseStation}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Team Leader</span>
                <span className="exp-metric-val" style={{ fontSize: '13px' }}>{exp.leader}</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Deployed Crew</span>
                <span className="exp-metric-val">{exp.personnel} Scientists</span>
              </div>
              <div className="exp-metric-item">
                <span className="exp-metric-label">Allocated Cargo</span>
                <span className="exp-metric-val">{exp.cargo}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <span>Vessel Support: <strong style={{ color: '#fff' }}>{exp.vesselSupport}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ fontSize: '11.5px', padding: '6px 12px' }}
                  onClick={() => alert(`Showing logistics dossier for ${exp.name}`)}
                >
                  View Logistics Dossier
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
