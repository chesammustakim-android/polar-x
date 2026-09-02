import React from 'react';
import { X } from 'lucide-react';

export default function QuickModal({ isOpen, onClose, title, children, footerButtons }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close Modal">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footerButtons && (
          <div className="modal-footer">
            {footerButtons}
          </div>
        )}
      </div>
    </div>
  );
}
