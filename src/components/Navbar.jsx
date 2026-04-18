import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',           icon: '🌤️',  label: 'Dashboard',       sub: 'Live weather & analysis' },
  { to: '/compare',   icon: '🌾',  label: 'Crop Comparison',  sub: 'Wheat vs Soybean' },
  { to: '/recommend', icon: '🎯',  label: 'Recommendation',   sub: 'Best crop today' },
];

const CITIES = ['Pune', 'Nagpur'];
const CITY_FLAGS = { Pune: '🏙️', Nagpur: '🌆' };

export default function Navbar({ city, onCityChange }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <div className="navbar-logo-icon">🌱</div>
        <div>
          <div className="navbar-logo-text">CropSense</div>
          <div className="navbar-logo-sub">AGRI INTELLIGENCE</div>
        </div>
      </div>

      <div className="nav-section-label">Navigation</div>

      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <div>
            <div style={{ lineHeight: 1.3 }}>{item.label}</div>
            <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 400 }}>{item.sub}</div>
          </div>
        </NavLink>
      ))}

      {/* ── City Selector ── */}
      <div className="nav-section-label" style={{ marginTop: 24 }}>Location</div>
      <div className="city-switcher">
        {CITIES.map(c => (
          <button
            key={c}
            className={`city-switch-btn ${city === c ? 'active' : ''}`}
            onClick={() => onCityChange(c)}
          >
            <span>{CITY_FLAGS[c]}</span> {c}
          </button>
        ))}
      </div>

      {/* ── Settings ── */}
      <div className="nav-section-label" style={{ marginTop: 24 }}>Settings</div>
      <button className="nav-item" onClick={toggleTheme}>
        <span className="nav-item-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
        <div>
          <div style={{ lineHeight: 1.3 }}>Theme</div>
          <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </div>
        </div>
      </button>

      <div className="navbar-footer">
        <div className="city-badge">
          <div className="city-dot" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
              {city}, India
            </div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Active city</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
