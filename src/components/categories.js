// categories.js — Category manager modal
import { state, setState } from '../utils/state.js';
import { getCategories } from '../sheets/sheets.js';
import { appendRow, readSheet, deleteRow, TABS } from '../sheets/sheets.js';
import { showToast } from './toast.js';

const CAT_COLOURS = ['#4a7fd4','#4a9e72','#b85555','#b88040','#3a8a82','#7a62b8','#7a9e48','#b86070','#6a7a9e','#9e6a4a'];

export function showCategoryManager(onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let catType = 'expense';
  let selColour = CAT_COLOURS[0];

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">Manage Categories</div>
      <div class="type-toggle" id="cat-type-toggle">
        <button class="type-btn active expense" data-ct="expense">Expense</button>
        <button class="type-btn" data-ct="income">Income</button>
      </div>
      <div id="cat-list"></div>
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
        <div class="form-label" style="display:block;margin-bottom:10px">Add new category</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <input class="form-input" id="new-cat-name" placeholder="Category name" style="flex:1"/>
          <input class="form-input" id="new-cat-emoji" placeholder="🏷" style="width:56px;text-align:center;font-size:18px"/>
        </div>
        <div class="form-group">
          <label class="form-label">Colour</label>
          <div id="cat-swatches" style="display:flex;gap:7px;flex-wrap:wrap"></div>
        </div>
        <button class="btn-primary" id="add-cat-btn">Add Category</button>
      </div>
      <button class="btn-secondary" id="cat-close">Done</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  function buildSwatches() {
    const sw = document.getElementById('cat-swatches');
    sw.innerHTML = CAT_COLOURS.map(c => `
      <div data-c="${c}" style="width:26px;height:26px;border-radius:50%;background:${c};cursor:pointer;
        border:2px solid ${c === selColour ? '#e2e2e2' : 'transparent'};
        transform:${c === selColour ? 'scale(1.15)' : 'scale(1)'};transition:.12s"></div>`).join('');
    sw.querySelectorAll('div').forEach(s => {
      s.addEventListener('click', () => { selColour = s.dataset.c; buildSwatches(); });
    });
  }

  function renderList() {
    const cats = state.categories.filter(c => c.Type === catType);
    const list = document.getElementById('cat-list');
    list.innerHTML = cats.length === 0
      ? '<div style="text-align:center;color:var(--text-secondary);font-size:13px;padding:16px 0">No categories yet.</div>'
      : cats.map((c, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light)">
          <div style="width:30px;height:30px;border-radius:8px;background:${c.Colour || '#4a5a6a'}18;display:flex;align-items:center;justify-content:center;font-size:16px">${c.Emoji || '📦'}</div>
          <span style="flex:1;font-size:13px;font-weight:500">${c.Name}</span>
          <button data-id="${c.ID}" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:12px;padding:4px">✕</button>
        </div>`).join('');

    list.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const rows = await readSheet(TABS.CATEGORIES);
        const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
        if (idx > 0) await deleteRow(TABS.CATEGORIES, idx - 1);
        const fresh = await getCategories();
        setState({ categories: fresh });
        renderList();
        showToast('Category removed');
      });
    });
  }

  overlay.querySelectorAll('[data-ct]').forEach(btn => {
    btn.addEventListener('click', () => {
      catType = btn.dataset.ct;
      overlay.querySelectorAll('[data-ct]').forEach(b => b.classList.remove('active', 'expense', 'income'));
      btn.classList.add('active', catType);
      renderList();
    });
  });

  document.getElementById('add-cat-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    const emoji = document.getElementById('new-cat-emoji').value.trim() || '📦';
    if (!name) { showToast('Enter a name', 'error'); return; }
    const btn = document.getElementById('add-cat-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    await appendRow(TABS.CATEGORIES, ['cat_' + Date.now(), name, catType, emoji, selColour, 'TRUE']);
    const fresh = await getCategories();
    setState({ categories: fresh });
    document.getElementById('new-cat-name').value = '';
    document.getElementById('new-cat-emoji').value = '';
    renderList();
    btn.disabled = false; btn.textContent = 'Add Category';
    showToast('Category added ✓', 'success');
  });

  buildSwatches();
  renderList();

  document.getElementById('cat-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 350);
    onDone?.();
  }
}
