// planning.js
import { state } from '../utils/state.js';
import { formatCurrency } from '../utils/fx.js';
import { addPlannedPayment, addBudget, getPlannedPayments, getBudgets } from '../sheets/sheets.js';
import { setState } from '../utils/state.js';
import { showToast } from './toast.js';

export function renderPlanning(el) {
  let activeTab = 'planned';

  function render() {
    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Planning</h1>
      </div>

      <div class="type-toggle" style="margin-bottom:20px">
        <button class="type-btn ${activeTab === 'planned' ? 'active transfer' : ''}" data-tab="planned">Planned Payments</button>
        <button class="type-btn ${activeTab === 'budgets' ? 'active transfer' : ''}" data-tab="budgets">Budgets</button>
      </div>

      <div id="planning-content"></div>
    `;

    el.querySelectorAll('.type-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });

    renderContent();
  }

  function renderContent() {
    const content = document.getElementById('planning-content');
    if (!content) return;

    if (activeTab === 'planned') {
      renderPlannedPayments(content);
    } else {
      renderBudgets(content);
    }
  }

  function renderPlannedPayments(container) {
    const payments = state.plannedPayments;

    container.innerHTML = `
      ${payments.length === 0 ? `
        <div class="empty-state">
          <span class="emoji">🕐</span>
          <p>No planned payments yet.<br/>Track recurring bills and subscriptions.</p>
        </div>
      ` : payments.map(p => {
        const cat = state.categories.find(c => c.ID === p.Category);
        const acc = state.accounts.find(a => a.ID === p.Account);
        const nextDate = new Date(p.NextDate);
        const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
        const urgency = daysUntil <= 3 ? 'var(--accent-red)' : daysUntil <= 7 ? 'var(--accent-orange)' : 'var(--text-secondary)';

        return `
          <div class="card-sm" style="margin-bottom:10px;display:flex;align-items:center;gap:12px">
            <div class="tx-icon" style="background:${cat ? cat.Colour + '22' : '#ffffff11'}">${cat?.Emoji || '📅'}</div>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:500">${p.Name}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${acc?.Name || ''} · ${p.Frequency}</div>
              <div style="font-size:12px;color:${urgency};margin-top:2px">
                ${daysUntil === 0 ? 'Due today' : daysUntil < 0 ? 'Overdue' : `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}`}
              </div>
            </div>
            <div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">${formatCurrency(p.Amount, p.Currency)}</div>
          </div>
        `;
      }).join('')}

      <button class="btn-secondary" id="add-planned-btn" style="margin-top:8px">+ Add Planned Payment</button>
    `;

    document.getElementById('add-planned-btn')?.addEventListener('click', () => showAddPlannedModal());
  }

  function renderBudgets(container) {
    const budgets = state.budgets;
    const stats = state.transactions
      .filter(tx => {
        const d = new Date(tx.Date);
        const now = new Date();
        return tx.Type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, tx) => {
        acc[tx.Category] = (acc[tx.Category] || 0) + (parseFloat(tx.AmountInGBP) || 0);
        return acc;
      }, {});

    container.innerHTML = `
      ${budgets.length === 0 ? `
        <div class="empty-state">
          <span class="emoji">💰</span>
          <p>No budgets set yet.<br/>Set spending limits by category.</p>
        </div>
      ` : budgets.map(b => {
        const cat = state.categories.find(c => c.ID === b.Category);
        const spent = stats[b.Category] || 0;
        const limit = parseFloat(b.Amount) || 0;
        const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const overBudget = spent > limit;

        return `
          <div class="card" style="margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <div class="tx-icon" style="background:${cat ? cat.Colour + '22' : '#ffffff11'}">${cat?.Emoji || '📦'}</div>
              <div style="flex:1">
                <div style="font-size:15px;font-weight:500">${cat?.Name || b.Category}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${b.Period}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:14px;font-weight:700;font-family:var(--font-mono);color:${overBudget ? 'var(--accent-red)' : 'var(--text-primary)'}">
                  ${formatCurrency(spent)} / ${formatCurrency(limit, b.Currency)}
                </div>
              </div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill expense" style="width:${pct}%;background:${overBudget ? 'var(--accent-red)' : 'var(--accent-blue)'}"></div>
            </div>
            <div style="font-size:11px;color:${overBudget ? 'var(--accent-red)' : 'var(--text-tertiary)'};margin-top:6px;text-align:right">
              ${overBudget ? `${formatCurrency(spent - limit)} over budget` : `${formatCurrency(limit - spent)} remaining`}
            </div>
          </div>
        `;
      }).join('')}

      <button class="btn-secondary" id="add-budget-btn" style="margin-top:8px">+ Add Budget</button>
    `;

    document.getElementById('add-budget-btn')?.addEventListener('click', () => showAddBudgetModal());
  }

  function showAddPlannedModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const today = new Date().toISOString().split('T')[0];

    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">Add Planned Payment</h2>

        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input" id="plan-name" placeholder="e.g. Netflix, Rent" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <div style="display:flex;gap:8px">
            <input class="form-input amount" id="plan-amount" type="number" placeholder="0.00" style="flex:1" />
            <select class="form-input" id="plan-currency" style="width:90px">
              ${state.accounts.map(a => `<option value="${a.Currency}">${a.Currency}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-input" id="plan-category">
            ${state.categories.filter(c => c.Type === 'expense').map(c => `<option value="${c.ID}">${c.Emoji} ${c.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Account</label>
          <select class="form-input" id="plan-account">
            ${state.accounts.map(a => `<option value="${a.ID}">${a.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Frequency</label>
          <select class="form-input" id="plan-frequency">
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Next due date</label>
          <input class="form-input" id="plan-date" type="date" value="${today}" />
        </div>

        <button class="btn-primary" id="plan-save">Add Payment</button>
        <button class="btn-secondary" id="plan-cancel">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    document.getElementById('plan-save').addEventListener('click', async () => {
      const name = document.getElementById('plan-name').value.trim();
      const amount = document.getElementById('plan-amount').value;
      const currency = document.getElementById('plan-currency').value;
      const category = document.getElementById('plan-category').value;
      const account = document.getElementById('plan-account').value;
      const frequency = document.getElementById('plan-frequency').value;
      const nextDate = document.getElementById('plan-date').value;

      if (!name || !amount || !nextDate) { showToast('Please fill in all fields', 'error'); return; }

      const btn = document.getElementById('plan-save');
      btn.disabled = true; btn.textContent = 'Saving…';

      await addPlannedPayment({ name, amount, currency, category, account, frequency, nextDate });
      const payments = await getPlannedPayments();
      setState({ plannedPayments: payments });
      closeOverlay();
      showToast('Payment added ✓', 'success');
      render();
    });

    document.getElementById('plan-cancel').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

    function closeOverlay() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 350);
    }
  }

  function showAddBudgetModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">Add Budget</h2>

        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-input" id="bud-category">
            ${state.categories.filter(c => c.Type === 'expense').map(c => `<option value="${c.ID}">${c.Emoji} ${c.Name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Budget limit</label>
          <div style="display:flex;gap:8px">
            <input class="form-input amount" id="bud-amount" type="number" placeholder="0.00" style="flex:1" />
            <select class="form-input" id="bud-currency" style="width:90px">
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Period</label>
          <select class="form-input" id="bud-period">
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <button class="btn-primary" id="bud-save">Add Budget</button>
        <button class="btn-secondary" id="bud-cancel">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    document.getElementById('bud-save').addEventListener('click', async () => {
      const category = document.getElementById('bud-category').value;
      const amount = document.getElementById('bud-amount').value;
      const currency = document.getElementById('bud-currency').value;
      const period = document.getElementById('bud-period').value;

      if (!amount) { showToast('Please enter a budget amount', 'error'); return; }

      const btn = document.getElementById('bud-save');
      btn.disabled = true; btn.textContent = 'Saving…';

      await addBudget({ category, amount, currency, period });
      const budgets = await getBudgets();
      setState({ budgets });
      closeOverlay();
      showToast('Budget added ✓', 'success');
      render();
    });

    document.getElementById('bud-cancel').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

    function closeOverlay() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 350);
    }
  }

  render();
}
