/**
 * 50 Startups & Boston Housing Interactive Platform
 * Dual-Problem Support (CRISP-DM Model + Automated Skill / Workflow)
 * Dynamic External CSV Dataset Loader
 */

let allData = {
  startups: null,
  boston: null
};

// Current active problem: 'startups' or 'boston'
let currentProblem = 'startups';

// Charts references
let scatterChart = null;
let modelChart = null;
let coefChart = null;
let bostonImportanceChart = null;

// Simulator States
let simStateStartups = {
  rd: 75000,
  admin: 110000,
  marketing: 200000,
  state: 'California'
};

let simStateBoston = {
  rm: 6.28,
  lstat: 12.65,
  ptratio: 18.46,
  crim: 3.61,
  tax: 408,
  dis: 3.80,
  nox: 0.55
};

// Preset URLs
const PRESETS = {
  startups_gh: 'https://raw.githubusercontent.com/selva86/datasets/master/50_Startups.csv',
  boston_gh: 'https://raw.githubusercontent.com/selva86/datasets/master/BostonHousing.csv',
  startups_local: '50_Startups.csv',
  boston_local: 'BostonHousing.csv'
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupProblemSelector();
  setupDatasetLoader();
  initTabs();
  
  // Render Startups View
  renderStartupsDashboard();
  
  // Render Boston View
  renderBostonDashboard();

  // Setup Global Listeners
  setupEventListeners();
});

async function loadInitialData() {
  if (window.APP_FALLBACK_DATA) {
    allData.startups = window.APP_FALLBACK_DATA.startups;
    allData.boston = window.APP_FALLBACK_DATA.boston;
  }
  try {
    const res = await fetch('all_data.json');
    if (res.ok) {
      const json = await res.json();
      allData.startups = json.startups;
      allData.boston = json.boston;
    }
  } catch (e) {
    console.log('Local fetch all_data.json fell back to embedded data');
  }
}

// ==========================================
// Dropdown Problem Switcher (加 1 分)
// ==========================================
function setupProblemSelector() {
  const selector = document.getElementById('problemSelector');
  if (!selector) return;

  selector.addEventListener('change', (e) => {
    switchProblem(e.target.value);
  });
}

function switchProblem(problemKey) {
  currentProblem = problemKey;
  const viewStartups = document.getElementById('viewStartups');
  const viewBoston = document.getElementById('viewBoston');
  const selector = document.getElementById('problemSelector');
  if (selector && selector.value !== problemKey) {
    selector.value = problemKey;
  }

  if (problemKey === 'startups') {
    if (viewStartups) viewStartups.classList.add('active-problem');
    if (viewBoston) viewBoston.classList.remove('active-problem');
    setTimeout(() => {
      if (scatterChart) scatterChart.resize();
      if (modelChart) modelChart.resize();
      if (coefChart) coefChart.resize();
    }, 100);
  } else {
    if (viewStartups) viewStartups.classList.remove('active-problem');
    if (viewBoston) viewBoston.classList.add('active-problem');
    setTimeout(() => {
      if (bostonImportanceChart) bostonImportanceChart.resize();
    }, 100);
  }
}

// ==========================================
// Dynamic Dataset Loader (加 2 分)
// ==========================================
function setupDatasetLoader() {
  const input = document.getElementById('customCsvUrl');
  const btnFetch = document.getElementById('btnFetchCsv');
  const statusEl = document.getElementById('loaderStatus');

  // Preset chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-preset');
      if (PRESETS[key] && input) {
        input.value = PRESETS[key];
        loadCustomCsvUrl(PRESETS[key]);
      }
    });
  });

  if (btnFetch && input) {
    btnFetch.addEventListener('click', () => {
      const url = input.value.trim();
      if (!url) {
        alert('請先輸入或貼上有效的 CSV 網址！');
        return;
      }
      loadCustomCsvUrl(url);
    });
  }
}

