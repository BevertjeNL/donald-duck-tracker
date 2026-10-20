const APP_VERSION = '2.1.1';
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('appVersion');
  if (el) el.textContent = 'v' + APP_VERSION;
});

const START_YEAR = 2017;
const TYPE_LABELS = {
  dd_weekblad: 'Donald Duck Weekblad',
  kd_weekblad: 'Katrien Duck Weekblad',
  pocket: 'Pocket',
  dubbel_pocket: 'Dubbel Pocket',
};
const TYPE_MAX_NUMBER = { dd_weekblad: 52, kd_weekblad: 12 };
const TYPE_UNIT = { dd_weekblad: 'week', kd_weekblad: 'maand' };

let magazines = [];
let statusTimer = null;
const pendingMutations = new Set();

let currentType = 'dd_weekblad';
let currentYear = new Date().getFullYear();
let currentPocketTab = 'pocket';

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

async function api(method, query = '', body) {
  const res = await fetch('/api/magazines' + query, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || 'Serverfout'), { code: data.code });
  }
  return res.status === 204 ? null : res.json();
}

function showStatus(message, kind = 'error') {
  const el = $('appStatus');
  el.textContent = message;
  el.className = `app-status ${kind}`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}

function errorMessage(error, fallback) {
  console.error(error);
  if (error?.code === '23505') return 'Deze editie bestaat al.';
  if (!navigator.onLine) return 'Geen internetverbinding. Probeer het opnieuw zodra je online bent.';
  return error?.message || fallback;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function withMutation(key, operation) {
  if (pendingMutations.has(key)) return null;
  pendingMutations.add(key);
  try {
    return await operation();
  } finally {
    pendingMutations.delete(key);
  }
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $(id).classList.add('active');
}

function extraYearsKey(type) { return `dd_tracker_extra_years_${type}`; }

function getExtraYears(type) {
  try { return JSON.parse(localStorage.getItem(extraYearsKey(type)) || '[]'); }
  catch { return []; }
}

function addExtraYear(type, year) {
  const years = getExtraYears(type);
  if (!years.includes(year)) {
    years.push(year);
    localStorage.setItem(extraYearsKey(type), JSON.stringify(years));
  }
}

function yearsForType(type) {
  const nowYear = new Date().getFullYear();
  const set = new Set();
  for (let y = START_YEAR; y <= nowYear; y++) set.add(y);
  magazines.filter((m) => m.type === type && m.year).forEach((m) => set.add(m.year));
  getExtraYears(type).forEach((y) => set.add(y));
  return Array.from(set).sort((a, b) => a - b);
}

function findRow(type, year, number, isSpecial) {
  return magazines.find(
    (m) => m.type === type && m.year === year && m.number === number && !!m.is_special === !!isSpecial
  );
}

async function refetchMagazines() {
  try {
    magazines = await api('GET');
  } catch (error) {
    showStatus(errorMessage(error, 'De collectie kon niet worden geladen.'));
    return false;
  }
  renderCurrentView();
  return true;
}

async function toggleGelezen(row) {
  return withMutation(`toggle:${row.id}`, async () => {
    const newVal = !row.gelezen;
    try {
      const data = await api('PATCH', `?id=${row.id}`, {
        gelezen: newVal,
        gelezen_op: newVal ? new Date().toISOString() : null,
      });
      const idx = magazines.findIndex((m) => m.id === row.id);
      if (idx >= 0) magazines[idx] = data;
      return data;
    } catch (error) {
      showStatus(errorMessage(error, 'De status kon niet worden gewijzigd.'));
      return null;
    }
  });
}

async function insertRow(partial) {
  try {
    const data = await api('POST', '', partial);
    magazines.push(data);
    return data;
  } catch (error) {
    showStatus(errorMessage(error, 'De editie kon niet worden toegevoegd.'));
    return null;
  }
}

async function deleteRow(id) {
  try {
    await api('DELETE', `?id=${id}`);
  } catch (error) {
    showStatus(errorMessage(error, 'De editie kon niet worden verwijderd.'));
    return false;
  }
  magazines = magazines.filter((m) => m.id !== id);
  return true;
}

function renderCurrentView() {
  const active = document.querySelector('.view.active');
  if (!active) return;
  if (active.id === 'view-yeargrid') renderYearGrid();
  if (active.id === 'view-pockets') renderPockets();
}

// ---------- year grid (DD / KD) ----------
function openYearGrid(type) {
  currentType = type;
  currentYear = yearsForType(type).slice(-1)[0] || new Date().getFullYear();
  $('yeargridTitle').textContent = TYPE_LABELS[type];
  showView('view-yeargrid');
  renderYearGrid();
}

function renderYearGrid() {
  const years = yearsForType(currentType);
  const yearRow = $('yearRow');
  yearRow.innerHTML = '';
  years.forEach((y) => {
    const chip = document.createElement('button');
    chip.className = 'year-chip' + (y === currentYear ? ' active' : '');
    chip.textContent = y;
    chip.addEventListener('click', () => { currentYear = y; renderYearGrid(); });
    yearRow.appendChild(chip);
  });
  const addChip = document.createElement('button');
  addChip.className = 'year-chip add';
  addChip.textContent = '+ jaar';
  addChip.addEventListener('click', () => {
    const val = prompt('Welk jaartal wil je toevoegen?', String(new Date().getFullYear() + 1));
    const y = positiveInteger(val);
    if (y && y > 1900 && y <= 9999) {
      addExtraYear(currentType, y);
      currentYear = y;
      renderYearGrid();
    } else if (val !== null) {
      showStatus('Vul een geldig jaartal tussen 1901 en 9999 in.');
    }
  });
  yearRow.appendChild(addChip);

  const maxNum = TYPE_MAX_NUMBER[currentType];
  const heatmap = $('heatmap');
  heatmap.innerHTML = '';

  for (let n = 1; n <= maxNum; n++) {
    const row = findRow(currentType, currentYear, n, false);
    const tile = document.createElement('button');
    tile.className = 'hm-tile ' + (row && row.gelezen ? 'read' : 'unread');
    tile.textContent = String(n).padStart(2, '0');
    tile.title = `${TYPE_UNIT[currentType]} ${n} - ${currentYear}`;
    tile.addEventListener('click', async () => {
      if (row) await toggleGelezen(row);
      else await insertRow({ type: currentType, year: currentYear, number: n, is_special: false, gelezen: true, gelezen_op: new Date().toISOString() });
      renderYearGrid();
    });
    heatmap.appendChild(tile);
  }

  const specials = magazines.filter((m) => m.type === currentType && m.year === currentYear && m.is_special);
  specials.forEach((row) => {
    const tile = document.createElement('button');
    tile.className = 'hm-tile special ' + (row.gelezen ? 'read' : 'unread');
    tile.textContent = row.label || 'Special';
    tile.title = row.label || 'Speciale editie';
    tile.addEventListener('click', async () => { await toggleGelezen(row); renderYearGrid(); });
    heatmap.appendChild(tile);
  });
}

$('btnToggleSpecialForm').addEventListener('click', () => {
  $('specialForm').classList.toggle('hidden');
});

$('btnAddSpecial').addEventListener('click', async () => {
  const label = $('specialLabel').value.trim();
  if (!label) return;
  const inserted = await insertRow({ type: currentType, year: currentYear, number: null, is_special: true, label, gelezen: false });
  if (!inserted) return;
  $('specialLabel').value = '';
  $('specialForm').classList.add('hidden');
  renderYearGrid();
});

// ---------- pockets ----------
document.querySelectorAll('[data-pockettab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentPocketTab = btn.dataset.pockettab;
    document.querySelectorAll('[data-pockettab]').forEach((b) => b.classList.toggle('active', b === btn));
    renderPockets();
  });
});

