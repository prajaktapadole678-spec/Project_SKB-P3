import { useEffect, useRef, useState } from 'react';

const MAX_PTS = 33.33;

function ScoreRing({ score, color, size = 120 }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (displayed / 100) * circ;

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle className="score-ring-track" cx="60" cy="60" r={radius} />
        <circle
          className="score-ring-fill"
          cx="60" cy="60" r={radius}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="score-ring-center">
        <div className="score-ring-value" style={{ color }}>{displayed.toFixed(0)}</div>
        <div className="score-ring-max">/100</div>
      </div>
    </div>
  );
}

function SubScoreBar({ label, value, color }) {
  const [width, setWidth] = useState(0);
  const pct = Math.round((value / MAX_PTS) * 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="sub-score-row">
      <div className="sub-score-label">{label}</div>
      <div className="sub-score-bar-bg">
        <div
          className="sub-score-bar"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
      </div>
      <div className="sub-score-num" style={{ color }}>{value.toFixed(1)}</div>
    </div>
  );
}

export default function CropScoreCard({ data }) {
  const isSoy = data.crop_name.toLowerCase().includes('soy');
  const color = isSoy ? 'var(--soy-color)' : 'var(--wheat-color)';
  const cssClass = isSoy ? 'soybean' : 'wheat';
  const emoji = isSoy ? '🫘' : '🌾';

  return (
    <div className={`crop-card ${cssClass} fade-in-up`}>
      <div className="crop-card-header">
        <div className="crop-name">
          <span className="crop-emoji">{emoji}</span>
          {data.crop_name}
        </div>
        <span className={`status-badge status-${data.status}`}>{data.status}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <ScoreRing score={data.total_score} color={color} />
      </div>

      <div className="sub-scores">
        <SubScoreBar label="🌡️ Temp" value={data.temperature_score} color={color} />
        <SubScoreBar label="💧 Humidity" value={data.humidity_score} color={color} />
        <SubScoreBar label="🌧️ Rainfall" value={data.rainfall_score} color={color} />
      </div>

      {data.insights && data.insights.length > 0 && (
        <div className="insights-list">
          {data.insights.map((ins, i) => (
            <div key={i} className="insight-item">{ins}</div>
          ))}
        </div>
      )}
    </div>
  );
}