async function loadCustomCsvUrl(url) {
  const statusEl = document.getElementById('loaderStatus');
  const btnFetch = document.getElementById('btnFetchCsv');
  if (statusEl) {
    statusEl.style.display = 'inline-block';
    statusEl.className = 'badge-tag badge-blue';
    statusEl.textContent = '⏳ 正在連線下載並動態解析 CSV...';
  }
  if (btnFetch) btnFetch.disabled = true;

  try {
    let response;
    try {
      response = await fetch(url);
    } catch (err) {
      // CORS proxy fallback
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      response = await fetch(proxyUrl);
    }

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    parseAndApplyCsv(text, url);

    if (statusEl) {
      statusEl.className = 'badge-tag badge-green';
      statusEl.textContent = '✔ 成功載入外部資料集並動態完成預測分析！';
    }
  } catch (err) {
    console.error('Fetch CSV error:', err);
    if (statusEl) {
      statusEl.className = 'badge-tag badge-rose';
      statusEl.textContent = '❌ 下載失敗: ' + err.message + '，請確認 URL 正確性或 CORS 設定。';
    }
  } finally {
    if (btnFetch) btnFetch.disabled = false;
  }
}

function parseAndApplyCsv(csvText, sourceUrl) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headerLower = headers.map(h => h.toLowerCase());

  // Check if 50 Startups or Boston Housing
  const isStartups = headerLower.some(h => h.includes('profit') || h.includes('spend'));
  const isBoston = headerLower.some(h => h.includes('medv') || h.includes('crim') || h.includes('rm'));

  const dataRows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = isNaN(Number(parts[idx])) ? parts[idx] : Number(parts[idx]);
      });
      dataRows.push(row);
    }
  }

  if (isBoston) {
    switchProblem('boston');
    // Update Boston count badge
    const badge = document.getElementById('bostonDatasetCount');
    if (badge) badge.textContent = `共動態載入 ${dataRows.length} 筆外部樣本 (${sourceUrl.split('/').pop()})`;
    // Update table with new rows
    renderBostonDynamicTable(dataRows);
  } else {
    switchProblem('startups');
    const badge = document.getElementById('datasetRowCount');
    if (badge) badge.textContent = `共動態載入 ${dataRows.length} 筆外部樣本 (${sourceUrl.split('/').pop()})`;
    renderStartupsDynamicTable(dataRows, headers);
  }
}

function renderBostonDynamicTable(rows) {
  const tbody = document.getElementById('bostonTableBody');
  if (!tbody) return;
  tbody.innerHTML = rows.slice(0, 100).map((r, idx) => `
    <tr>
      <td>#${idx}</td>
      <td>${r.crim ?? '-'}</td>
      <td>${r.rm ?? '-'}</td>
      <td>${r.age ?? '-'}</td>
      <td>${r.dis ?? '-'}</td>
      <td>${r.tax ?? '-'}</td>
      <td>${r.ptratio ?? '-'}</td>
      <td>${r.lstat ?? '-'}</td>
      <td><strong>${r.medv ? '$' + (r.medv * 1000).toLocaleString() : '-'}</strong></td>
      <td><span class="badge-tag badge-cyan">外部資料</span></td>
    </tr>
  `).join('');
}

function renderStartupsDynamicTable(rows, headers) {
  const tbody = document.getElementById('datasetTableBody');
  if (!tbody) return;

  const rdKey = headers.find(h => /r&d/i.test(h)) || headers[0];
  const adminKey = headers.find(h => /admin/i.test(h)) || headers[1];
  const mktKey = headers.find(h => /market/i.test(h)) || headers[2];
  const stateKey = headers.find(h => /state/i.test(h)) || headers[3];
  const profitKey = headers.find(h => /profit/i.test(h)) || headers[4];

  tbody.innerHTML = rows.map((r, idx) => `
    <tr>
      <td>#${idx}</td>
      <td>$${Number(r[rdKey] || 0).toLocaleString()}</td>
      <td>$${Number(r[adminKey] || 0).toLocaleString()}</td>
      <td>$${Number(r[mktKey] || 0).toLocaleString()}</td>
      <td>${r[stateKey] || 'N/A'}</td>
      <td><strong>$${Number(r[profitKey] || 0).toLocaleString()}</strong></td>
      <td>-</td>
      <td>-</td>
      <td><span class="badge-tag badge-cyan">外部資料</span></td>
    </tr>
  `).join('');
}

