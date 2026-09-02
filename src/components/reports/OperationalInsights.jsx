import React from 'react';
import { AlertTriangle, ShieldAlert, Package, Users, Compass, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function OperationalInsights({ insights = [], onSelectEntity }) {
  if (!insights || insights.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <CheckCircle2 size={20} style={{ color: 'var(--hazard-green)' }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>
            Nominal Polar Operations
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            No critical supply deficits, delayed assets, or unaddressed field emergencies detected in stored telemetry.
          </div>
        </div>
      </div>
    );
  }

  const getInsightIcon = (type) => {
    switch (type) {
      case 'CRITICAL_EMERGENCY':
        return <ShieldAlert size={18} style={{ color: 'var(--hazard-red)' }} />;
      case 'FIELD_RISK':
        return <Users size={18} style={{ color: 'var(--hazard-red)' }} />;
      case 'SUPPLY_DEFICIT':
        return <Package size={18} style={{ color: 'var(--hazard-amber)' }} />;
      case 'DELAYED_CARGO':
        return <Compass size={18} style={{ color: 'var(--accent-blue)' }} />;
      case 'LOW_READINESS':
        return <AlertTriangle size={18} style={{ color: 'var(--hazard-amber)' }} />;
      default:
        return <AlertTriangle size={18} style={{ color: 'var(--cyan-400)' }} />;
    }
  };

  const getBorderColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'rgba(239, 68, 68, 0.35)';
      case 'HIGH':
        return 'rgba(245, 158, 11, 0.35)';
      case 'MEDIUM':
        return 'rgba(234, 179, 8, 0.25)';
      default:
        return 'rgba(56, 189, 248, 0.25)';
    }
  };

  const getBgColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'rgba(239, 68, 68, 0.08)';
      case 'HIGH':
        return 'rgba(245, 158, 11, 0.06)';
      case 'MEDIUM':
        return 'rgba(234, 179, 8, 0.04)';
      default:
        return 'rgba(56, 189, 248, 0.04)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} style={{ color: 'var(--hazard-amber)' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Deterministic Operational Risk Insights
          </span>
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-400)' }}>
          {insights.length} Flagged Item{insights.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '10px' }}>
        {insights.map((item) => {
          const borderCol = getBorderColor(item.severity);
          const bgCol = getBgColor(item.severity);

          return (
            <div
              key={item.id}
              style={{
                background: bgCol,
                border: `1px solid ${borderCol}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getInsightIcon(item.type)}
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>
                    {item.title}
                  </span>
                </div>
                <span
                  className="mono-badge"
                  style={{
                    fontSize: '9.5px',
                    padding: '2px 6px',
                    background: item.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: item.severity === 'CRITICAL' ? 'var(--hazard-red)' : 'var(--hazard-amber)',
                    border: `1px solid ${borderCol}`
                  }}
                >
                  {item.severity}
                </span>
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {item.message}
              </div>

              {item.action_hint && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--cyan-300)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '2px solid var(--cyan-400)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span><strong>Action:</strong> {item.action_hint}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
