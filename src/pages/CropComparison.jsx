import { useState, useEffect } from 'react';
import CropScoreCard from '../components/CropScoreCard';
import { RadarChart } from '../components/ResilienceChart';
import FileUpload from '../components/FileUpload';
import { fetchPrediction } from '../api/client';

export default function CropComparison() {
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchPrediction();
      setPrediction(data);
      setError(null);
    } catch (e) {
      setError('Could not load prediction data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const scores = prediction?.scores || [];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🌾 Crop Comparison</h1>
        <p className="page-subtitle">
          Wheat vs Soybean resilience under current Pune conditions
        </p>
      </div>

      {/* Action bar */}
      <div className="btn-group" style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? '⏳ Loading...' : '↻ Refresh Scores'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setShowUpload(v => !v)}
        >
          📂 {showUpload ? 'Hide Upload' : 'Upload Crop Traits CSV'}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">📂 Update Crop Trait Data</div>
          <FileUpload onSuccess={() => { setShowUpload(false); load(); }} />
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Weather summary pill */}
      {prediction?.weather && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          📍 Pune — {prediction.weather.temperature}°C &nbsp;|&nbsp;
          💧 {prediction.weather.humidity}% humidity &nbsp;|&nbsp;
          🌧️ ~{prediction.weather.rainfall} mm/mo rainfall
        </div>
      )}

      {/* Score cards */}
      {loading ? (
        <div className="grid-2">
          {[0, 1].map(i => (
            <div key={i} className="card" style={{ height: 300 }}>
              <div className="skeleton" style={{ height: '100%', borderRadius: 'var(--radius-md)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-2">
          {scores.map(score => (
            <CropScoreCard key={score.crop_name} data={score} />
          ))}
        </div>
      )}

      {/* Radar chart */}
      {scores.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">📡 Multi-Dimension Radar</div>
          <div style={{ maxWidth: 500, margin: '0 auto', padding: '12px 0' }}>
            <RadarChart scores={scores} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            Each axis shows score out of 33.3 pts (max per dimension)
          </div>
        </div>
      )}

      {/* Traits comparison table */}
      {prediction?.scores && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">📋 Score Breakdown</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dimension</th>
                {scores.map(s => <th key={s.crop_name}>{s.crop_name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'temperature_score', label: '🌡️ Temperature' },
                { key: 'humidity_score',    label: '💧 Humidity'    },
                { key: 'rainfall_score',    label: '🌧️ Rainfall'   },
                { key: 'total_score',       label: '⭐ Total'        },
              ].map(row => (
                <tr key={row.key}>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                  {scores.map(s => (
                    <td key={s.crop_name} style={{ fontWeight: row.key === 'total_score' ? 700 : 400 }}>
                      {s[row.key].toFixed(1)}
                      {row.key === 'total_score' ? ' / 100' : ' / 33.3'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>🏷️ Status</td>
                {scores.map(s => (
                  <td key={s.crop_name}>
                    <span className={`status-badge status-${s.status}`}>{s.status}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
