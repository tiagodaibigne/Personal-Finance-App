// sheets.js — BudgetBakers-compatible schema

const SHEET_NAME = 'Tiago Finance';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

export const TABS = {
  TRANSACTIONS: 'Transactions',
  ACCOUNTS: 'Accounts',
  CATEGORIES: 'Categories',
  PLANNED: 'PlannedPayments',
  BUDGETS: 'Budgets',
  FX_RATES: 'ExchangeRates',
  SETTINGS: 'Settings',
};

// BudgetBakers schema
export const TX_HEADERS = [
  'account','category','currency','amount','ref_currency_amount',
  'type','payment_type','payment_type_local','note',
  'date','gps_latitude','gps_longitude','gps_accuracy_in_meters',
  'warranty_in_month','transfer','payee','labels','envelope_id','custom_category'
];

export const ACCOUNT_HEADERS = ['ID','Name','Symbol','Currency','InitialBalance','Colour','Active','CreatedAt'];
export const CATEGORY_HEADERS = ['ID','Name','Type','Icon','Colour','Labels','Active'];
export const PLANNED_HEADERS  = ['ID','Name','Amount','Currency','Category','Account','Frequency','NextDate','Payee','Active','Notes','CreatedAt'];
export const BUDGET_HEADERS   = ['ID','Category','AmountMonthly','AmountYearly','Currency','Active','CreatedAt'];
export const FX_HEADERS       = ['Date','Base','Target','Rate','Source'];
export const SETTINGS_HEADERS = ['Key','Value'];

let _sheetId = null;

export async function getOrCreateSpreadsheet() {
  const cached = localStorage.getItem('finance_sheet_id');
  if (cached) { _sheetId = cached; return cached; }

  const res = await gapi.client.drive.files.list({
    q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id)',
  });

  if (res.result.files?.length > 0) {
    _sheetId = res.result.files[0].id;
    localStorage.setItem('finance_sheet_id', _sheetId);
    return _sheetId;
  }

  const cr = await gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: { title: SHEET_NAME },
      sheets: Object.values(TABS).map(title => ({ properties: { title } })),
    },
  });

  _sheetId = cr.result.spreadsheetId;
  localStorage.setItem('finance_sheet_id', _sheetId);
  await initHeaders(_sheetId);
  await seedDefaults(_sheetId);
  return _sheetId;
}

async function initHeaders(id) {
  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    resource: {
      valueInputOption: 'RAW',
      data: [
        { range: `${TABS.TRANSACTIONS}!A1`, values: [TX_HEADERS] },
        { range: `${TABS.ACCOUNTS}!A1`,     values: [ACCOUNT_HEADERS] },
        { range: `${TABS.CATEGORIES}!A1`,   values: [CATEGORY_HEADERS] },
        { range: `${TABS.PLANNED}!A1`,      values: [PLANNED_HEADERS] },
        { range: `${TABS.BUDGETS}!A1`,      values: [BUDGET_HEADERS] },
        { range: `${TABS.FX_RATES}!A1`,     values: [FX_HEADERS] },
        { range: `${TABS.SETTINGS}!A1`,     values: [SETTINGS_HEADERS] },
      ],
    },
  });
}

async function seedDefaults(id) {
  const now = new Date().toISOString();
  const accounts = [
    ['acc_gbp','£ Sterling','£','GBP','0','#4672c4','TRUE',now],
    ['acc_eur','€ Euro',    '€','EUR','0','#2e7a72','TRUE',now],
  ];
  const categories = [
    ['cat_food',    'Food & Drink',  'expense','food',    '#a87838','groceries,food',   'TRUE'],
    ['cat_coffee',  'Coffee',        'expense','coffee',  '#8a5a38','coffee,morning',   'TRUE'],
    ['cat_trans',   'Transport',     'expense','trans',   '#7258a8','commute,transport','TRUE'],
    ['cat_shop',    'Shopping',      'expense','shop',    '#a85868','shopping,clothes', 'TRUE'],
    ['cat_bills',   'Bills',         'expense','bills',   '#a87838','rent,utilities',   'TRUE'],
    ['cat_health',  'Health',        'expense','health',  '#a84848','health,pharmacy',  'TRUE'],
    ['cat_entert',  'Entertainment', 'expense','entert',  '#2e7a72','subscription,fun', 'TRUE'],
    ['cat_travel',  'Travel',        'expense','travel',  '#4672c4','travel,flights',   'TRUE'],
    ['cat_run',     'Fitness',       'expense','run',     '#3d9468','running,sport',    'TRUE'],
    ['cat_home',    'Home',          'expense','home',    '#58728a','home,furniture',   'TRUE'],
    ['cat_family',  'Family',        'expense','family',  '#6e8a38','family,kids',      'TRUE'],
    ['cat_edu',     'Education',     'expense','edu',     '#7258a8','education,books',  'TRUE'],
    ['cat_other',   'Other',         'expense','other',   '#3a4a5a','',                 'TRUE'],
    ['cat_salary',  'Salary',        'income', 'salary',  '#3d9468','salary,income',    'TRUE'],
    ['cat_free',    'Freelance',     'income', 'freelance','#6e8a38','freelance',       'TRUE'],
    ['cat_invest',  'Investment',    'income', 'invest',  '#2e7a72','investment',       'TRUE'],
    ['cat_other_i', 'Other Income',  'income', 'other',   '#4672c4','',                 'TRUE'],
  ];
  const settings = [
    ['base_currency','GBP'],['created_at',now],['version','3.0.0'],['user_name','Tiago'],
  ];
  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    resource: {
      valueInputOption: 'RAW',
      data: [
        { range: `${TABS.ACCOUNTS}!A2`,   values: accounts },
        { range: `${TABS.CATEGORIES}!A2`, values: categories },
        { range: `${TABS.SETTINGS}!A2`,   values: settings },
      ],
    },
  });
}

