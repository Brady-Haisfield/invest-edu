import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

// Plugin: vertical dashed "Today" line
const todayLinePlugin = {
  id: 'todayLine',
  afterDraw(chart) {
    const todayIndex = chart.options.todayIndex;
    if (todayIndex == null) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(todayIndex);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Today', x, chartArea.bottom + 14);
    ctx.restore();
  },
};
Chart.register(todayLinePlugin);

function buildMonthLabels(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return d.toLocaleString('default', { month: 'short' });
  });
}

export default function ForecastChart({ monthlyCloses, currentPrice, bullMid, bearMid }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const hist = Array.isArray(monthlyCloses) && monthlyCloses.length > 0
      ? monthlyCloses.slice(-12)
      : [];

    const histCount = hist.length;
    const todayIndex = histCount;       // "Today" is at this index
    const totalPoints = histCount + 2;  // hist months + Today + future target

    const monthLabels = buildMonthLabels(histCount);
    const labels = [...monthLabels, 'Today', '+12m'];

    // nulls array helpers
    const histNulls = Array(histCount).fill(null);
    const futureNulls = Array(2).fill(null);

    // Historical line: closes + anchor at current price + null for future
    const historicalData = [...hist, currentPrice, null];

    // Projections start at today's price and go to target
    const bullData    = [...histNulls, currentPrice, bullMid];
    const bearData    = [...histNulls, currentPrice, bearMid];
    const fillTopData = [...histNulls, currentPrice, bullMid];
    const fillBotData = [...histNulls, currentPrice, bearMid];

    // Point radius arrays sized to match data
    const zeroRadii = Array(totalPoints).fill(0);
    const projRadii = (targetIdx) => zeroRadii.map((_, i) => (i === targetIdx ? 4 : 0));

    // Y range
    const allVals = [...hist.filter((v) => v != null), currentPrice, bullMid, bearMid];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const pad = Math.max((maxVal - minVal) * 0.12, 5);
    const yMin = Math.floor(minVal - pad);
    const yMax = Math.ceil(maxVal + pad);
    const yRange = yMax - yMin;
    const snapThreshold = yRange * 0.05;

    // Destroy any existing chart (handles React StrictMode double-invoke)
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    // Also destroy any chart Chart.js may have attached to this canvas already
    const existing = Chart.getChart(canvasRef.current);
    if (existing) existing.destroy();

    const ctx = canvasRef.current.getContext('2d');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          // Fill top (bull) → fills down to next dataset (fillBot)
          {
            data: fillTopData,
            borderWidth: 0,
            pointRadius: zeroRadii,
            fill: '+1',
            backgroundColor: 'rgba(52,211,153,0.07)',
            tension: 0,
          },
          // Fill bottom (bear) — anchor for the shaded zone
          {
            data: fillBotData,
            borderWidth: 0,
            pointRadius: zeroRadii,
            fill: false,
            tension: 0,
          },
          // Historical line
          {
            data: historicalData,
            borderColor: 'rgba(210,218,230,0.8)',
            borderWidth: 1.5,
            pointRadius: zeroRadii,
            pointHoverRadius: 3,
            fill: false,
            tension: 0.25,
          },
          // Bull projection
          {
            data: bullData,
            borderColor: 'rgba(52,211,153,0.8)',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: projRadii(totalPoints - 1),
            pointBackgroundColor: 'rgba(52,211,153,0.9)',
            pointBorderWidth: 0,
            fill: false,
            tension: 0,
          },
          // Bear projection
          {
            data: bearData,
            borderColor: 'rgba(248,113,113,0.8)',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: projRadii(totalPoints - 1),
            pointBackgroundColor: 'rgba(248,113,113,0.9)',
            pointBorderWidth: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        todayIndex,
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { right: 6, bottom: 18, top: 4 } },
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
                const names = ['', '', 'Price', 'Bull', 'Bear'];
                const name = names[item.datasetIndex];
                return name ? `${name}: $${item.parsed.y.toFixed(2)}` : null;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.28)',
              font: { size: 10 },
              maxRotation: 0,
              callback(val, idx) {
                // Show first month, midpoint month; "Today" drawn by plugin
                if (idx === 0) return labels[0];
                if (idx === Math.floor(histCount / 2)) return labels[idx];
                return '';
              },
            },
          },
          y: {
            min: yMin,
            max: yMax,
            position: 'right',
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.38)',
              font: { size: 10 },
              count: 10,
              callback(val) {
                if (Math.abs(val - bullMid) < snapThreshold) return `$${bullMid}`;
                if (Math.abs(val - currentPrice) < snapThreshold) return `$${currentPrice.toFixed(0)}`;
                if (Math.abs(val - bearMid) < snapThreshold) return `$${bearMid}`;
                return '';
              },
            },
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
  }, [monthlyCloses, currentPrice, bullMid, bearMid]);

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
        Price Projection
      </p>
      <canvas ref={canvasRef} />
    </div>
  );
}