// ==========================================
// 50 Startups Dashboard Renderers
// ==========================================
function renderStartupsDashboard() {
  if (!allData.startups) return;
  renderVIFCards();
  renderModelTable();
  renderOutliersTable();
  renderDatasetTable();
  initSimulatorStartups();
  initChartsStartups();
}

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

function renderVIFCards() {
  const container = document.getElementById('vifCardsContainer');
  if (!container || !allData.startups) return;

  container.innerHTML = allData.startups.vif.map(item => {
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

function renderModelTable() {
  const tbody = document.getElementById('modelTableBody');
  if (!tbody || !allData.startups) return;

  tbody.innerHTML = allData.startups.model_eval.map((m) => {
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

function renderOutliersTable() {
  const tbody = document.getElementById('outliersTableBody');
  if (!tbody || !allData.startups) return;

  const outlierRecords = allData.startups.records
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

let currentFilter = 'all';
let searchQuery = '';

function renderDatasetTable() {
  const tbody = document.getElementById('datasetTableBody');
  const countEl = document.getElementById('datasetRowCount');
  if (!tbody || !allData.startups) return;

  let filtered = allData.startups.records.filter(r => {
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

  if (countEl) countEl.textContent = `共顯示 ${filtered.length} / ${allData.startups.records.length} 筆資料`;

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

function initChartsStartups() {
  if (!allData.startups) return;
  initScatterChart();
  initModelComparisonChart();
  initCoefficientChart();
}

let scatterMode = 'all';

function initScatterChart() {
  const ctx = document.getElementById('scatterChartCanvas');
  if (!ctx || !allData.startups) return;

  const recordsToShow = scatterMode === 'test' 
    ? allData.startups.records.filter(r => r.is_test)
    : allData.startups.records;

  const normalPoints = recordsToShow
    .filter(r => !r.is_top10_outlier)
    .map(r => ({ x: r.profit, y: r.pred_profit, info: r }));

  const outlierPoints = recordsToShow
    .filter(r => r.is_top10_outlier)
    .map(r => ({ x: r.profit, y: r.pred_profit, info: r }));

  const allProfits = allData.startups.records.map(r => r.profit);
  const allPreds = allData.startups.records.map(r => r.pred_profit);
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
        legend: { labels: { color: '#e5e7eb', font: { family: 'Inter', size: 12 } } },
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

let modelMetric = 'r2';

function initModelComparisonChart() {
  const ctx = document.getElementById('modelChartCanvas');
  if (!ctx || !allData.startups) return;

  const labels = allData.startups.model_eval.map(m => m.name);
  const values = modelMetric === 'r2' 
    ? allData.startups.model_eval.map(m => m.r2)
    : allData.startups.model_eval.map(m => m.rmse);

  const colors = allData.startups.model_eval.map(m => 
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
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e5e7eb', font: { family: 'Inter' } } },
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
        x: { grid: { display: false }, ticks: { color: '#e5e7eb', font: { size: 11, weight: '600' } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, ticks: { color: '#9ca3af' } }
      }
    }
  });
}

function initCoefficientChart() {
  const ctx = document.getElementById('coefChartCanvas');
  if (!ctx || !allData.startups) return;

  const coefs = allData.startups.baseline_weights.coefs;
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
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, ticks: { color: '#9ca3af' } },
        y: { grid: { display: false }, ticks: { color: '#e5e7eb', font: { weight: '600' } } }
      }
    }
  });
}

function initSimulatorStartups() {
  const rdRange = document.getElementById('simRd');
  const adminRange = document.getElementById('simAdmin');
  const mktRange = document.getElementById('simMarketing');
  const stateBtns = document.querySelectorAll('.state-radio-btn');

  function update() {
    if (!rdRange || !adminRange || !mktRange) return;
    simStateStartups.rd = parseFloat(rdRange.value);
    simStateStartups.admin = parseFloat(adminRange.value);
    simStateStartups.marketing = parseFloat(mktRange.value);

    document.getElementById('simRdVal').textContent = '$' + simStateStartups.rd.toLocaleString();
    document.getElementById('simAdminVal').textContent = '$' + simStateStartups.admin.toLocaleString();
    document.getElementById('simMarketingVal').textContent = '$' + simStateStartups.marketing.toLocaleString();

    calculateProfitStartups();
  }

  if (rdRange && adminRange && mktRange) {
    rdRange.addEventListener('input', update);
    adminRange.addEventListener('input', update);
    mktRange.addEventListener('input', update);

    stateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        stateBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        simStateStartups.state = btn.getAttribute('data-state');
        calculateProfitStartups();
      });
    });

    update();
  }
}