function renderPockets() {
  const rows = magazines
    .filter((m) => m.type === currentPocketTab)
    .sort((a, b) => (a.number ?? 999999) - (b.number ?? 999999));

  const list = $('pocketList');
  list.innerHTML = '';

  if (rows.length === 0) {
    list.innerHTML = `<div class="empty-hint">Nog geen ${TYPE_LABELS[currentPocketTab].toLowerCase()}s toegevoegd.</div>`;
    return;
  }

  rows.forEach((row) => {
    const el = document.createElement('div');
    el.className = 'pocket-row';
    el.innerHTML = `
      <div class="pocket-num">${row.number ?? '-'}</div>
      <div class="pocket-title">
        ${row.label ? `<div class="theme">${escapeHtml(row.label)}</div>` : ''}
      </div>
      <button class="toggle-btn ${row.gelezen ? 'read' : 'unread'}" data-action="toggle">${row.gelezen ? 'Gelezen' : 'Niet gelezen'}</button>
      <div class="row-actions">
        <button data-action="edit" title="Bewerken">&#9998;</button>
        <button data-action="delete" title="Verwijderen">&#128465;</button>
      </div>
    `;
    el.querySelector('[data-action="toggle"]').addEventListener('click', async () => { await toggleGelezen(row); renderPockets(); });
    el.querySelector('[data-action="edit"]').addEventListener('click', async () => {
      const numValue = prompt('Nummer:', row.number ?? '');
      if (numValue === null) return;
      const number = numValue.trim() ? positiveInteger(numValue) : null;
      if (numValue.trim() && !number) {
        showStatus('Vul een positief, geheel nummer in.');
        return;
      }
      const theme = prompt('Thema / titel:', row.label ?? '');
      if (theme === null) return;
      if (!number && !theme.trim()) {
        showStatus('Vul een nummer of titel in.');
        return;
      }
      try {
        const data = await api('PATCH', `?id=${row.id}`, { number, label: theme.trim() || null });
        const idx = magazines.findIndex((m) => m.id === row.id);
        magazines[idx] = data;
        renderPockets();
      } catch (error) {
        showStatus(errorMessage(error, 'De editie kon niet worden bijgewerkt.'));
      }
    });
    el.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (confirm('Deze editie verwijderen?') && await deleteRow(row.id)) renderPockets();
    });
    list.appendChild(el);
  });
}

