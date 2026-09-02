import React from 'react';
import { Warehouse, Anchor, Ship, Snowflake, Home, CheckCircle2 } from 'lucide-react';

export default function CargoTimeline({ currentStage = 'Warehouse', currentStatus = 'Preparing' }) {
  const stages = [
    { id: 'Warehouse', label: 'Warehouse', icon: Warehouse, desc: 'Origin Packaged' },
    { id: 'Port', label: 'Port', icon: Anchor, desc: 'Customs & Staging' },
    { id: 'Ship', label: 'Ship', icon: Ship, desc: 'Ocean Transit' },
    { id: 'Antarctica', label: 'Antarctica', icon: Snowflake, desc: 'Ice Shelf / Traverse' },
    { id: 'Research Station', label: 'Research Station', icon: Home, desc: 'Station Delivered' }
  ];

  const getStageIndex = (stageName) => {
    const s = (stageName || '').toLowerCase();
    if (s.includes('warehouse') || s.includes('prepar')) return 0;
    if (s.includes('port') || s.includes('custom')) return 1;
    if (s.includes('ship') || s.includes('loaded') || s.includes('transit')) return 2;
    if (s.includes('antarctica') || s.includes('ice') || s.includes('shelf') || s.includes('delayed')) return 3;
    if (s.includes('station') || s.includes('base') || s.includes('deliver')) return 4;
    return 0;
  };

  const currentIndex = getStageIndex(currentStage || currentStatus);

  return (
    <div className="cargo-timeline-wrapper">
      <div className="timeline-track-bar">
        <div 
          className="timeline-progress-fill" 
          style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
        ></div>
      </div>

      <div className="timeline-stages-row">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <div 
              key={stage.id} 
              className={`timeline-step ${isCurrent ? 'current' : isCompleted ? 'completed' : 'pending'}`}
            >
              <div className="timeline-node">
                {isCompleted ? (
                  <CheckCircle2 size={16} className="step-check" />
                ) : (
                  <Icon size={16} />
                )}
              </div>
              <span className="timeline-step-label">{stage.label}</span>
              <span className="timeline-step-desc">{stage.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
