// statistics.js — Full period support + donut charts
import { state, getMonthlyStats, getCategoryBreakdown } from '../utils/state.js';
import { formatCurrency } from '../utils/fx.js';

let statPeriod = 'month';
let statMonthOffset = 0;
let statYear = new Date().getFullYear();
let statCustomStart = '2018-07-01';
let statCustomEnd = new Date().toISOString().split('T')[0];

function getStatRange() {
  const now = new Date();
  if (statPeriod === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth() + statMonthOffset, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + statMonthOffset + 1, 0);
    return { start: s, end: e };
  } else if (statPeriod === 'year') {
    return { start: new Date(statYear, 0, 1), end: new Date(statYear, 11, 31) };
  } else if (statPeriod === 'all') {
    return { start: new Date('2000-01-01'), end: new Date() };
  } else {
    return { start: new Date(statCustomStart), end: new Date(statCustomEnd) };
  }
}

function getPeriodLabel() {
  const now = new Date();
  if (statPeriod === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() + statMonthOffset, 1);
    if (statMonthOffset === 0) return 'This month';
    if (statMonthOffset === -1) return 'Last month';
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (statPeriod === 'year') return String(statYear);
  if (statPeriod === 'all') return 'All time';
  return `${statCustomStart} → ${statCustomEnd}`;
}

function getEarliestYear() {
  if (!state.transactions.length) return new Date().getFullYear();
  return Math.min(...state.transactions.map(t => new Date(t.Date).getFullYear()));
}

function getStats(start, end) {
  const filtered = state.transactions.filter(tx => {
    const d = new Date(tx.Date);
    return d >= start && d <= end;
  });
  const income = filtered.filter(t => t.Type === 'income').reduce((a, t) => a + (parseFloat(t.AmountInGBP) || 0), 0);
  const expenses = filtered.filter(t => t.Type === 'expense').reduce((a, t) => a + (parseFloat(t.AmountInGBP) || 0), 0);
  return { income, expenses, net: income - expenses, filtered };
}

function buildDonut(slices, centerVal, centerSub) {
  const R = 68, cx = 80, cy = 80, strokeW = 13;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const circ = 2 * Math.PI * R;
  if (total === 0) {
    return `<div style="position:relative;width:160px;height:160px;margin:0 auto 12px;opacity:.3">
      <svg viewBox="0 0 160 160" width="160" height="160"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1a1a1a" stroke-width="${strokeW}"/></svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
        <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace">No data</div>
      </div>
    </div>`;
  }
  let offset = 0;
  const paths = slices.map(s => {
    const len = (s.value / total) * circ;
    const gap = 2;
    const p = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.colour}" stroke-width="${strokeW}" stroke-dasharray="${Math.max(0, len - gap)} ${circ}" stroke-dashoffset="${-offset}" stroke-linecap="round"/>`;
    offset += len;
    return p;
  }).join('');
  return `<div style="position:relative;width:160px;height:160px;margin:0 auto 12px">
    <svg viewBox="0 0 160 160" width="160" height="160" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1a1a1a" stroke-width="${strokeW}"/>
      ${paths}
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
      <div style="font-size:15px;font-weight:700;font-family:'DM Mono',monospace;letter-spacing:-.4px">${centerVal}</div>
      <div style="font-size:10px;color:var(--text-secondary);font-weight:500">${centerSub}</div>
    </div>
  </div>`;
}