$('btnAddPocket').addEventListener('click', async () => {
  const numVal = $('pocketNumber').value.trim();
  const theme = $('pocketTheme').value.trim();
  if (!numVal && !theme) return;
  const number = numVal ? positiveInteger(numVal) : null;
  if (numVal && !number) {
    showStatus('Vul een positief, geheel nummer in.');
    return;
  }
  const inserted = await insertRow({
    type: currentPocketTab,
    year: null,
    number,
    label: theme || null,
    is_special: false,
    gelezen: false,
  });
  if (!inserted) return;
  $('pocketNumber').value = '';
  $('pocketTheme').value = '';
  renderPockets();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- quick check ----------
$('btnQuickCheck').addEventListener('click', () => {
  $('qcResult').classList.add('hidden');
  $('qcForm').reset();
  showView('view-quickcheck');
});

$('qcType').addEventListener('change', () => {
  const isPeriodic = ['dd_weekblad', 'kd_weekblad'].includes($('qcType').value);
  $('qcYear').classList.toggle('hidden', !isPeriodic);
  $('qcYear').required = isPeriodic;
  $('qcNumber').max = isPeriodic ? TYPE_MAX_NUMBER[$('qcType').value] : '';
});
$('qcType').dispatchEvent(new Event('change'));

let qcCurrentRow = null;
let qcCurrentQuery = null;

$('qcForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('qcType').value;
  const isPeriodic = ['dd_weekblad', 'kd_weekblad'].includes(type);
  const year = isPeriodic ? positiveInteger($('qcYear').value) : null;
  const number = positiveInteger($('qcNumber').value);
  if (isPeriodic && (!year || year <= 1900 || year > 9999)) {
    showStatus('Vul een geldig jaartal tussen 1901 en 9999 in.');
    return;
  }
  if (!number || (isPeriodic && number > TYPE_MAX_NUMBER[type])) {
    showStatus(`Vul een geldig ${isPeriodic ? TYPE_UNIT[type] : 'nummer'} in.`);
    return;
  }

  const row = magazines.find((m) => m.type === type && m.year === year && m.number === number && !m.is_special);
  qcCurrentRow = row || null;
  qcCurrentQuery = { type, year, number };
  renderQcResult();
});

function renderQcResult() {
  const el = $('qcResult');
  el.classList.remove('hidden');
  const gelezen = qcCurrentRow ? qcCurrentRow.gelezen : false;
  el.className = 'qc-result ' + (gelezen ? 'read' : 'unread');
  const { type, year, number } = qcCurrentQuery;
  const desc = ['dd_weekblad', 'kd_weekblad'].includes(type)
    ? `${TYPE_UNIT[type]} ${number} - ${year}`
    : `${TYPE_LABELS[type]} ${number}`;
  el.innerHTML = `${gelezen ? 'AL GELEZEN' : 'NOG NIET GELEZEN'}<span class="qc-sub">${desc} &middot; tik om te wisselen</span>`;
}

$('qcResult').addEventListener('click', async () => {
  if (!qcCurrentQuery) return;
  if (qcCurrentRow) {
    const updated = await toggleGelezen(qcCurrentRow);
    if (updated) qcCurrentRow = updated;
  } else {
    const { type, year, number } = qcCurrentQuery;
    qcCurrentRow = await insertRow({ type, year, number, is_special: false, gelezen: true, gelezen_op: new Date().toISOString() });
  }
  if (qcCurrentRow) renderQcResult();
});

// ---------- backup ----------
$('btnBackup').addEventListener('click', async () => {
  if (!(await refetchMagazines())) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const backup = { app: 'donald-duck-tracker', version: APP_VERSION, exported_at: now.toISOString(), magazines };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `donald-duck-tracker-backup-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showStatus(`Backup gemaakt: ${magazines.length} edities.`, 'success');
});

// ---------- navigation ----------
document.querySelectorAll('[data-open]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.open;
    if (target === 'pockets') { showView('view-pockets'); renderPockets(); }
    else openYearGrid(target);
  });
});

document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.back));
});

// ---------- start ----------
async function start() {
  const loaded = await refetchMagazines();
  if (!loaded) {
    $('authStatus').textContent = 'De collectie kon niet worden geladen. Herlaad de pagina.';
    return;
  }
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  showView('view-home');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

void start();