export async function readSheet(tab) {
  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: _sheetId, range: tab,
  });
  return res.result.values || [];
}

export function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0];
  return rows.slice(1).map(row => {
    const o = {};
    h.forEach((k, i) => { o[k] = row[i] ?? ''; });
    return o;
  });
}

export async function appendRow(tab, values) {
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: _sheetId, range: tab,
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });
}

export async function deleteRow(tab, rowIndex) {
  const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: _sheetId, fields: 'sheets.properties' });
  const sheet = meta.result.sheets.find(s => s.properties.title === tab);
  if (!sheet) return;
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: _sheetId,
    resource: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex + 1, endIndex: rowIndex + 2 } } }] },
  });
}

// BudgetBakers-schema transaction writer
export async function addTransaction(tx) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const fxRates = { GBP: 1, EUR: 0.855, USD: 0.787 };
  const ref = parseFloat(((+tx.amount) * (fxRates[tx.currency] || 1)).toFixed(2));
  const row = [
    tx.account, tx.category, tx.currency, tx.amount, ref,
    tx.type, tx.payment_type || 'card', tx.payment_type_local || '',
    tx.note || '', tx.date || now,
    '','','','', // gps, warranty
    tx.transfer || '', tx.payee || '', tx.labels || '',
    tx.envelope_id || '', tx.custom_category || '',
  ];
  await appendRow(TABS.TRANSACTIONS, row);
}

export async function getTransactions() {
  const rows = await readSheet(TABS.TRANSACTIONS);
  return rowsToObjects(rows).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getAccounts()  { return rowsToObjects(await readSheet(TABS.ACCOUNTS)).filter(a => a.Active === 'TRUE'); }
export async function getCategories(){ return rowsToObjects(await readSheet(TABS.CATEGORIES)).filter(c => c.Active === 'TRUE'); }
export async function getPlanned()   { return rowsToObjects(await readSheet(TABS.PLANNED)).filter(p => p.Active === 'TRUE'); }
export async function getBudgets()   { return rowsToObjects(await readSheet(TABS.BUDGETS)).filter(b => b.Active === 'TRUE'); }

export async function logFXRate(base, target, rate) {
  await appendRow(TABS.FX_RATES, [new Date().toISOString().split('T')[0], base, target, rate, 'frankfurter.app']);
}

export async function getSetting(key) {
  const rows = await readSheet(TABS.SETTINGS);
  return rowsToObjects(rows).find(r => r.Key === key)?.Value || null;
}

export async function addAccount(acc) {
  const id = 'acc_' + Date.now(), now = new Date().toISOString();
  await appendRow(TABS.ACCOUNTS, [id, acc.name, acc.symbol, acc.currency, acc.initialBalance || '0', acc.colour || '#4672c4', 'TRUE', now]);
  return id;
}

export async function addCategory(cat) {
  const id = 'cat_' + Date.now();
  await appendRow(TABS.CATEGORIES, [id, cat.name, cat.type, cat.icon || 'other', cat.colour || '#3a4a5a', cat.labels || '', 'TRUE']);
  return id;
}

export async function addPlanned(p) {
  const id = 'plan_' + Date.now(), now = new Date().toISOString();
  await appendRow(TABS.PLANNED, [id, p.name, p.amount, p.currency, p.category, p.account, p.frequency, p.nextDate, p.payee || '', 'TRUE', p.notes || '', now]);
  return id;
}

export async function addBudget(b) {
  const id = 'bud_' + Date.now(), now = new Date().toISOString();
  await appendRow(TABS.BUDGETS, [id, b.category, b.amountMonthly, b.amountYearly || (b.amountMonthly * 12), b.currency || 'GBP', 'TRUE', now]);
  return id;
}

// CSV export in BudgetBakers format
export function exportToCSV(transactions) {
  const rows = [TX_HEADERS, ...transactions.map(tx => TX_HEADERS.map(h => tx[h] || ''))];
  const csv = rows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `finance_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
