import { useState, useEffect, useCallback } from 'react';
import WeatherCard from '../components/WeatherCard';
import { fetchWeather, fetchCrops, fetchScenario } from '../api/client';

const SOIL_TYPES = ['Loamy', 'Clay', 'Sandy', 'Silty'];
const SOIL_ICONS = { Loamy: '🟫', Clay: '🟤', Sandy: '🟨', Silty: '⬛' };
const SOIL_DESC  = {
  Loamy:  'Rich & balanced — ideal for most crops',
  Clay:   'Dense & water-retentive — suits soybean',
  Sandy:  'Light & fast-draining — needs irrigation',
  Silty:  'Smooth & fertile — excellent moisture retention',
};

function ScoreRing({ score, color }) {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, color }}>{score.toFixed(0)}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/100</div>
      </div>
    </div>
  );
}

function ComparisonCard({ label, score, isTarget, isBest }) {
  const isSoy = score.crop_name.toLowerCase().includes('soy');
  const color = isTarget ? 'var(--primary)' : isSoy ? 'var(--soy-color)' : 'var(--wheat-color)';
  const emoji = isSoy ? '🫘' : '🌾';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isTarget ? 'var(--border-accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      position: 'relative',
      transition: 'var(--transition)',
      boxShadow: isTarget ? 'var(--shadow-glow)' : 'var(--shadow-card)',
    }}>
      {isTarget && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 12px', borderRadius: 100, letterSpacing: 1, whiteSpace: 'nowrap',
        }}>
          YOUR CHOICE
        </div>
      )}
      {isBest && !isTarget && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--secondary)', color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 12px', borderRadius: 100, letterSpacing: 1, whiteSpace: 'nowrap',
        }}>
          ★ BEST MATCH
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 17, color }}>
            {score.crop_name}
          </div>
          <span className={`status-badge status-${score.status}`}>{score.status}</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <ScoreRing score={score.total_score} color={color} />
        </div>
      </div>

      {/* Score bars */}
      {[
        { label: '🌡️ Temp',     val: score.temperature_score, max: 33.33 },
        { label: '💧 Humidity', val: score.humidity_score,    max: 33.33 },
        { label: '🌧️ Rainfall', val: score.rainfall_score,    max: 33.33 },
        { label: '🌱 Soil',     val: score.soil_score,        max: 10 },
      ].map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</div>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 100,
              width: `${(row.val / row.max) * 100}%`,
              background: color,
              transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, width: 42, textAlign: 'right', color }}>{row.val.toFixed(1)}</div>
        </div>
      ))}

      {/* Soil match badge */}
      <div style={{
        marginTop: 14, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
        background: score.soil_match ? 'rgba(104,211,145,0.1)' : 'rgba(252,129,129,0.1)',
        border: `1px solid ${score.soil_match ? 'rgba(104,211,145,0.25)' : 'rgba(252,129,129,0.25)'}`,
        fontSize: 12, color: score.soil_match ? '#68d391' : '#fc8181',
      }}>
        {score.soil_match ? '✅ Soil type is compatible' : '⚠️ Soil type mismatch — may reduce yield'}
      </div>

      {/* Insights */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {score.insights.map((ins, i) => (
          <div key={i} style={{
            fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px',
            borderLeft: `2px solid ${color}44`,
          }}>{ins}</div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ city }) {
  const [weather,    setWeather]    = useState(null);
  const [crops,      setCrops]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Scenario form state
  const [soilType,     setSoilType]     = useState('Loamy');
  const [targetCrop,   setTargetCrop]   = useState('');
  const [scenario,     setScenario]     = useState(null);
  const [scenarioLoad, setScenarioLoad] = useState(false);
  const [scenarioErr,  setScenarioErr]  = useState(null);

  const loadWeather = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await fetchWeather(city);
      setWeather(data);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch weather. Is the backend running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city]);

  useEffect(() => {
    loadWeather();
    fetchCrops().then(data => {
      setCrops(data);
      if (data.length > 0) setTargetCrop(data[0].crop_name);
    }).catch(() => {});
    const interval = setInterval(() => loadWeather(true), 60_000);
    return () => clearInterval(interval);
  }, [loadWeather]);

  // Reset scenario when city changes
  useEffect(() => { setScenario(null); }, [city]);

  const runScenario = async () => {
    if (!targetCrop) return;
    try {
      setScenarioLoad(true);
      setScenarioErr(null);
      const data = await fetchScenario(city, soilType, targetCrop);
      setScenario(data);
    } catch (e) {
      setScenarioErr(e?.response?.data?.detail || 'Failed to run scenario. Is the backend running?');
    } finally {
      setScenarioLoad(false);
    }
  };

  const cropNames = crops.map(c => c.crop_name);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🌤️ Weather Dashboard</h1>
        <p className="page-subtitle">
          Live conditions for {city} — powering crop resilience analysis
          {lastUpdate && (
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              · Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <WeatherCard
        data={weather}
        loading={loading}
        onRefresh={() => loadWeather(true)}
        refreshing={refreshing}
      />

      {/* ── Scenario Analysis Form ─────────────────────────────────── */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-title">🔬 Grow Scenario Analysis</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          Select your soil type and the crop you want to grow. We'll score your choice against all
          other crops using {city}'s weather conditions and show how well it fits.
        </p>

        {/* Soil Type Selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 1 — Select Your Soil Type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SOIL_TYPES.map(soil => (
              <button
                key={soil}
                onClick={() => setSoilType(soil)}
                style={{
                  padding: '14px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${soilType === soil ? 'var(--border-accent)' : 'var(--border)'}`,
                  background: soilType === soil ? 'var(--primary-glow)' : 'var(--bg-card)',
                  color: soilType === soil ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{SOIL_ICONS[soil]}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{soil}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, lineHeight: 1.4 }}>{SOIL_DESC[soil]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Crop Selector */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 2 — Which Crop Do You Want to Grow?
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {cropNames.length > 0 ? cropNames.map(cn => {
              const isSoy = cn.toLowerCase().includes('soy');
              const isSelected = targetCrop === cn;
              return (
                <button
                  key={cn}
                  onClick={() => setTargetCrop(cn)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--border-accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--primary-glow)' : 'var(--bg-card)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {isSoy ? '🫘' : '🌾'} {cn}
                </button>
              );
            }) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>
                Loading available crops…
              </div>
            )}
          </div>
        </div>

        {/* Run button */}
        <button
          className="btn btn-primary"
          onClick={runScenario}
          disabled={scenarioLoad || !targetCrop}
          style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
        >
          {scenarioLoad ? '⏳ Analyzing…' : `🚀 Run Scenario — ${targetCrop} in ${city} on ${soilType} Soil`}
        </button>
        {scenarioErr && <div className="alert alert-error" style={{ marginTop: 12 }}>⚠️ {scenarioErr}</div>}
      </div>

      {/* ── Auto-Comparison Results ───────────────────────────────── */}
      {scenario && (
        <div style={{ marginTop: 32 }} className="fade-in">
          {/* Summary banner */}
          <div style={{
            background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-card) 100%)',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-xl)',
            padding: 28,
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Scenario Results — {scenario.city} · {scenario.soil_type} Soil
              </div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                {scenario.recommended_crop === scenario.target_crop ? (
                  <span style={{ color: 'var(--primary)' }}>✅ Great Choice! {scenario.target_crop} is recommended.</span>
                ) : (
                  <span style={{ color: 'var(--accent)' }}>💡 Consider {scenario.recommended_crop} — it scores higher.</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {scenario.recommendation_reason}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Confidence</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
                {scenario.confidence.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Score comparison cards */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            📊 Auto-Comparison: {scenario.target_crop} vs All Crops
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {scenario.scores.map(score => (
              <ComparisonCard
                key={score.crop_name}
                label={score.crop_name}
                score={score}
                isTarget={score.crop_name.toLowerCase() === scenario.target_crop.toLowerCase()}
                isBest={score.crop_name === scenario.recommended_crop}
              />
            ))}
          </div>

          {/* Key Takeaway */}
          {scenario.best_alternative && scenario.best_alternative.crop_name !== scenario.target_crop && (
            <div className="card" style={{ marginTop: 24, background: 'var(--secondary-glow)', borderColor: 'var(--secondary)' }}>
              <div className="card-title" style={{ color: 'var(--secondary)' }}>💡 Key Takeaway</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                On <strong style={{ color: 'var(--text-primary)' }}>{scenario.soil_type}</strong> soil in{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{scenario.city}</strong>,{' '}
                <strong style={{ color: 'var(--primary)' }}>{scenario.best_alternative.crop_name}</strong> scores{' '}
                <strong style={{ color: 'var(--primary)' }}>{scenario.best_alternative.total_score}/100</strong> vs{' '}
                <strong style={{ color: 'var(--accent)' }}>{scenario.target_crop}</strong> at{' '}
                <strong style={{ color: 'var(--accent)' }}>{scenario.target_score?.total_score}/100</strong>.
                {scenario.target_score && scenario.best_alternative.total_score > scenario.target_score.total_score ? (
                  <> Switching crops could improve resilience by <strong style={{ color: 'var(--primary)' }}>
                    +{(scenario.best_alternative.total_score - scenario.target_score.total_score).toFixed(1)} pts
                  </strong>.</>
                ) : (
                  <> Your crop choice is already the most resilient option for these conditions! 🎉</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stored Crop Traits */}
      {crops.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>🌱 Stored Crop Traits</div>
          <div className="grid-2">
            {crops.map(crop => {
              const isSoy  = crop.crop_name.toLowerCase().includes('soy');
              const color  = isSoy ? 'var(--soy-color)' : 'var(--wheat-color)';
              const emoji  = isSoy ? '🫘' : '🌾';
              return (
                <div key={crop.id} className="card" style={{ borderTop: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 28 }}>{emoji}</span>
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 18 }}>
                        {crop.crop_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{crop.description}</div>
                    </div>
                  </div>
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--text-secondary)' }}>🌡️ Optimal Temp</td>
                        <td style={{ fontWeight: 600, color }}>{crop.optimal_temp_min}°C – {crop.optimal_temp_max}°C</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-secondary)' }}>💧 Humidity</td>
                        <td style={{ fontWeight: 600, color }}>{crop.optimal_humidity_min}% – {crop.optimal_humidity_max}%</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-secondary)' }}>🌧️ Rainfall</td>
                        <td style={{ fontWeight: 600, color }}>{crop.optimal_rainfall_min} – {crop.optimal_rainfall_max} mm/mo</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-secondary)' }}>🌱 Ideal Soil</td>
                        <td style={{ fontWeight: 600, color }}>{crop.optimal_soil_type || 'Loamy'}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--text-secondary)' }}>🔥 Heat Tolerance</td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{crop.heat_tolerance}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
