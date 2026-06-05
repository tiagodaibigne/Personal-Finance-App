// fx.js — Exchange rate fetching with local cache

const CACHE_KEY = 'finance_fx_cache';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export async function getExchangeRate(from, to) {
  if (from === to) return 1;

  const cacheKey = `${from}_${to}`;
  const cache = getCache();
  const cached = cache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rate;
  }

  try {
    // Using the free Frankfurter API (European Central Bank data, no key required)
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('FX fetch failed');
    const data = await res.json();
    const rate = data.rates[to];

    // Cache it
    cache[cacheKey] = { rate, timestamp: Date.now() };
    setCache(cache);

    return rate;
  } catch (err) {
    console.warn('FX rate fetch failed, using cached or fallback', err);
    // Return cached even if stale, or a rough fallback
    if (cached) return cached.rate;
    const fallbacks = { GBP_EUR: 1.17, EUR_GBP: 0.855, GBP_USD: 1.27, USD_GBP: 0.79 };
    return fallbacks[`${from}_${to}`] || 1;
  }
}

export async function convertToGBP(amount, fromCurrency) {
  if (fromCurrency === 'GBP') return amount;
  const rate = await getExchangeRate(fromCurrency, 'GBP');
  return parseFloat((amount * rate).toFixed(2));
}

export function formatCurrency(amount, currency = 'GBP') {
  const symbols = { GBP: '£', EUR: '€', USD: '$', CHF: 'CHF ' };
  const symbol = symbols[currency] || currency + ' ';
  const num = parseFloat(amount) || 0;
  return `${symbol}${Math.abs(num).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export function groupByDate(transactions) {
  const groups = {};
  transactions.forEach(tx => {
    const label = formatDate(tx.Date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return groups;
}

export function getMonthRange(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end };
}

export function isInRange(dateStr, start, end) {
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}
