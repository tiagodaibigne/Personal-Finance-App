// dashboard.js
import { state, getAccountBalance, getMonthlyStats, getCategoryBreakdown } from '../utils/state.js';
import { formatCurrency, groupByDate } from '../utils/fx.js';
import { showAddTransaction } from './transaction-modal.js';
import { showAddAccount } from './account-modal.js';
import { getTransactions, getAccounts } from '../sheets/sheets.js';
import { setState, emit } from '../utils/state.js';

export function renderDashboard(el) {
  const { accounts, transactions } = state;
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const filtered = transactions.filter(tx => { const d = new Date(tx.date); return d >= s && d <= e; });
  const income   = filtered.filter(t => t.type === 'income').reduce((a, t) => a + (+t.ref_currency_amount || 0), 0);
  const expenses = filtered.filter(t => t.type === 'expense').reduce((a, t) => a + (+t.ref_currency_amount || 0), 0);
  const net = income - expenses;
  const mn = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Category breakdown
  const byCat = {};
  filtered.filter(t => t.type === 'expense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (+t.ref_currency_amount || 0); });
  const expTotal = Object.values(byCat).reduce((a, v) => a + v, 0);
  const topExp = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const unread = 0; // will be driven by planned payments logic

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <div style="display:flex;gap:7px">
        <button class="icon-btn" id="dash-notif" title="Notifications" style="position:relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div id="notif-badge" style="display:none;position:absolute;top:5px;right:5px;width:7px;height:7px;background:var(--accent-red);border-radius:50%;border:1.5px solid var(--bg)"></div>
        </button>
        <button class="icon-btn" id="dash-settings" title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </div>

    <!-- Accounts -->
    <div class="accounts-grid">
      ${accounts.map(acc => {
        const bal = getAccountBalance(acc.ID);
        const sym = acc.Symbol || (acc.Currency === 'GBP' ? '£' : acc.Currency === 'EUR' ? '€' : acc.Currency);
        return `<div class="account-card">
          <div>
            <div class="account-icon" style="background:${acc.Colour}18;color:${acc.Colour};font-family:var(--font-mono);font-size:17px;font-weight:600">${sym}</div>
            <div class="account-name">${acc.Name}</div>
          </div>
          <div class="account-balance ${bal < 0 ? 'negative' : ''}">${formatCurrency(bal, acc.Currency)}</div>
        </div>`;
      }).join('')}
      <div class="account-card" style="border:1px dashed var(--border);align-items:center;justify-content:center;gap:5px;color:var(--text-tertiary);font-size:11px;cursor:pointer" id="add-acc-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add account
      </div>
    </div>

    <!-- Cash flow -->
    <div class="cashflow-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
        <span style="font-size:10px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.7px">Cash Flow</span>
        <span style="font-size:10px;color:var(--text-tertiary)">${mn}</span>
      </div>
      <div style="font-size:22px;font-weight:600;font-family:var(--font-mono);letter-spacing:-.04em;margin-bottom:14px;color:${net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${net >= 0 ? '+' : ''}${formatCurrency(net)}</div>
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:12px;color:var(--text-secondary)">Income</span><span style="font-size:12px;font-weight:600;font-family:var(--font-mono);color:var(--accent-green)">${formatCurrency(income)}</span></div>
        <div style="height:3px;background:var(--bg-input);border-radius:99px"><div style="height:100%;width:100%;background:var(--accent-green);border-radius:99px"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:12px;color:var(--text-secondary)">Expenses</span><span style="font-size:12px;font-weight:600;font-family:var(--font-mono);color:var(--accent-red)">${formatCurrency(expenses)}</span></div>
        <div style="height:3px;background:var(--bg-input);border-radius:99px"><div style="height:100%;width:${income > 0 ? Math.min(expenses / income * 100, 100) : 0}%;background:var(--accent-red);border-radius:99px"></div></div>
      </div>
    </div>

    <!-- Recent records -->
    <div class="section-header">
      <span class="section-title">Recent</span>
      <button class="section-link" id="recent-expand">Show more</button>
    </div>
    <div class="card" style="padding:0 16px" id="recent-card">
      ${transactions.slice(0, 3).map(tx => renderTxRow(tx)).join('')}
      ${transactions.length === 0 ? '<div style="padding:20px 0;text-align:center;color:var(--text-secondary);font-size:13px">No transactions yet</div>' : ''}
    </div>

    <!-- Top expenses -->
    ${topExp.length > 0 ? `
    <div class="section-header" style="margin-top:4px"><span class="section-title">Spending this month</span></div>
    <div class="card" style="padding:14px 16px">
      ${topExp.map(([id, v]) => {
        const cat = state.categories.find(c => c.ID === id);
        const pct = expTotal > 0 ? (v / expTotal * 100).toFixed(0) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-light)">
          <div style="width:6px;height:6px;border-radius:50%;background:${cat?.Colour || 'var(--accent-blue)'};flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:500;margin-bottom:3px">${cat?.Name || id}</div>
            <div style="height:2px;background:var(--bg-input);border-radius:99px"><div style="height:100%;width:${pct}%;background:${cat?.Colour || 'var(--accent-blue)'};border-radius:99px"></div></div>
          </div>
          <div style="font-size:12px;font-weight:600;font-family:var(--font-mono);color:var(--accent-red)">${formatCurrency(v)}</div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Planned payments -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">Upcoming payments</span>
      <button class="section-link" onclick="document.querySelector('[data-page=planning]')?.click()">See all</button>
    </div>
    <div class="card" style="padding:4px 16px" id="planned-card">
      <div style="padding:16px 0;text-align:center;color:var(--text-secondary);font-size:12px">Loading…</div>
    </div>

    <!-- FX Rates -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">Exchange rates</span>
      <span style="font-size:10px;color:var(--text-tertiary)">ECB · live</span>
    </div>
    <div class="card" style="padding:4px 16px" id="fx-card">
      <div style="padding:16px 0;text-align:center;color:var(--text-secondary);font-size:12px">Loading…</div>
    </div>

    <!-- Budgets -->
    <div class="section-header" style="margin-top:4px">
      <span class="section-title">Budgets this month</span>
      <button class="section-link" onclick="document.querySelector('[data-page=planning]')?.click()">Manage</button>
    </div>
    <div id="budget-card"></div>
    <div style="height:8px"></div>
  `;

  // Recent expand/collapse
  let expanded = false;
  document.getElementById('recent-expand')?.addEventListener('click', () => {
    const card = document.getElementById('recent-card');
    const btn  = document.getElementById('recent-expand');
    if (!expanded) {
      card.innerHTML = transactions.slice(0, 10).map(tx => renderTxRow(tx)).join('') +
        `<div style="padding:10px 0;text-align:center">
           <button class="section-link" style="font-size:12px" onclick="document.querySelector('[data-page=records]')?.click()">Open full records →</button>
         </div>`;
      btn.textContent = 'Show less';
      expanded = true;
    } else {
      card.innerHTML = transactions.slice(0, 3).map(tx => renderTxRow(tx)).join('');
      btn.textContent = 'Show more';
      expanded = false;
    }
  });

  // FX rates
  fetch('https://api.frankfurter.app/latest?from=GBP&to=EUR,USD')
    .then(r => r.json())
    .then(data => {
      const fx = document.getElementById('fx-card');
      if (!fx) return;
      const pairs = [
        { pair: 'GBP / EUR', rate: data.rates.EUR },
        { pair: 'GBP / USD', rate: data.rates.USD },
      ];
      fx.innerHTML = pairs.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border-light)">
          <span style="font-size:13px;font-weight:600;font-family:var(--font-mono)">${p.pair}</span>
          <span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:var(--accent-blue)">${p.rate?.toFixed(4) || '—'}</span>
        </div>`).join('').replace(/border-bottom[^"]*"[^>]*>(\s*$)/m, '');
    })
    .catch(() => {
      const fx = document.getElementById('fx-card');
      if (fx) fx.innerHTML = '<div style="padding:12px 0;font-size:12px;color:var(--text-secondary)">Rates unavailable offline</div>';
    });

  // Account button
  document.getElementById('add-acc-btn')?.addEventListener('click', () => {
    showAddAccount(() => emit('rerender', 'dashboard'));
  });

  // Notification bell
  document.getElementById('dash-notif')?.addEventListener('click', () => {
    import('./notifications.js').then(m => m.showNotifications(state.plannedPayments)).catch(() => {});
  });

  // Settings
  document.getElementById('dash-settings')?.addEventListener('click', () => {
    import('./profile.js').then(m => m.showProfile()).catch(() => {});
  });
}

export function renderTxRow(tx) {
  const cat = state.categories.find(c => c.ID === tx.category) || { Name: tx.category, Icon: 'other', Colour: '#3a4a5a' };
  const isInc = tx.type === 'income', isTra = tx.type === 'transfer';
  const bg  = isTra ? 'rgba(70,114,196,.1)' : isInc ? 'rgba(61,148,104,.1)' : 'rgba(168,72,72,.1)';
  const ic  = isTra ? 'var(--accent-blue)'  : isInc ? 'var(--accent-green)' : 'var(--accent-red)';
  const sign = isInc ? '+' : isTra ? '' : '−';
  const amtColour = isInc ? 'var(--accent-green)' : isTra ? 'var(--accent-blue)' : 'var(--accent-red)';
  const ds = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const labelChips = tx.labels ? tx.labels.split(',').slice(0, 2).map(l =>
    `<span style="font-size:9px;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:4px;color:var(--text-tertiary)">${l.trim()}</span>`).join(' ') : '';
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-light);cursor:pointer" class="tx-row">
    <div style="width:34px;height:34px;border-radius:9px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${ic}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx.note || cat.Name}</div>
      <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${tx.payee ? tx.payee + ' · ' : ''}${cat.Name} · ${ds} ${labelChips}</div>
    </div>
    <div style="font-size:13px;font-weight:600;font-family:var(--font-mono);letter-spacing:-.02em;color:${amtColour};flex-shrink:0">${sign}${formatCurrency(tx.amount, tx.currency)}</div>
  </div>`;
}
