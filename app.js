/**
 * 50 Startups Profit Prediction Dashboard
 * Interactive Application Logic & CRISP-DM Presentation
 */

let appData = null;
let scatterChart = null;
let modelChart = null;
let coefChart = null;

// Simulator State
let simState = {
  rd: 75000,
  admin: 110000,
  marketing: 200000,
  state: 'California' // California is reference (drop_first=True)
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  initTabs();
  renderVIFCards();
  renderModelTable();
  renderOutliersTable();
  renderDatasetTable();
  initSimulator();
  initCharts();
  setupEventListeners();
});

async function loadData() {
  try {
    const res = await fetch('data.json');
    if (res.ok) {
      appData = await res.json();
    }
  } catch (e) {
    console.warn('Fetch data.json failed, falling back to window.APP_FALLBACK_DATA', e);
  }
  if (!appData && window.APP_FALLBACK_DATA) {
    appData = window.APP_FALLBACK_DATA;
  }
}

// ==========================================
// Tab Switching System
// ==========================================
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Re-render charts when visible
      if (targetId === 'phase5' || targetId === 'phase4') {
        setTimeout(() => {
          if (scatterChart) scatterChart.resize();
          if (modelChart) modelChart.resize();
          if (coefChart) coefChart.resize();
        }, 100);
      }
    });
  });
}

// ==========================================
// VIF Gauge Cards (Phase 3)
// ==========================================
function renderVIFCards() {
  const container = document.getElementById('vifCardsContainer');
  if (!container || !appData) return;

  container.innerHTML = appData.vif.map(item => {
    const isSafe = item.vif < 5;
    const isModerate = item.vif >= 5 && item.vif < 10;
    const colorClass = isSafe ? 'badge-green' : (isModerate ? 'badge-amber' : 'badge-rose');
    const statusText = isSafe ? '無共線性 (< 5)' : (isModerate ? '中度共線性' : '高共線性 (> 10)');
    const barWidth = Math.min((item.vif / 10) * 100, 100);
    const barColor = isSafe ? '#10b981' : (isModerate ? '#f59e0b' : '#f43f5e');

    return `
      <div class="vif-card">
        <div class="vif-header">
          <span class="vif-feature-name">${item.feature}</span>
          <span class="badge-tag ${colorClass}">${statusText}</span>
        </div>
        <div class="vif-score" style="color: ${barColor};">${item.vif.toFixed(3)}</div>
        <div class="vif-bar-bg">
          <div class="vif-bar-fill" style="width: ${barWidth}%; background-color: ${barColor};"></div>
        </div>
        <span class="vif-desc">變異數膨脹因子 (經驗門檻值: 5~10)</span>
      </div>
    `;
  }).join('');
}

