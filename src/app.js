// app.js — Main entry point

import { initAuth, initTokenClient, requestToken, revokeToken, isSignedIn } from './utils/auth.js';
import { getOrCreateSpreadsheet, getTransactions, getAccounts, getCategories, getPlannedPayments, getBudgets } from './sheets/sheets.js';
import { state, setState, emit } from './utils/state.js';
import { renderDashboard } from './components/dashboard.js';
import { renderRecords } from './components/records.js';
import { renderStatistics } from './components/statistics.js';
import { renderPlanning } from './components/planning.js';
import { renderMore } from './components/more.js';
import { showAddTransaction } from './components/transaction-modal.js';
import { showToast } from './components/toast.js';

// ─── DOM refs ────────────────────────────────────────────────────────────────

const splash = document.getElementById('splash');
const app = document.getElementById('app');

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function boot() {
  try {
    await initAuth();

    initTokenClient(
      async (response) => {
        // Signed in successfully
        await onSignedIn();
      },
      (err) => {
        console.error('Auth error', err);
        showAuthScreen();
      }
    );

    if (isSignedIn()) {
      await onSignedIn();
    } else {
      hideSplash();
      showAuthScreen();
    }
  } catch (err) {
    console.error('Boot error', err);
    hideSplash();
    showAuthScreen();
  }
}

function hideSplash() {
  setTimeout(() => {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 400);
  }, 800);
}

// ─── Auth screen ──────────────────────────────────────────────────────────────

function showAuthScreen() {
  const existing = document.getElementById('auth-screen');
  if (existing) return;

  const screen = document.createElement('div');
  screen.id = 'auth-screen';
  screen.innerHTML = `
    <div class="auth-logo">
      <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="14" fill="#2563EB"/>
        <path d="M12 28L20 20L26 26L36 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="36" cy="16" r="3" fill="white"/>
      </svg>
      <h1>Finance</h1>
      <p>Your personal finance tracker.<br/>Data stored privately in your Google Drive.</p>
    </div>
    <button class="btn-google" id="sign-in-btn">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
    <p class="auth-note">Your financial data is stored only in your Google Drive. This app does not have its own server.</p>
  `;

  app.appendChild(screen);

  document.getElementById('sign-in-btn').addEventListener('click', () => {
    requestToken('');
  });
}

// ─── Main app setup ───────────────────────────────────────────────────────────

async function onSignedIn() {
  hideSplash();
  document.getElementById('auth-screen')?.remove();

  // Show loading state
  app.innerHTML += `<div id="loading-app" style="flex:1;display:flex;align-items:center;justify-content:center;"><div class="loading-spinner"></div></div>`;

  try {
    await getOrCreateSpreadsheet();
    await loadAllData();
    buildMainUI();
  } catch (err) {
    console.error('Setup error', err);
    document.getElementById('loading-app')?.remove();
    showToast('Failed to connect to Google Sheets. Please try again.', 'error');
    showAuthScreen();
  }
}

async function loadAllData() {
  const [transactions, accounts, categories, plannedPayments, budgets] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getCategories(),
    getPlannedPayments(),
    getBudgets(),
  ]);

  setState({
    transactions: transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date)),
    accounts,
    categories,
    plannedPayments,
    budgets,
    lastSync: new Date(),
  });
}

// ─── Main UI ──────────────────────────────────────────────────────────────────

function buildMainUI() {
  document.getElementById('loading-app')?.remove();

  const mainApp = document.createElement('div');
  mainApp.id = 'main-app';
  mainApp.innerHTML = `
    <div class="page-container" id="page-container">
      <div class="page active" id="page-dashboard"></div>
      <div class="page" id="page-records"></div>
      <div class="page" id="page-statistics"></div>
      <div class="page" id="page-planning"></div>
      <div class="page" id="page-more"></div>
    </div>

    <nav id="bottom-nav">
      <div class="nav-items">
        <button class="nav-item active" data-page="dashboard">
          <div class="nav-pill"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <span class="nav-label">Dashboard</span>
        </button>
        <button class="nav-item" data-page="records">
          <div class="nav-pill"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          <span class="nav-label">Records</span>
        </button>
        <button class="nav-item" data-page="statistics">
          <div class="nav-pill"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span class="nav-label">Statistics</span>
        </button>
        <button class="nav-item" data-page="planning">
          <div class="nav-pill"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
          </svg>
          <span class="nav-label">Planning</span>
        </button>
        <button class="nav-item" data-page="more">
          <div class="nav-pill"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
          <span class="nav-label">More</span>
        </button>
      </div>
    </nav>

    <button class="fab" id="fab-add" aria-label="Add transaction">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  app.appendChild(mainApp);

  // Initial render
  renderPage('dashboard');

  // Nav events
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      navigateTo(page);
    });
  });

  // FAB
  document.getElementById('fab-add').addEventListener('click', () => {
    showAddTransaction(() => {
      loadAllData().then(() => renderPage(state.currentPage));
    });
  });

  // Add toast container
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.id = 'toast';
  document.body.appendChild(toast);
}

function navigateTo(page) {
  setState({ currentPage: page });
  renderPage(page);

  // Scroll page to top
  document.getElementById('page-container').scrollTop = 0;

  // Show/hide FAB (hide on more/planning)
  const fab = document.getElementById('fab-add');
  if (fab) fab.style.display = ['more'].includes(page) ? 'none' : 'flex';
}

function renderPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) {
    el.classList.add('active');
    el.innerHTML = '';
  }

  switch (page) {
    case 'dashboard': renderDashboard(el); break;
    case 'records': renderRecords(el); break;
    case 'statistics': renderStatistics(el); break;
    case 'planning': renderPlanning(el); break;
    case 'more': renderMore(el, { onSignOut: handleSignOut, onReload: loadAllData }); break;
  }
}

async function handleSignOut() {
  revokeToken();
  location.reload();
}

// ─── Start ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', boot);

// Re-render on state change
import { on } from './utils/state.js';
on('rerender', (page) => renderPage(page || state.currentPage));

// ─── Service Worker registration ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(err => console.warn('SW registration failed', err));
  });
}
