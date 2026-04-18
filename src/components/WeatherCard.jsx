function getWeatherIcon(description = '') {
  const d = description.toLowerCase();
  if (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) return '🌧️';
  if (d.includes('thunder') || d.includes('storm'))  return '⛈️';
  if (d.includes('snow'))    return '❄️';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫️';
  if (d.includes('cloud'))   return '⛅';
  if (d.includes('clear'))   return '☀️';
  return '🌤️';
}

export default function WeatherCard({ data, loading, onRefresh, refreshing }) {
  if (loading) {
    return (
      <div className="weather-hero">
        <div className="skeleton" style={{ height: 32, width: 160, marginBottom: 24, borderRadius: 100 }} />
        <div className="skeleton" style={{ height: 80, width: 200, marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="weather-hero fade-in">
      {/* Header row */}
      <div className="weather-city-row">
        <span className="weather-city-badge">📍 {data.city}, India</span>
        <span className={`weather-source-badge ${data.source}`}>
          {data.source === 'live' ? '🔴 Live' : '🟡 Mock'}
        </span>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="btn btn-secondary"
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}
          title="Refresh weather"
        >
          {refreshing
            ? <><span className="refresh-spinner" /> Updating...</>
            : <><span>↻</span> Refresh</>}
        </button>
      </div>

      {/* Main temperature */}
      <div className="weather-main">
        <div className="weather-temp">{data.temperature}°</div>
        <div className="weather-desc-block">
          <div className="weather-icon">{getWeatherIcon(data.description)}</div>
          <div className="weather-desc">{data.description}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Feels like {data.feels_like}°C
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="weather-stats">
        <div className="weather-stat">
          <div className="weather-stat-icon">💧</div>
          <div className="weather-stat-value">{data.humidity}%</div>
          <div className="weather-stat-label">Humidity</div>
        </div>
        <div className="weather-stat">
          <div className="weather-stat-icon">🌧️</div>
          <div className="weather-stat-value">{data.rainfall}</div>
          <div className="weather-stat-label">Rain mm/mo*</div>
        </div>
        <div className="weather-stat">
          <div className="weather-stat-icon">💨</div>
          <div className="weather-stat-value">{data.wind_speed}</div>
          <div className="weather-stat-label">Wind km/h</div>
        </div>
      </div>

      {data.source === 'mock' && (
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          * Mock data — add OpenWeatherMap API key in backend/.env for live data
        </div>
      )}
    </div>
  );
}