// ==========================================
// Model Evaluation Table (Phase 4 & 5)
// ==========================================
function renderModelTable() {
  const tbody = document.getElementById('modelTableBody');
  if (!tbody || !appData) return;

  tbody.innerHTML = appData.model_eval.map((m) => {
    const isBest = m.name === 'Baseline LR';
    return `
      <tr class="${isBest ? 'highlight-row' : ''}">
        <td>
          <strong>${m.name}</strong>
          ${isBest ? ' <span class="badge-tag badge-green">最佳表現</span>' : ''}
        </td>
        <td><span class="badge-tag ${m.r2 > 0 ? 'badge-blue' : 'badge-amber'}">${m.r2.toFixed(4)}</span></td>
        <td>${m.mse.toExponential(4)}</td>
        <td>$${m.rmse.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
        <td><span class="badge-tag badge-blue">${m.num_features} 個</span></td>
        <td style="font-size: 0.8rem; color: #9ca3af;">${m.features.length ? m.features.join(', ') : '<em>無 (常數模型)</em>'}</td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// Top 10 Outliers Table (Phase 5)
// ==========================================
function renderOutliersTable() {
  const tbody = document.getElementById('outliersTableBody');
  if (!tbody || !appData) return;

  const outlierRecords = appData.records
    .filter(r => r.is_top10_outlier)
    .sort((a, b) => b.residual - a.residual);

  tbody.innerHTML = outlierRecords.map((r, rank) => `
    <tr>
      <td><span class="badge-tag badge-rose">#${rank + 1}</span></td>
      <td><strong>Company #${r.id}</strong></td>
      <td><span class="badge-tag badge-blue">${r.state}</span></td>
      <td>$${r.profit.toLocaleString()}</td>
      <td>$${r.pred_profit.toLocaleString()}</td>
      <td style="color: #f43f5e; font-weight: 600;">$${r.residual.toLocaleString()}</td>
      <td>${r.is_test ? '<span class="badge-tag badge-amber">測試集</span>' : '<span class="badge-tag badge-green">訓練集</span>'}</td>
    </tr>
  `).join('');
}

// ==========================================
// Dataset Explorer Table (Phase 2)
// ==========================================
let currentFilter = 'all';
let searchQuery = '';

function renderDatasetTable() {
  const tbody = document.getElementById('datasetTableBody');
  const countEl = document.getElementById('datasetRowCount');
  if (!tbody || !appData) return;

  let filtered = appData.records.filter(r => {
    if (currentFilter === 'test' && !r.is_test) return false;
    if (currentFilter === 'train' && r.is_test) return false;
    if (currentFilter === 'outliers' && !r.is_top10_outlier) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchState = r.state.toLowerCase().includes(q);
      const matchId = ('company #' + r.id).toLowerCase().includes(q) || String(r.id) === q;
      return matchState || matchId;
    }
    return true;
  });

  if (countEl) countEl.textContent = `共顯示 ${filtered.length} / ${appData.records.length} 筆資料`;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td>$${r.rd_spend.toLocaleString()}</td>
      <td>$${r.admin.toLocaleString()}</td>
      <td>$${r.marketing.toLocaleString()}</td>
      <td>${r.state}</td>
      <td><strong>$${r.profit.toLocaleString()}</strong></td>
      <td>$${r.pred_profit.toLocaleString()}</td>
      <td style="color: ${r.is_top10_outlier ? '#f43f5e' : '#9ca3af'}; font-weight: ${r.is_top10_outlier ? '700' : '400'};">
        $${r.residual.toLocaleString()}
      </td>
      <td>
        ${r.is_top10_outlier ? '<span class="badge-tag badge-rose">離群值</span> ' : ''}
        ${r.is_test ? '<span class="badge-tag badge-amber">Test</span>' : '<span class="badge-tag badge-blue">Train</span>'}
      </td>
    </tr>
  `).join('');
}

// ==========================================
// Charts Initialization (Chart.js)
// ==========================================
function initCharts() {
  if (!appData) return;
  initScatterChart();
  initModelComparisonChart();
  initCoefficientChart();
}

let scatterMode = 'all'; // 'all' or 'test'

function initScatterChart() {
  const ctx = document.getElementById('scatterChartCanvas');
  if (!ctx || !appData) return;

  const recordsToShow = scatterMode === 'test' 
    ? appData.records.filter(r => r.is_test)
    : appData.records;

  const normalPoints = recordsToShow
    .filter(r => !r.is_top10_outlier)
    .map(r => ({ x: r.profit, y: r.pred_profit, info: r }));

  const outlierPoints = recordsToShow
    .filter(r => r.is_top10_outlier)
    .map(r => ({ x: r.profit, y: r.pred_profit, info: r }));

  // Min and max for 45-degree reference line
  const allProfits = appData.records.map(r => r.profit);
  const allPreds = appData.records.map(r => r.pred_profit);
  const minVal = Math.min(...allProfits, ...allPreds) * 0.9;
  const maxVal = Math.max(...allProfits, ...allPreds) * 1.05;

  const refLine = [
    { x: minVal, y: minVal },
    { x: maxVal, y: maxVal }
  ];

  if (scatterChart) scatterChart.destroy();

  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '正常樣本點 (Normal)',
          data: normalPoints,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          pointRadius: 6,
          pointHoverRadius: 9
        },
        {
          label: 'Top 10 離群值 (Outliers)',
          data: outlierPoints,
          backgroundColor: '#f59e0b',
          borderColor: '#ffffff',
          borderWidth: 2,
          pointRadius: 9,
          pointHoverRadius: 12
        },
        {
          label: '理想回歸線 (y = x)',
          data: refLine,
          type: 'line',
          borderColor: '#f43f5e',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e5e7eb', font: { family: 'Inter', size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#60a5fa',
          bodyColor: '#f3f4f6',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              const item = context.raw.info;
              if (!item) return 'y = x 參考線';
              return [
                `公司: #${item.id} (${item.state})`,
                `實際利潤: $${item.profit.toLocaleString()}`,
                `預測利潤: $${item.pred_profit.toLocaleString()}`,
                `殘差誤差: $${item.residual.toLocaleString()}`,
                `資料集: ${item.is_test ? '測試集 (Test)' : '訓練集 (Train)'}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '實際利潤 (Actual Profit $)', color: '#9ca3af', font: { size: 13, weight: 'bold' } },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af', callback: val => '$' + (val / 1000) + 'k' }
        },
        y: {
          title: { display: true, text: '預測利潤 (Predicted Profit $)', color: '#9ca3af', font: { size: 13, weight: 'bold' } },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af', callback: val => '$' + (val / 1000) + 'k' }
        }
      }
    }
  });
}

let modelMetric = 'r2'; // 'r2' or 'mse'

function initModelComparisonChart() {
  const ctx = document.getElementById('modelChartCanvas');
  if (!ctx || !appData) return;

  const labels = appData.model_eval.map(m => m.name);
  const values = modelMetric === 'r2' 
    ? appData.model_eval.map(m => m.r2)
    : appData.model_eval.map(m => m.rmse);

  const colors = appData.model_eval.map(m => 
    m.name === 'Baseline LR' ? '#10b981' : (m.r2 < 0 ? '#f43f5e' : '#3b82f6')
  );

  if (modelChart) modelChart.destroy();

  modelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: modelMetric === 'r2' ? 'R² 判定係數 (越大越好)' : 'RMSE 均方根誤差 ($ 越小越好)',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e5e7eb', font: { family: 'Inter' } }
        },
        tooltip: {
          callbacks: {
            label: context => {
              const val = context.raw;
              return modelMetric === 'r2' 
                ? `R² Score: ${val.toFixed(4)}`
                : `RMSE: $${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#e5e7eb', font: { size: 11, weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });
}

function initCoefficientChart() {
  const ctx = document.getElementById('coefChartCanvas');
  if (!ctx || !appData) return;

  const coefs = appData.baseline_weights.coefs;
  const labels = Object.keys(coefs);
  const values = Object.values(coefs);
  const bgColors = values.map(v => v >= 0 ? '#10b981' : '#f43f5e');

  if (coefChart) coefChart.destroy();

  coefChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '迴歸係數 (Regression Coefficients β)',
        data: values,
        backgroundColor: bgColors,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `係數: ${ctx.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e5e7eb', font: { weight: '600' } }
        }
      }
    }
  });
}

// ==========================================
// Interactive Simulator (Phase 6)
// ==========================================
function initSimulator() {
  const rdRange = document.getElementById('simRd');
  const adminRange = document.getElementById('simAdmin');
  const mktRange = document.getElementById('simMarketing');
  const stateBtns = document.querySelectorAll('.state-radio-btn');

  function update() {
    if (!rdRange || !adminRange || !mktRange) return;
    simState.rd = parseFloat(rdRange.value);
    simState.admin = parseFloat(adminRange.value);
    simState.marketing = parseFloat(mktRange.value);

    document.getElementById('simRdVal').textContent = '$' + simState.rd.toLocaleString();
    document.getElementById('simAdminVal').textContent = '$' + simState.admin.toLocaleString();
    document.getElementById('simMarketingVal').textContent = '$' + simState.marketing.toLocaleString();

    calculateProfit();
  }

  if (rdRange && adminRange && mktRange) {
    rdRange.addEventListener('input', update);
    adminRange.addEventListener('input', update);
    mktRange.addEventListener('input', update);

    stateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        stateBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        simState.state = btn.getAttribute('data-state');
        calculateProfit();
      });
    });

    update();
  }
}

function calculateProfit() {
  if (!appData) return;
  const w = appData.baseline_weights;
  const intercept = w.intercept;
  const coefs = w.coefs;

  const isFL = simState.state === 'Florida' ? 1 : 0;
  const isNY = simState.state === 'New York' ? 1 : 0;

  const cIntercept = intercept;
  const cRd = simState.rd * coefs['R&D Spend'];
  const cAdmin = simState.admin * coefs['Administration'];
  const cMkt = simState.marketing * coefs['Marketing Spend'];
  const cFL = isFL * coefs['State_Florida'];
  const cNY = isNY * coefs['State_New York'];

  const predicted = cIntercept + cRd + cAdmin + cMkt + cFL + cNY;

  const outEl = document.getElementById('simResultProfit');
  if (outEl) {
    outEl.textContent = '$' + Math.round(predicted).toLocaleString();
  }

  // Update breakdown
  const elIntercept = document.getElementById('bdIntercept');
  if (elIntercept) elIntercept.textContent = '$' + intercept.toLocaleString();
  setBreakdownRow('bdRd', cRd);
  setBreakdownRow('bdAdmin', cAdmin);
  setBreakdownRow('bdMkt', cMkt);
  setBreakdownRow('bdState', isFL ? cFL : (isNY ? cNY : 0));
}

function setBreakdownRow(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const prefix = val >= 0 ? '+' : '';
  el.textContent = `${prefix}$${Math.round(val).toLocaleString()}`;
  el.className = 'breakdown-val ' + (val >= 0 ? 'pos' : 'neg');
}

// ==========================================
// Event Listeners for Filters & Controls
// ==========================================
function setupEventListeners() {
  // Scatter Mode Toggles
  document.querySelectorAll('[data-scatter-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-scatter-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scatterMode = btn.getAttribute('data-scatter-mode');
      initScatterChart();
    });
  });

  // Model Metric Toggles
  document.querySelectorAll('[data-metric-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-metric-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modelMetric = btn.getAttribute('data-metric-mode');
      initModelComparisonChart();
    });
  });

  // Dataset Search and Filter
  const searchInput = document.getElementById('datasetSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderDatasetTable();
    });
  }

  document.querySelectorAll('[data-table-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-table-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-table-filter');
      renderDatasetTable();
    });
  });
}
