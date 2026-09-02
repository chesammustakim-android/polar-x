import React from 'react';

export default function StatusBadge({ status, label, className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/[\s_]+/g, '-');
  
  let variant = 'neutral';
  // Critical / danger states
  if (['critical', 'danger', 'sos-active', 'alert', 'critical-reorder', 'delayed', 'out-of-stock',
       'emergency'].includes(normalized)) {
    variant = 'critical';
  // Warning / caution states
  } else if (['warning', 'pending', 'monitoring', 'caution', 'at-port', 'low-stock', 'shortage',
              'needs-attention', 'needs-attention'].includes(normalized)) {
    variant = 'warning';
  // Success / normal / positive states
  } else if (['active', 'operational', 'delivered', 'optimal', 'good', 'success', 'normal', 'ready',
              'at-station', 'at station'].includes(normalized)) {
    variant = 'success';
  // Info / in-motion states
  } else if (['in-transit', 'info', 'customs-cleared', 'loaded', 'field',
              'in-transit'].includes(normalized)) {
    variant = 'info';
  // Neutral / passive states
  } else if (['preparing', 'resting', 'off-duty', 'off duty'].includes(normalized)) {
    variant = 'neutral';
  }

  // Format label nicely if not provided
  const displayLabel = label || (status ? status.replace(/_/g, ' ') : '');

  return (
    <span className={`status-badge ${variant} ${className}`}>
      <span className="status-dot"></span>
      {displayLabel}
    </span>
  );
}
