// more.js
import { state } from '../utils/state.js';
import { formatCurrency } from '../utils/fx.js';
import { addAccount, getAccounts } from '../sheets/sheets.js';
import { setState } from '../utils/state.js';
import { showToast } from './toast.js';

export function renderMore(el, { onSignOut, onReload }) {
  const lastSync = state.lastSync
    ? state.lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">More</h1>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Your data</div>
      <div class="settings-row" id="export-csv">
        <div class="settings-icon" style="background:#22c55e22">📥</div>
        <div class="settings-row-info">
          <div class="settings-row-title">Export to CSV</div>
          <div class="settings-row-sub">Download all transactions</div>
        </div>
        <div class="settings-row-right">→</div>
      </div>
      <div class="settings-row" id="open-sheet">
        <div class="settings-icon" style="background:#2563eb22">📊</div>
        <div class="settings-row-info">
          <div class="settings-row-title">Open Google Sheet</div>
          <div class="settings-row-sub">View raw data in Drive</div>
        </div>
        <div class="settings-row-right">↗</div>
      </div>
      <div class="settings-row" id="sync-now">
        <div class="settings-icon" style="background:#a855f722">🔄</div>
        <div class="settings-row-info">
          <div class="settings-row-title">Sync now</div>
          <div class="settings-row-sub">Last synced ${lastSync}</div>
        </div>
        <div class="settings-row-right">→</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Accounts</div>
      ${state.accounts.map(acc => `
        <div class="settings-row">
          <div class="settings-icon" style="background:${acc.Colour}22">${acc.Icon}</div>
          <div class="settings-row-info">
            <div class="settings-row-title">${acc.Name}</div>
            <div class="settings-row-sub">${acc.Currency}</div>
          </div>
          <div class="settings-row-right" style="font-family:var(--font-mono);font-size:14px;font-weight:600">
            ${formatCurrency(0, acc.Currency)}
          </div>
        </div>
      `).join('')}
      <div class="settings-row" id="add-account-more">
        <div class="settings-icon" style="background:#ffffff11">➕</div>
        <div class="settings-row-info">
          <div class="settings-row-title">Add account</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">App</div>
      <div class="settings-row" id="sign-out-btn">
        <div class="settings-icon" style="background:#ef444422">🚪</div>
        <div class="settings-row-info">
          <div class="settings-row-title" style="color:var(--accent-red)">Sign out</div>
          <div class="settings-row-sub">Clears local session only</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px">
      Finance v1.0 · Your data · Your Drive
    </div>
  `;

  // Category manager
  document.getElementById("manage-cats-btn")?.addEventListener("click", () => {
    import("./categories.js").then(m => m.showCategoryManager(() => renderMore(el, { onSignOut, onReload })));
  });

  // Export CSV
  document.getElementById('export-csv')?.addEventListener('click', () => {
    exportToCSV(state.transactions, state.categories, state.accounts);
  });

  // Open sheet
  document.getElementById('open-sheet')?.addEventListener('click', () => {
    const id = localStorage.getItem('finance_sheet_id');
    if (id) window.open(`https://docs.google.com/spreadsheets/d/${id}`, '_blank');
    else showToast('Sheet ID not found', 'error');
  });

  // Sync
  document.getElementById('sync-now')?.addEventListener('click', async () => {
    showToast('Syncing…');
    await onReload();
    showToast('Synced ✓', 'success');
    renderMore(el, { onSignOut, onReload });
  });

  // Add account
  document.getElementById('add-account-more')?.addEventListener('click', () => {
    showAddAccount(async () => {
      const accounts = await getAccounts();
      setState({ accounts });
      renderMore(el, { onSignOut, onReload });
    });
  });

  // Sign out
  document.getElementById('sign-out-btn')?.addEventListener('click', () => {
    if (confirm('Sign out? Your data stays safely in Google Drive.')) {
      onSignOut();
    }
  });
}

function exportToCSV(transactions, categories, accounts) {
  const catMap = Object.fromEntries(categories.map(c => [c.ID, c.Name]));
  const accMap = Object.fromEntries(accounts.map(a => [a.ID, a.Name]));

  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'Notes', 'Amount in GBP'];
  const rows = transactions.map(tx => [
    tx.Date,
    tx.Type,
    tx.Amount,
    tx.Currency,
    catMap[tx.Category] || tx.Category,
    accMap[tx.Account] || tx.Account,
    tx.Notes,
    tx.AmountInGBP,
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported ✓', 'success');
}

// ─── Account Modal (used from dashboard + more) ───────────────────────────────

export function showAddAccount(onSaved) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const CURRENCIES = ['GBP', 'EUR', 'USD', 'CHF', 'JPY', 'CAD', 'AUD'];
  const ICONS = ['💷', '💶', '💵', '💳', '🏦', '💰', '🪙'];

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 class="modal-title">Add Account</h2>

      <div class="form-group">
        <label class="form-label">Account name</label>
        <input class="form-input" id="acc-name" placeholder="e.g. Monzo, Revolut EUR" />
      </div>
      <div class="form-group">
        <label class="form-label">Currency</label>
        <select class="form-input" id="acc-currency">
          ${CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Opening balance</label>
        <input class="form-input amount" id="acc-balance" type="number" placeholder="0.00" value="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${ICONS.map((icon, i) => `
            <button class="icon-option ${i === 0 ? 'selected' : ''}" data-icon="${icon}"
              style="font-size:24px;padding:8px;background:var(--bg-input);border:2px solid ${i === 0 ? 'var(--accent-blue)' : 'transparent'};border-radius:10px;cursor:pointer">
              ${icon}
            </button>
          `).join('')}
        </div>
      </div>

      <button class="btn-primary" id="acc-save">Add Account</button>
      <button class="btn-secondary" id="acc-cancel">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  let selectedIcon = ICONS[0];

  overlay.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.icon-option').forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = 'var(--accent-blue)';
      selectedIcon = btn.dataset.icon;
    });
  });

  document.getElementById('acc-save').addEventListener('click', async () => {
    const name = document.getElementById('acc-name').value.trim();
    const currency = document.getElementById('acc-currency').value;
    const balance = document.getElementById('acc-balance').value || '0';

    if (!name) { showToast('Please enter an account name', 'error'); return; }

    const btn = document.getElementById('acc-save');
    btn.disabled = true; btn.textContent = 'Saving…';

    const colours = { GBP: '#2563EB', EUR: '#14b8a6', USD: '#22c55e', CHF: '#f97316' };

    await addAccount({ name, currency, initialBalance: balance, icon: selectedIcon, colour: colours[currency] || '#6b7280' });
    const accounts = await getAccounts();
    setState({ accounts });
    closeOverlay();
    showToast('Account added ✓', 'success');
    onSaved?.();
  });

  document.getElementById('acc-cancel').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

  function closeOverlay() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 350);
  }
}
