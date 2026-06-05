// records.js
import { state } from '../utils/state.js';
import { groupByDate, formatCurrency } from '../utils/fx.js';
import { renderTransactionRow } from './dashboard.js';
import { showAddTransaction } from './transaction-modal.js';
import { getTransactions } from '../sheets/sheets.js';
import { setState } from '../utils/state.js';

export function renderRecords(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Records</h1>
    </div>

    <div class="search-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="search" id="records-search" placeholder="Search transactions…" />
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
      <button class="filter-chip active" data-filter="all">All</button>
      <button class="filter-chip" data-filter="expense">Expenses</button>
      <button class="filter-chip" data-filter="income">Income</button>
      <button class="filter-chip" data-filter="transfer">Transfers</button>
    </div>

    <style>
      .filter-chip {
        flex-shrink:0;
        padding: 7px 14px;
        background: var(--bg-card);
        border: 1px solid var(--border-light);
        border-radius: 99px;
        color: var(--text-secondary);
        font-family: var(--font-main);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .filter-chip.active {
        background: var(--accent-blue);
        border-color: var(--accent-blue);
        color: white;
      }
    </style>

    <div id="records-list"></div>
  `;

  let activeFilter = 'all';
  let searchQuery = '';

  function getFiltered() {
    return state.transactions.filter(tx => {
      const matchFilter = activeFilter === 'all' || tx.Type === activeFilter;
      const cat = state.categories.find(c => c.ID === tx.Category);
      const acc = state.accounts.find(a => a.ID === tx.Account);
      const searchStr = `${tx.Notes} ${cat?.Name || ''} ${acc?.Name || ''}`.toLowerCase();
      const matchSearch = !searchQuery || searchStr.includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  function renderList() {
    const list = document.getElementById('records-list');
    if (!list) return;

    const filtered = getFiltered();

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="emoji">🔍</span>
          <p>No transactions found.</p>
        </div>`;
      return;
    }

    const groups = groupByDate(filtered);

    list.innerHTML = Object.entries(groups).map(([date, txs]) => `
      <div class="tx-date-group">
        <div class="tx-date-label">${date}</div>
        <div class="card" style="padding:0 18px">
          ${txs.map(tx => renderTransactionRow(tx)).join('')}
        </div>
      </div>
    `).join('');

    // Tap to edit
    list.querySelectorAll('.transaction-item').forEach(item => {
      item.addEventListener('click', () => {
        const txId = item.dataset.txId;
        const tx = state.transactions.find(t => t.ID === txId);
        if (tx) {
          showAddTransaction(async () => {
            const transactions = await getTransactions();
            setState({ transactions: transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date)) });
            renderList();
          }, tx);
        }
      });
    });
  }

  // Search
  document.getElementById('records-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  // Filters
  el.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      el.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderList();
    });
  });

  renderList();
}
