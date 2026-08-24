import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { MdWbSunny, MdNightsStay } from 'react-icons/md';

export default function ThemeToggle({ variant = 'icon', showLabel = false }) {
  const { themeMode, setThemeMode, toggleTheme } = useTheme();

  if (variant === 'segmented' || showLabel) {
    return (
      <div className="theme-segmented-control" role="group" aria-label="Select Theme Mode">
        <button
          type="button"
          className={`segmented-btn ${themeMode === 'light' ? 'active' : ''}`}
          onClick={() => setThemeMode('light')}
          title="Light Mode"
        >
          <MdWbSunny size={16} />
          <span>Light</span>
        </button>

        <button
          type="button"
          className={`segmented-btn ${themeMode === 'dark' ? 'active' : ''}`}
          onClick={() => setThemeMode('dark')}
          title="Dark Mode"
        >
          <MdNightsStay size={16} />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={`Current Theme: ${themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}. Click to switch.`}
      aria-label="Toggle Theme"
    >
      {themeMode === 'dark' ? (
        <MdNightsStay className="theme-icon text-amber" size={18} />
      ) : (
        <MdWbSunny className="theme-icon text-amber" size={18} />
      )}
    </button>
  );
}
