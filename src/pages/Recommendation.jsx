import { useState, useEffect, useRef } from 'react';
import { ScoreBarChart } from '../components/ResilienceChart';
import { fetchPrediction } from '../api/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function ConfidenceBar({ confidence }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(confidence), 200);
    return () => clearTimeout(t);
  }, [confidence]);

  const color = confidence >= 70 ? 'var(--secondary)' : confidence >= 50 ? 'var(--primary)' : 'var(--accent)';
  return (
    <div className="confidence-bar-wrap">
      <span className="confidence-label">Confidence</span>
      <div className="confidence-bar-bg">
        <div className="confidence-bar" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <span className="confidence-pct" style={{ color }}>{confidence.toFixed(0)}%</span>
    </div>
  );
}

export default function Recommendation() {
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const reportRef = useRef();

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchPrediction();
      setPrediction(data);
      setError(null);
    } catch (e) {
      setError('Could not load recommendation. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    if (!prediction) return;
    const rows = [
      ['Field', 'Value'],
      ['City', prediction.city],
      ['Temperature (°C)', prediction.weather.temperature],
      ['Humidity (%)', prediction.weather.humidity],
      ['Rainfall est. (mm/mo)', prediction.weather.rainfall],
      ['Weather Source', prediction.weather.source],
      ['---', '---'],
      ...prediction.scores.flatMap(s => [
        [`${s.crop_name} - Total Score`, s.total_score],
        [`${s.crop_name} - Temp Score`, s.temperature_score],
        [`${s.crop_name} - Humidity Score`, s.humidity_score],
        [`${s.crop_name} - Rainfall Score`, s.rainfall_score],
        [`${s.crop_name} - Status`, s.status],
      ]),
      ['---', '---'],
      ['Recommended Crop', prediction.recommended_crop],
      ['Confidence (%)', prediction.confidence],
      ['Reason', prediction.recommendation_reason],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cropsense_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a0f1e',
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW    = pdf.internal.pageSize.getWidth();
      const pdfH    = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`cropsense_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const isSoy = prediction?.recommended_crop?.toLowerCase().includes('soy');
  const bannerClass = isSoy ? 'soy-rec' : 'wheat-rec';
  const cropColor   = isSoy ? 'var(--soy-color)' : 'var(--wheat-color)';
  const emoji       = isSoy ? '🫘' : '🌾';

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">🎯 Recommendation</h1>
          <p className="page-subtitle">Best crop for Pune under current weather conditions</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? '⏳' : '↻'} Refresh
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={!prediction}>
            📥 Export CSV
          </button>
          <button className="btn btn-primary" onClick={exportPDF} disabled={!prediction || exporting}>
            {exporting ? '⏳ Generating...' : '📄 Export PDF'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div ref={reportRef}>
        {/* Recommendation banner */}
        {loading ? (
          <div className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-xl)', marginBottom: 24 }} />
        ) : prediction ? (
          <div className={`rec-banner ${bannerClass}`}>
            <div className="rec-banner-icon">{emoji}</div>
            <div className="rec-banner-title" style={{ color: cropColor }}>
              ✅ {prediction.recommended_crop} is Best Suited
            </div>
            <div className="rec-banner-reason">{prediction.recommendation_reason}</div>
            <ConfidenceBar confidence={prediction.confidence} />
          </div>
        ) : null}

        {/* Score bar chart */}
        {prediction?.scores && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title">📊 Resilience Score Comparison</div>
            <div style={{ maxHeight: 200 }}>
              <ScoreBarChart scores={prediction.scores} />
            </div>
          </div>
        )}

        {/* Weather snapshot */}
        {prediction?.weather && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title">🌤️ Weather Snapshot — Pune</div>
            <div className="stats-row" style={{ marginBottom: 0 }}>
              <div className="stat-chip">
                <div className="stat-chip-value">{prediction.weather.temperature}°C</div>
                <div className="stat-chip-label">Temperature</div>
              </div>
              <div className="stat-chip">
                <div className="stat-chip-value">{prediction.weather.humidity}%</div>
                <div className="stat-chip-label">Humidity</div>
              </div>
              <div className="stat-chip">
                <div className="stat-chip-value">{prediction.weather.rainfall}</div>
                <div className="stat-chip-label">mm/mo Rain*</div>
              </div>
              <div className="stat-chip">
                <div className="stat-chip-value" style={{ fontSize: 18, textTransform: 'capitalize' }}>
                  {prediction.weather.source}
                </div>
                <div className="stat-chip-label">Data Source</div>
              </div>
            </div>
          </div>
        )}

        {/* Scores table */}
        {prediction?.scores && (
          <div className="card">
            <div className="card-title">📋 Detailed Scores</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>Temp</th>
                  <th>Humidity</th>
                  <th>Rainfall</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prediction.scores.map(s => (
                  <tr key={s.crop_name}>
                    <td style={{ fontWeight: 600 }}>
                      {s.crop_name.toLowerCase().includes('soy') ? '🫘' : '🌾'} {s.crop_name}
                      {s.crop_name === prediction.recommended_crop && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--secondary)' }}>★ Best</span>
                      )}
                    </td>
                    <td>{s.temperature_score.toFixed(1)}</td>
                    <td>{s.humidity_score.toFixed(1)}</td>
                    <td>{s.rainfall_score.toFixed(1)}</td>
                    <td style={{ fontWeight: 700 }}>{s.total_score.toFixed(1)}</td>
                    <td><span className={`status-badge status-${s.status}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              * Rainfall is an estimated monthly figure. Scores are out of 33.3 pts per dimension (100 total).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
