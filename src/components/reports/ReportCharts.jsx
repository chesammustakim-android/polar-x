import React, { useState } from 'react';

// Color map for consistent Polar Command Center aesthetics
const THEME_COLORS = {
  // Statuses
  ACTIVE: '#38bdf8', // Cyan
  COMPLETED: '#10b981', // Green
  PLANNING: '#a855f7', // Purple
  STANDBY: '#64748b', // Slate
  'IN TRANSIT': '#0ea5e9', // Blue
  DELIVERED: '#10b981', // Green
  PREPARING: '#f59e0b', // Amber
  DELAYED: '#ef4444', // Red
  NORMAL: '#10b981',
  LOW_STOCK: '#f59e0b',
  CRITICAL: '#ef4444',
  OUT_OF_STOCK: '#dc2626',
  AT_STATION: '#38bdf8',
  FIELD: '#06b6d4',
  EMERGENCY: '#ef4444',
  RESTING: '#64748b',
  OFF_DUTY: '#475569',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  REPORTED: '#f97316',
  ACKNOWLEDGED: '#eab308',
  TRIAGED: '#a855f7',
  DISPATCHED: '#06b6d4',
  IN_PROGRESS: '#38bdf8',
  RESOLVED: '#10b981',
  CANCELLED: '#64748b',
  // Departments & Categories
  'Science & Research': '#38bdf8',
  'Logistics & Operations': '#0ea5e9',
  'Engineering & Maintenance': '#f59e0b',
  'Medical & Health': '#10b981',
  'Command & Administration': '#a855f7',
  'Field Support & SAR': '#f43f5e',
  Food: '#10b981',
  Fuel: '#f59e0b',
  Medical: '#ef4444',
  'Scientific Equipment': '#38bdf8',
  'Heavy Machinery': '#a855f7',
  'General Supply': '#64748b',
  'Safety Equipment': '#06b6d4'
};

const DEFAULT_PALETTE = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#64748b', '#ec4899'];

export function DonutChart({ data = {}, title, totalLabel = "Total", size = 180, strokeWidth = 24 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const entries = Object.entries(data).filter(([_, val]) => val > 0);
  const total = entries.reduce((acc, [_, val]) => acc + val, 0);

  if (total === 0) {
    return (
      <div className="chart-empty-container" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '12px' }}>No distribution data</div>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const segments = entries.map(([label, val], idx) => {
    const percentage = val / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += percentage;

    const color = THEME_COLORS[label] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];

    return {
      label,
      val,
      percentage: Math.round(percentage * 100),
      strokeDasharray,
      strokeDashoffset,
      color,
      idx
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {title && <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{title}</div>}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={hoveredIdx === seg.idx ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: hoveredIdx === null || hoveredIdx === seg.idx ? 1 : 0.45
              }}
              onMouseEnter={() => setHoveredIdx(seg.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          {activeSegment ? (
            <>
              <div style={{ fontSize: '18px', fontWeight: '800', color: activeSegment.color }}>
                {activeSegment.val}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSegment.label} ({activeSegment.percentage}%)
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {total}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {totalLabel}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', justifyContent: 'center', maxWidth: '300px' }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: hoveredIdx === seg.idx ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={() => setHoveredIdx(seg.idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: seg.color,
                boxShadow: hoveredIdx === seg.idx ? `0 0 8px ${seg.color}` : 'none'
              }}
            />
            <span>{seg.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: seg.color }}>
              {seg.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarChart({ data = {}, title, maxVal = null }) {
  const entries = Object.entries(data);
  const total = entries.reduce((acc, [_, val]) => acc + val, 0);
  const highest = maxVal || Math.max(...entries.map(([_, val]) => val), 1);

  if (entries.length === 0 || total === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        No bar chart data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {title && <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{title}</div>}
      {entries.map(([label, val], idx) => {
        const pct = Math.round((val / highest) * 100);
        const color = THEME_COLORS[label] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];

        return (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#fff' }}>
                {val} <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '10px' }}>({total > 0 ? Math.round((val / total) * 100) : 0}%)</span>
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '7px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReadinessGauge({ value = 90, title = "Fleet Readiness Benchmark", subtext = "Average score across expeditions" }) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const color = percentage >= 85 ? '#10b981' : percentage >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px'
      }}
    >
      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>{title}</div>
      <div style={{ position: 'relative', width: '120px', height: '65px', overflow: 'hidden' }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="12"
            strokeDasharray="141.37 282.74" // Half circle
            strokeDashoffset="0"
          />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="transparent"
            stroke={color}
            strokeWidth="12"
            strokeDasharray="141.37 282.74"
            strokeDashoffset={141.37 - (percentage / 100) * 141.37}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: '800',
            fontFamily: 'var(--font-mono)',
            color: color
          }}
        >
          {percentage}%
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{subtext}</div>
    </div>
  );
}
