import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

// Plugin: colored price labels drawn to the right of the chart area
const priceLabelsPlugin = {
  id: 'priceLabels',
  afterDraw(chart) {
    const { currentPrice, bullMid, bearMid } = chart.options.priceLabels ?? {};
    if (currentPrice == null) return;
    const { ctx, chartArea, scales } = chart;

    ctx.save();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const x = chartArea.right + 8;

    const draw = (value, color, label) => {
      const y = scales.y.getPixelForValue(value);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.fillStyle = color;
      ctx.fillText(label, x, y + 4);
    };

    draw(bullMid,      'rgba(52,211,153,0.9)',  `$${bullMid}`);
    draw(bearMid,      'rgba(248,113,113,0.9)', `$${bearMid}`);
    draw(currentPrice, 'rgba(255,255,255,0.75)', `$${Math.round(currentPrice)}`);

    ctx.restore();
  },
};
Chart.register(priceLabelsPlugin);

export default function ForecastChart({ currentPrice, bullMid, bearMid }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const allVals = [currentPrice, bullMid, bearMid].filter((v) => v != null);
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const pad = Math.max((maxVal - minVal) * 0.15, 5);
    const yMin = Math.floor(minVal - pad);
    const yMax = Math.ceil(maxVal + pad);

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const existing = Chart.getChart(canvasRef.current);
    if (existing) existing.destroy();

    const ctx = canvasRef.current.getContext('2d');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Now', '12 months'],
        datasets: [
          // Bull projection
          {
            data: [currentPrice, bullMid],
            borderColor: 'rgba(52,211,153,0.85)',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: [8, 5],
            pointBackgroundColor: ['rgba(255,255,255,0.9)', 'rgba(52,211,153,0.9)'],
            pointBorderWidth: 0,
            fill: false,
            tension: 0,
          },
          // Bear projection
          {
            data: [currentPrice, bearMid],
            borderColor: 'rgba(248,113,113,0.85)',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: [0, 5],
            pointBackgroundColor: ['transparent', 'rgba(248,113,113,0.9)'],
            pointBorderWidth: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        priceLabels: { currentPrice, bullMid, bearMid },
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { right: 52, bottom: 4, top: 8, left: 4 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(18,20,28,0.95)',
            titleColor: 'rgba(255,255,255,0.5)',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 8,
            callbacks: {
              label(item) {
                if (item.parsed.y == null) return null;
                const names = ['Bull target', 'Bear target'];
                return `${names[item.datasetIndex]}: $${item.parsed.y.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.3)',
              font: { size: 10 },
              maxRotation: 0,
            },
          },
          y: {
            min: yMin,
            max: yMax,
            position: 'right',
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
            ticks: { display: false },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [currentPrice, bullMid, bearMid]);

  return (
    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <p style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: '8px',
      }}>
        Price Range &amp; Forecast
      </p>
      <canvas ref={canvasRef} />
    </div>
  );
}
