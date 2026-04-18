import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler,
  Tooltip, Legend, CategoryScale, LinearScale, BarElement
);

const CHART_DEFAULTS = {
  color: 'rgba(255,255,255,0.6)',
  font: { family: 'Inter, sans-serif', size: 12 },
};

ChartJS.defaults.color = CHART_DEFAULTS.color;
ChartJS.defaults.font  = CHART_DEFAULTS.font;

/* ─── Radar Chart (3 dimensions per crop) ─── */
export function RadarChart({ scores }) {
  if (!scores || scores.length === 0) return null;

  const labels = ['Temperature', 'Humidity', 'Rainfall'];

  const datasets = scores.map(s => {
    const isSoy = s.crop_name.toLowerCase().includes('soy');
    const color = isSoy ? '104,211,145' : '246,201,14';
    return {
      label: s.crop_name,
      data: [s.temperature_score, s.humidity_score, s.rainfall_score],
      backgroundColor: `rgba(${color},0.12)`,
      borderColor: `rgba(${color},0.9)`,
      borderWidth: 2,
      pointBackgroundColor: `rgba(${color},1)`,
      pointRadius: 5,
    };
  });

  const options = {
    responsive: true,
    scales: {
      r: {
        min: 0,
        max: 33.33,
        ticks: {
          stepSize: 8,
          color: 'rgba(255,255,255,0.3)',
          backdropColor: 'transparent',
          font: { size: 10 },
        },
        grid:        { color: 'rgba(255,255,255,0.07)' },
        angleLines:  { color: 'rgba(255,255,255,0.07)' },
        pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 12, weight: '500' } },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: 'rgba(255,255,255,0.7)', padding: 20, font: { size: 13 } },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)} / 33.3 pts`,
        },
      },
    },
  };

  return <Radar data={{ labels, datasets }} options={options} />;
}

/* ─── Bar Chart (total scores comparison) ─── */
export function ScoreBarChart({ scores }) {
  if (!scores || scores.length === 0) return null;

  const labels  = scores.map(s => s.crop_name);
  const values  = scores.map(s => s.total_score);
  const colors  = scores.map(s =>
    s.crop_name.toLowerCase().includes('soy')
      ? 'rgba(104,211,145,0.8)'
      : 'rgba(246,201,14,0.8)'
  );
  const borders = scores.map(s =>
    s.crop_name.toLowerCase().includes('soy')
      ? 'rgba(104,211,145,1)'
      : 'rgba(246,201,14,1)'
  );

  const data = {
    labels,
    datasets: [{
      label: 'Resilience Score',
      data: values,
      backgroundColor: colors,
      borderColor: borders,
      borderWidth: 2,
      borderRadius: 10,
      borderSkipped: false,
    }],
  };

  const options = {
    responsive: true,
    indexAxis: 'y',
    scales: {
      x: {
        min: 0, max: 100,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(255,255,255,0.5)' },
      },
      y: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 14, weight: '600' } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` Score: ${ctx.raw.toFixed(1)} / 100`,
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
