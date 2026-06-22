"use client";

import { AlertTriangle } from "lucide-react";

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDestructive = true }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in-up"
      onMouseDown={onClose}
    >
      <div 
        className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6 flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-primary-500/10 text-primary-500'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1">{title}</h2>
            <p className="text-sm text-foreground/70 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
