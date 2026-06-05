// state.js — Central app state

export const state = {
  transactions: [],
  accounts: [],
  categories: [],
  plannedPayments: [],
  budgets: [],
  currentPage: 'dashboard',
  isLoading: false,
  lastSync: null,
  fxRates: {},
};

const listeners = {};

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

export function emit(event, data) {
  (listeners[event] || []).forEach(fn => fn(data));
}

export function setState(updates) {
  Object.assign(state, updates);
  emit('stateChange', state);
}

// Derived computations
export function getAccountBalance(accountId) {
  const account = state.accounts.find(a => a.ID === accountId);
  if (!account) return 0;

  const initial = parseFloat(account.InitialBalance) || 0;

  const txTotal = state.transactions
    .filter(tx => tx.Account === accountId || tx.TransferToAccount === accountId)
    .reduce((sum, tx) => {
      const amount = parseFloat(tx.Amount) || 0;
      if (tx.Type === 'income' && tx.Account === accountId) return sum + amount;
      if (tx.Type === 'expense' && tx.Account === accountId) return sum - amount;
      if (tx.Type === 'transfer') {
        if (tx.Account === accountId) return sum - amount;
        if (tx.TransferToAccount === accountId) return sum + amount;
      }
      return sum;
    }, 0);

  return initial + txTotal;
}

export function getMonthlyStats(transactions, period = 'this') {
  const now = new Date();
  let start, end;

  if (period === 'this') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'last') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  }

  const filtered = transactions.filter(tx => {
    const d = new Date(tx.Date);
    return d >= start && d <= end;
  });

  const income = filtered
    .filter(tx => tx.Type === 'income')
    .reduce((s, tx) => s + (parseFloat(tx.AmountInGBP) || 0), 0);

  const expenses = filtered
    .filter(tx => tx.Type === 'expense')
    .reduce((s, tx) => s + (parseFloat(tx.AmountInGBP) || 0), 0);

  return { income, expenses, net: income - expenses, filtered, start, end };
}

export function getCategoryBreakdown(transactions, type = 'expense') {
  const filtered = transactions.filter(tx => tx.Type === type);
  const totals = {};

  filtered.forEach(tx => {
    const cat = tx.Category;
    totals[cat] = (totals[cat] || 0) + (parseFloat(tx.AmountInGBP) || 0);
  });

  const total = Object.values(totals).reduce((s, v) => s + v, 0);

  return Object.entries(totals)
    .map(([cat, amount]) => ({ cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}
