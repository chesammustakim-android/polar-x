import React, { useState, useEffect, useCallback } from 'react';
import {
  Flag, Compass, Calendar, Users, Box, CheckCircle, ShieldCheck,
  Search, Filter, RefreshCw, MapPin, AlertTriangle, Loader,
  ExternalLink, ChevronRight, Activity
} from 'lucide-react';
import { api } from '../services/api';
import { EXPEDITIONS as DEFAULT_EXPEDITIONS } from '../data/mockData';
import StatusBadge from '../components/common/StatusBadge';
import QuickModal from '../components/common/QuickModal';

// ─── Readiness Bar ─────────────────────────────────────────────────────────────
function ReadinessBar({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color, minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── Readiness Category Row ───────────────────────────────────────────────────
function ReadinessRow({ label, value }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ─── Clickable Metric Item ─────────────────────────────────────────────────────
function ClickableMetric({ label, value, onClick, icon: Icon }) {
  return (
    <div
      className="exp-metric-item"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      title={onClick ? `Click to view ${label}` : undefined}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.background = 'rgba(56,189,248,0.08)';
        e.currentTarget.style.borderColor = 'rgba(56,189,248,0.35)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.background = '';
        e.currentTarget.style.borderColor = '';
      } : undefined}
    >
      <span className="exp-metric-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {Icon && <Icon size={11} style={{ opacity: 0.7 }} />}
        {label}
        {onClick && <ChevronRight size={10} style={{ opacity: 0.5, marginLeft: 'auto' }} />}
      </span>
      <span className="exp-metric-val">{value}</span>
    </div>
  );
}

// ─── Dossier Modal Content ─────────────────────────────────────────────────────
function DossierContent({ exp, readiness, isLoadingReadiness }) {
  const readinessPct = exp.readiness || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Flag size={16} style={{ color: 'var(--cyan-400)' }} />
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>{exp.name}</h4>
            <StatusBadge status={exp.status} />
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--cyan-300)', fontFamily: 'var(--font-mono)' }}>
            {exp.subTitle} • {exp.phase}
          </div>
        </div>
        <span className="mono-badge" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>ID: EXP-{exp.id}</span>
      </div>

      {/* Readiness */}
      <div style={{ background: 'rgba(8,13,26,0.6)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.08em' }}>
          <ShieldCheck size={11} style={{ display: 'inline', marginRight: '5px' }} />
          Mission Readiness Analysis
        </div>
        {isLoadingReadiness ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
            <Loader size={13} className="radar-sweep-icon" /> Loading readiness data…
          </div>
        ) : readiness && readiness.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {readiness.map((r, i) => (
              <ReadinessRow
                key={i}
                label={r.category || r.name || `Category ${i + 1}`}
                value={r.readiness_pct ?? r.readiness ?? r.percentage ?? 0}
              />
            ))}
          </div>
        ) : (
          <ReadinessBar value={readinessPct} />
        )}
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {[
          { label: 'Base Station', value: exp.baseStation },
          { label: 'Team Leader',  value: exp.leader },
          { label: 'Location',     value: exp.location },
          { label: 'Vessel Support', value: exp.vesselSupport },
          { label: 'Deployed Crew', value: `${exp.personnel} Scientists` },
          { label: 'Allocated Cargo', value: exp.cargo },
        ].map(({ label, value }) => (
          <div key={label} className="exp-metric-item">
            <span className="exp-metric-label">{label}</span>
            <span className="exp-metric-val" style={{ fontSize: '13px' }}>{value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpeditionsPage({ onNavigate }) {
  const [expeditions, setExpeditions] = useState(DEFAULT_EXPEDITIONS);
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dossier modal state
  const [dossierExp, setDossierExp] = useState(null);
  const [dossierReadiness, setDossierReadiness] = useState([]);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);

  const loadExpeditions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getExpeditions();
      if (data && data.length > 0) {
        setExpeditions(data.map(e => ({
          id: e.id,
          name: e.name,
          subTitle: e.sub_title || e.phase,
          location: e.location,
          baseStation: e.base_station || 'Maitri Station',
          status: e.status,
          phase: e.phase,
          leader: e.leader,
          personnel: e.personnel_count,
          cargo: e.cargo_weight,
          readiness: e.readiness,
          vesselSupport: e.vessel_support
        })));
      }
    } catch (err) {
      setError('Failed to load expeditions from server. Showing cached data.');
      console.warn('[ExpeditionsPage] Load error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadExpeditions(); }, [loadExpeditions]);

  // Open dossier: fetch expedition detail + readiness
  const openDossier = async (exp) => {
    setDossierExp(exp);
    setDossierReadiness([]);
    setIsLoadingReadiness(true);
    try {
      const [detail, readiness] = await Promise.allSettled([
        api.getExpeditionById(exp.id),
        api.getExpeditionReadiness(exp.id),
      ]);

      // Merge any extra fields from detail into the exp object
      if (detail.status === 'fulfilled' && detail.value) {
        const d = detail.value;
        setDossierExp(prev => ({
          ...prev,
          subTitle: d.sub_title || prev.subTitle,
          phase: d.phase || prev.phase,
          leader: d.leader || prev.leader,
          location: d.location || prev.location,
          baseStation: d.base_station || prev.baseStation,
          vesselSupport: d.vessel_support || prev.vesselSupport,
        }));
      }

      if (readiness.status === 'fulfilled' && Array.isArray(readiness.value)) {
        setDossierReadiness(readiness.value);
      }
    } catch (err) {
      console.warn('[ExpeditionsPage] Dossier fetch error:', err.message);
    } finally {
      setIsLoadingReadiness(false);
    }
  };

  // Region filter: case-insensitive, also handles 'Svalbard' for Arctic
  const filtered = expeditions.filter(exp => {
    if (filterRegion === 'ALL') return true;
    const loc = (exp.location || '').toLowerCase();
    if (filterRegion === 'ANTARCTICA') return loc.includes('antarctica') || loc.includes('antarct');
    if (filterRegion === 'ARCTIC') return loc.includes('arctic') || loc.includes('svalbard') || loc.includes('himadri');
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
          <h2>Scientific Expedition Planning &amp; Roster</h2>
          <p>
            Centralized coordination for Indian Scientific Expeditions to Antarctica (ISEA),
            Arctic Svalbard operations at Himadri, and Southern Ocean expeditions.
          </p>
        </div>
      </div>

      {/* Filter Tabs + Refresh */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-secondary" onClick={loadExpeditions} disabled={isLoading} style={{ padding: '6px 10px' }}>
            <RefreshCw size={13} className={isLoading ? 'radar-sweep-icon' : ''} style={{ display: 'inline', marginRight: '4px' }} />
            Refresh
          </button>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {filtered.length} MISSIONS LOADED
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: '#fca5a5' }}>{error}</span>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
          <Loader size={16} className="radar-sweep-icon" />
          Loading expeditions…
        </div>
      )}

      {/* Expeditions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {filtered.map(exp => (
          <div
            key={exp.id}
            className="command-panel"
            style={{
              padding: '20px',
              cursor: 'pointer',
              transition: 'border-color 0.18s, box-shadow 0.18s',
            }}
            onClick={() => openDossier(exp)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(56,189,248,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.boxShadow = '';
            }}
            title="Click to open Logistics Dossier"
          >
            {/* Card Header */}
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
                <div style={{ marginTop: '6px' }}>
                  <ReadinessBar value={exp.readiness} />
                </div>
              </div>
            </div>

            {/* Metrics Grid — individual items are clickable */}
            <div
              className="exp-metrics-grid"
              style={{ marginBottom: '16px' }}
              onClick={(e) => e.stopPropagation()} // prevent card click when clicking metrics
            >
              <ClickableMetric
                label="Base Station"
                value={exp.baseStation}
                icon={MapPin}
                onClick={onNavigate ? (e) => {
                  e.stopPropagation();
                  onNavigate('map');
                } : null}
              />
              <div className="exp-metric-item">
                <span className="exp-metric-label">Team Leader</span>
                <span className="exp-metric-val" style={{ fontSize: '13px' }}>{exp.leader}</span>
              </div>
              <ClickableMetric
                label="Deployed Crew"
                value={`${exp.personnel} Scientists`}
                icon={Users}
                onClick={onNavigate ? (e) => {
                  e.stopPropagation();
                  onNavigate('personnel', { expeditionId: exp.id });
                } : null}
              />
              <ClickableMetric
                label="Allocated Cargo"
                value={exp.cargo}
                icon={Box}
                onClick={onNavigate ? (e) => {
                  e.stopPropagation();
                  onNavigate('cargo', { expeditionId: exp.id });
                } : null}
              />
            </div>

            {/* Card Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <span>Vessel Support: <strong style={{ color: '#fff' }}>{exp.vesselSupport}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '11.5px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openDossier(exp);
                  }}
                >
                  <Activity size={12} />
                  View Logistics Dossier
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Compass size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px' }}>No expeditions match the selected region filter.</p>
          </div>
        )}
      </div>

      {/* Logistics Dossier Modal */}
      {dossierExp && (
        <QuickModal
          isOpen={true}
          onClose={() => { setDossierExp(null); setDossierReadiness([]); }}
          title={`Logistics Dossier — ${dossierExp.name}`}
          footerButtons={
            <>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px' }}
                onClick={() => { setDossierExp(null); setDossierReadiness([]); }}
              >
                Close
              </button>
              {onNavigate && (
                <>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => {
                      setDossierExp(null);
                      onNavigate('map');
                    }}
                  >
                    <MapPin size={12} /> View on Map
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => {
                      const id = dossierExp.id;
                      setDossierExp(null);
                      onNavigate('personnel', { expeditionId: id });
                    }}
                  >
                    <Users size={12} /> View Crew
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => {
                      const id = dossierExp.id;
                      setDossierExp(null);
                      onNavigate('cargo', { expeditionId: id });
                    }}
                  >
                    <Box size={12} /> View Cargo
                  </button>
                </>
              )}
            </>
          }
        >
          <DossierContent
            exp={dossierExp}
            readiness={dossierReadiness}
            isLoadingReadiness={isLoadingReadiness}
          />
        </QuickModal>
      )}
    </div>
  );
}