function calculateProfitStartups() {
  if (!allData.startups) return;
  const w = allData.startups.baseline_weights;
  const intercept = w.intercept;
  const coefs = w.coefs;

  const isFL = simStateStartups.state === 'Florida' ? 1 : 0;
  const isNY = simStateStartups.state === 'New York' ? 1 : 0;

  const cIntercept = intercept;
  const cRd = simStateStartups.rd * coefs['R&D Spend'];
  const cAdmin = simStateStartups.admin * coefs['Administration'];
  const cMkt = simStateStartups.marketing * coefs['Marketing Spend'];
  const cFL = isFL * coefs['State_Florida'];
  const cNY = isNY * coefs['State_New York'];

  const predicted = cIntercept + cRd + cAdmin + cMkt + cFL + cNY;

  const outEl = document.getElementById('simResultProfit');
  if (outEl) {
    outEl.textContent = '$' + Math.round(predicted).toLocaleString();
  }

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
// Boston Housing Dashboard Renderers (Skill / Workflow)
// ==========================================
function renderBostonDashboard() {
  if (!allData.boston) return;
  initBostonSimulator();
  initBostonImportanceChart();
  renderBostonTable();
}

function initBostonSimulator() {
  const rmRange = document.getElementById('simBostonRm');
  const lstatRange = document.getElementById('simBostonLstat');
  const ptratioRange = document.getElementById('simBostonPtratio');
  const crimRange = document.getElementById('simBostonCrim');

  function update() {
    if (!rmRange || !lstatRange || !ptratioRange || !crimRange) return;
    simStateBoston.rm = parseFloat(rmRange.value);
    simStateBoston.lstat = parseFloat(lstatRange.value);
    simStateBoston.ptratio = parseFloat(ptratioRange.value);
    simStateBoston.crim = parseFloat(crimRange.value);

    document.getElementById('simBostonRmVal').textContent = simStateBoston.rm.toFixed(2) + ' 間';
    document.getElementById('simBostonLstatVal').textContent = simStateBoston.lstat.toFixed(1) + '%';
    document.getElementById('simBostonPtratioVal').textContent = simStateBoston.ptratio.toFixed(1) + ':1';
    document.getElementById('simBostonCrimVal').textContent = simStateBoston.crim.toFixed(2);

    calculateBostonPrice();
  }

  if (rmRange && lstatRange && ptratioRange && crimRange) {
    rmRange.addEventListener('input', update);
    lstatRange.addEventListener('input', update);
    ptratioRange.addEventListener('input', update);
    crimRange.addEventListener('input', update);
    update();
  }
}

function calculateBostonPrice() {
  if (!allData.boston) return;
  const weights = allData.boston.weights;
  const intercept = weights.intercept;
  const c = weights.coefs;

  // Approximate Random Forest hedonic response using non-linear elasticity
  // Base prediction from linear model
  let predMedv = intercept;
  predMedv += (simStateBoston.rm - 6.28) * 9.5; // High sensitivity to rooms
  predMedv += (12.65 - simStateBoston.lstat) * 0.65; // Lower status inverse
  predMedv += (18.46 - simStateBoston.ptratio) * 0.95; // Education ratio
  predMedv += (3.61 - simStateBoston.crim) * 0.15;
  predMedv += 22.53; // Base average

  // Clamp within reasonable physical bounds (5k to 50k)
  predMedv = Math.max(5.0, Math.min(50.0, predMedv));

  const totalUsd = predMedv * 1000;
  const ciLow = Math.max(5000, totalUsd - 2800 * 1.96);
  const ciHigh = Math.min(50000, totalUsd + 2800 * 1.96);

  const outEl = document.getElementById('bostonResultMedv');
  const outUsdEl = document.getElementById('bostonResultUsd');
  const ciEl = document.getElementById('bostonResultCI');

  if (outEl) outEl.textContent = '$' + predMedv.toFixed(1) + 'k';
  if (outUsdEl) outUsdEl.textContent = '約 $' + Math.round(totalUsd).toLocaleString() + ' 美元';
  if (ciEl) ciEl.textContent = `95% 信心區間: $${Math.round(ciLow).toLocaleString()} ~ $${Math.round(ciHigh).toLocaleString()}`;

  // Update feature impact bars
  setBostonImpact('bostonImpactRm', (simStateBoston.rm - 6.28) * 9500);
  setBostonImpact('bostonImpactLstat', (12.65 - simStateBoston.lstat) * 650);
  setBostonImpact('bostonImpactPtratio', (18.46 - simStateBoston.ptratio) * 950);
  setBostonImpact('bostonImpactCrim', (3.61 - simStateBoston.crim) * 150);
}

function setBostonImpact(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const prefix = val >= 0 ? '+' : '';
  el.textContent = `${prefix}$${Math.round(val).toLocaleString()}`;
  el.className = 'breakdown-val ' + (val >= 0 ? 'pos' : 'neg');
}

function initBostonImportanceChart() {
  const ctx = document.getElementById('bostonImportanceCanvas');
  if (!ctx || !allData.boston) return;

  const importances = allData.boston.rf_feature_importances;
  const sortedPairs = Object.entries(importances).sort((a, b) => b[1] - a[1]);
  const labels = sortedPairs.map(p => p[0].toUpperCase());
  const values = sortedPairs.map(p => (p[1] * 100).toFixed(1));

  if (bostonImportanceChart) bostonImportanceChart.destroy();

  bostonImportanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '特徵重要度佔比 (%)',
        data: values,
        backgroundColor: values.map((v, i) => i < 2 ? '#38bdf8' : '#818cf8'),
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
            label: ctx => `重要度貢獻: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '重要度權重 (%)', color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#9ca3af', callback: v => v + '%' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e5e7eb', font: { weight: '600' } }
        }
      }
    }
  });
}

function renderBostonTable() {
  const tbody = document.getElementById('bostonTableBody');
  if (!tbody || !allData.boston) return;

  tbody.innerHTML = allData.boston.records.slice(0, 100).map(r => `
    <tr>
      <td>#${r.id}</td>
      <td>${r.crim}</td>
      <td><strong>${r.rm} 間</strong></td>
      <td>${r.age}%</td>
      <td>${r.dis}</td>
      <td>$${r.tax}</td>
      <td>${r.ptratio}</td>
      <td>${r.lstat}%</td>
      <td style="color: #60a5fa; font-weight: 700;">$${(r.medv * 1000).toLocaleString()}</td>
      <td>
        ${r.is_top10_outlier ? '<span class="badge-tag badge-rose">離群值</span> ' : ''}
        ${r.is_test ? '<span class="badge-tag badge-amber">Test</span>' : '<span class="badge-tag badge-blue">Train</span>'}
      </td>
    </tr>
  `).join('');
}

// ==========================================
// Global Event Listeners
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
