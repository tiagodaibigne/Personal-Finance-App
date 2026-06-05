// transaction-modal.js
import { state } from '../utils/state.js';
import { addTransaction, deleteTransaction } from '../sheets/sheets.js';
import { getExchangeRate, convertToGBP } from '../utils/fx.js';
import { showToast } from './toast.js';
import { logFXRate } from '../sheets/sheets.js';

export function showAddTransaction(onSaved, existingTx = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'tx-modal';

  const today = new Date().toISOString().split('T')[0];
  const isEdit = !!existingTx;

  const expenseCategories = state.categories.filter(c => c.Type === 'expense');
  const incomeCategories = state.categories.filter(c => c.Type === 'income');

  const defaultType = existingTx?.Type || 'expense';
  const defaultCurrency = existingTx?.Currency || state.accounts[0]?.Currency || 'GBP';

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 class="modal-title" style="margin:0">${isEdit ? 'Edit' : 'Add'} Transaction</h2>
        ${isEdit ? `<button class="icon-btn" id="tx-delete" style="color:var(--accent-red)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>` : ''}
      </div>

      <!-- Type toggle -->
      <div class="type-toggle" id="type-toggle">
        <button class="type-btn ${defaultType === 'expense' ? 'active expense' : ''}" data-type="expense">Expense</button>
        <button class="type-btn ${defaultType === 'income' ? 'active income' : ''}" data-type="income">Income</button>
        <button class="type-btn ${defaultType === 'transfer' ? 'active transfer' : ''}" data-type="transfer">Transfer</button>
      </div>

      <!-- Amount + Currency -->
      <div class="form-group">
        <label class="form-label">Amount</label>
        <div style="display:flex;gap:8px">
          <input class="form-input amount" id="tx-amount" type="number" inputmode="decimal"
            placeholder="0.00" step="0.01" min="0" value="${existingTx?.Amount || ''}" style="flex:1" />
          <select class="form-input" id="tx-currency" style="width:90px">
            ${state.accounts.map(a => `<option value="${a.Currency}" ${(existingTx?.Currency || defaultCurrency) === a.Currency ? 'selected' : ''}>${a.Currency}</option>`).join('')}
            <option value="USD" ${existingTx?.Currency === 'USD' ? 'selected' : ''}>USD</option>
            <option value="CHF" ${existingTx?.Currency === 'CHF' ? 'selected' : ''}>CHF</option>
          </select>
        </div>
      </div>

      <!-- Account -->
      <div class="form-group" id="account-group">
        <label class="form-label">Account</label>
        <select class="form-input" id="tx-account">
          ${state.accounts.map(a => `<option value="${a.ID}" ${existingTx?.Account === a.ID ? 'selected' : ''}>${a.Name} (${a.Currency})</option>`).join('')}
        </select>
      </div>

      <!-- Transfer to account (only for transfer type) -->
      <div class="form-group hidden" id="transfer-to-group">
        <label class="form-label">To Account</label>
        <select class="form-input" id="tx-transfer-to">
          ${state.accounts.map(a => `<option value="${a.ID}" ${existingTx?.TransferToAccount === a.ID ? 'selected' : ''}>${a.Name} (${a.Currency})</option>`).join('')}
        </select>
      </div>

      <!-- Category -->
      <div class="form-group" id="category-group">
        <label class="form-label">Category</label>
        <div class="category-grid" id="category-grid">
          ${expenseCategories.map(c => `
            <button class="category-chip ${existingTx?.Category === c.ID ? 'selected' : ''}" data-cat="${c.ID}">
              <span class="emoji">${c.Emoji}</span>
              <span class="label">${c.Name}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" id="tx-date" type="date" value="${existingTx?.Date || today}" />
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <input class="form-input" id="tx-notes" type="text" placeholder="What was this for?"
          value="${existingTx?.Notes || ''}" />
      </div>

      <button class="btn-primary" id="tx-save">${isEdit ? 'Save Changes' : 'Add Transaction'}</button>
      <button class="btn-secondary" id="tx-cancel">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  let currentType = defaultType;
  let selectedCategory = existingTx?.Category || null;

  // Type toggle
  overlay.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      overlay.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active', 'expense', 'income', 'transfer'));
      btn.classList.add('active', currentType);
      updateCategoryGrid();
      document.getElementById('transfer-to-group').classList.toggle('hidden', currentType !== 'transfer');
      document.getElementById('category-group').classList.toggle('hidden', currentType === 'transfer');
    });
  });

  function updateCategoryGrid() {
    const cats = currentType === 'income' ? incomeCategories : expenseCategories;
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = cats.map(c => `
      <button class="category-chip ${selectedCategory === c.ID ? 'selected' : ''}" data-cat="${c.ID}">
        <span class="emoji">${c.Emoji}</span>
        <span class="label">${c.Name}</span>
      </button>
    `).join('');
    attachCategoryListeners();
  }

  function attachCategoryListeners() {
    overlay.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedCategory = chip.dataset.cat;
      });
    });
  }

  attachCategoryListeners();

  // Initial state setup
  if (defaultType === 'transfer') {
    document.getElementById('transfer-to-group').classList.remove('hidden');
    document.getElementById('category-group').classList.add('hidden');
  }

  // Save
  document.getElementById('tx-save').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const currency = document.getElementById('tx-currency').value;
    const account = document.getElementById('tx-account').value;
    const date = document.getElementById('tx-date').value;
    const notes = document.getElementById('tx-notes').value.trim();
    const transferTo = document.getElementById('tx-transfer-to')?.value;

    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    if (!date) { showToast('Please select a date', 'error'); return; }
    if (currentType !== 'transfer' && !selectedCategory) { showToast('Please select a category', 'error'); return; }

    const saveBtn = document.getElementById('tx-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      // Get FX rate and GBP equivalent
      let amountInGBP = amount;
      let fxRate = 1;

      if (currency !== 'GBP') {
        fxRate = await getExchangeRate(currency, 'GBP');
        amountInGBP = parseFloat((amount * fxRate).toFixed(2));
        await logFXRate(currency, 'GBP', fxRate);
      }

      const tx = {
        date,
        type: currentType,
        amount: amount.toString(),
        currency,
        category: selectedCategory || '',
        account,
        notes,
        transferToAccount: currentType === 'transfer' ? transferTo : '',
        amountInGBP: amountInGBP.toString(),
        fxRate: fxRate.toString(),
      };

      await addTransaction(tx);
      closeModal();
      showToast('Transaction saved ✓', 'success');
      onSaved?.();
    } catch (err) {
      console.error(err);
      showToast('Failed to save. Check your connection.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Transaction';
    }
  });

  // Delete
  document.getElementById('tx-delete')?.addEventListener('click', async () => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await deleteTransaction(existingTx.ID);
      closeModal();
      showToast('Transaction deleted', 'success');
      onSaved?.();
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  });

  // Cancel / outside click
  document.getElementById('tx-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 350);
  }
}