export function renderStatistics(el) {
  const { start, end } = getStatRange();
  const stats = getStats(start, end);
  const savRate = stats.income > 0 ? ((stats.net / stats.income) * 100).toFixed(1) : '0.0';
  const earliestYear = getEarliestYear();
  const thisYear = new Date().getFullYear();

  const byCat = {};
  stats.filtered.filter(t => t.Type === 'expense').forEach(t => {
    byCat[t.Category] = (byCat[t.Category] || 0) + (parseFloat(t.AmountInGBP) || 0);
  });
  const expTotal = Object.values(byCat).reduce((a, v) => a + v, 0);
  const bdItems = Object.entries(byCat).map(([id, amt]) => ({ id, amt, pct: expTotal > 0 ? (amt / expTotal) * 100 : 0 })).sort((a, b) => b.amt - a.amt).slice(0, 8);

  const donutSlices = stats.income > 0 || stats.expenses > 0 ? [
    { colour: 'var(--accent-green)', value: stats.income },
    { colour: 'var(--accent-red)', value: stats.expenses },
  ] : [];

  const catSlices = bdItems.slice(0, 6).map(b => {
    const cat = state.categories.find(c => c.ID === b.id);
    return { colour: cat?.Colour || 'var(--accent-blue)', value: b.amt };
  });

  el.innerHTML = `
    <div class="page-header"><h1 class="page-title">Statistics</h1></div>

    <!-- Period tabs -->
    <div style="display:flex;background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:3px;margin-bottom:12px;gap:2px">
      <button class="period-btn ${statPeriod === 'month' ? 'active' : ''}" data-per="month">Month</button>
      <button class="period-btn ${statPeriod === 'year' ? 'active' : ''}" data-per="year">Year</button>
      <button class="period-btn ${statPeriod === 'custom' ? 'active' : ''}" data-per="custom">Custom</button>
      <button class="period-btn ${statPeriod === 'all' ? 'active' : ''}" data-per="all">All time</button>
    </div>

    ${statPeriod === 'month' ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <button class="parr" id="stat-prev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg></button>
      <div style="flex:1;text-align:center;font-size:14px;font-weight:600">${getPeriodLabel()}</div>
      <button class="parr" id="stat-next" ${statMonthOffset >= 0 ? 'disabled' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg></button>
    </div>` : ''}

    ${statPeriod === 'year' ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <button class="parr" id="stat-yprev" ${statYear <= earliestYear ? 'disabled' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg></button>
      <div style="flex:1;text-align:center;font-size:14px;font-weight:600">${statYear}</div>
      <button class="parr" id="stat-ynext" ${statYear >= thisYear ? 'disabled' : ''}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg></button>
    </div>` : ''}

    ${statPeriod === 'custom' ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <input type="date" class="form-input" id="cust-start" value="${statCustomStart}" style="flex:1;font-size:13px;color-scheme:dark"/>
      <span style="color:var(--text-tertiary);font-size:12px">→</span>
      <input type="date" class="form-input" id="cust-end" value="${statCustomEnd}" style="flex:1;font-size:13px;color-scheme:dark"/>
    </div>` : ''}

    <style>
      .period-btn{flex:1;padding:7px 3px;border:none;border-radius:8px;background:none;color:var(--text-secondary);font-family:var(--font-main);font-size:11px;font-weight:500;cursor:pointer;transition:.12s;text-align:center}
      .period-btn.active{background:var(--accent-blue);color:#fff}
      .parr{width:30px;height:30px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-secondary);flex-shrink:0}
      .parr:disabled{opacity:.25;cursor:not-allowed}
    </style>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px">
      <div class="card" style="padding:14px"><div style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Income</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--accent-green)">${formatCurrency(stats.income)}</div></div>
      <div class="card" style="padding:14px"><div style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Expenses</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--accent-red)">${formatCurrency(stats.expenses)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px">
      <div class="card" style="padding:14px"><div style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Net</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${stats.net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${stats.net >= 0 ? '+' : ''}${formatCurrency(stats.net)}</div></div>
      <div class="card" style="padding:14px"><div style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Savings rate</div><div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${parseFloat(savRate) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${savRate}%</div></div>
    </div>

    <!-- Income vs Expenses donut -->
    <div class="section-header"><span class="section-title">Income vs Expenses</span></div>
    <div class="card" style="padding:18px 14px;text-align:center">
      ${buildDonut(donutSlices, formatCurrency(stats.net), stats.net >= 0 ? 'surplus' : 'deficit')}
      <div style="display:flex;justify-content:center;gap:20px">
        <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-secondary)">
          <div style="width:7px;height:7px;border-radius:50%;background:var(--accent-green)"></div>Income
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-secondary)">
          <div style="width:7px;height:7px;border-radius:50%;background:var(--accent-red)"></div>Expenses
        </div>
      </div>
    </div>

    <!-- Category donut -->
    ${bdItems.length > 0 ? `
    <div class="section-header"><span class="section-title">Spending by category</span></div>
    <div class="card" style="padding:18px 14px">
      ${buildDonut(catSlices, formatCurrency(expTotal), 'total spend')}
      <div>
        ${bdItems.map(({ id, amt, pct }) => {
          const cat = state.categories.find(c => c.ID === id);
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-light)">
            <div style="width:7px;height:7px;border-radius:50%;background:${cat?.Colour || 'var(--accent-blue)'};flex-shrink:0"></div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:500;margin-bottom:3px">${cat?.Name || id}</div>
              <div style="height:3px;background:var(--bg-input);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${cat?.Colour || 'var(--accent-blue)'};border-radius:99px"></div></div>
            </div>
            <div style="font-size:12px;font-weight:600;font-family:var(--font-mono)">${formatCurrency(amt)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${stats.filtered.length === 0 ? `<div class="empty-state"><span class="emoji">📊</span><p>No data for this period.</p></div>` : ''}
  `;

  el.querySelectorAll('.period-btn[data-per]').forEach(b => {
    b.addEventListener('click', () => { statPeriod = b.dataset.per; renderStatistics(el); });
  });
  document.getElementById('stat-prev')?.addEventListener('click', () => { statMonthOffset--; renderStatistics(el); });
  document.getElementById('stat-next')?.addEventListener('click', () => { if (statMonthOffset < 0) { statMonthOffset++; renderStatistics(el); } });
  document.getElementById('stat-yprev')?.addEventListener('click', () => { if (statYear > earliestYear) { statYear--; renderStatistics(el); } });
  document.getElementById('stat-ynext')?.addEventListener('click', () => { if (statYear < thisYear) { statYear++; renderStatistics(el); } });
  document.getElementById('cust-start')?.addEventListener('change', e => { statCustomStart = e.target.value; renderStatistics(el); });
  document.getElementById('cust-end')?.addEventListener('change', e => { statCustomEnd = e.target.value; renderStatistics(el); });
}
