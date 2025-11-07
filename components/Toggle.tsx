import React from 'react';

interface ToggleProps {
  label: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ label, enabled, setEnabled, disabled = false }) => {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-gray-300'}`}>{label}</span>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        disabled={disabled}
        className={`${
          enabled ? 'bg-indigo-600' : 'bg-gray-600'
        } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span
          className={`${
            enabled ? 'translate-x-6' : 'translate-x-1'
          } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
        />
      </button>
    </div>
  );
};
