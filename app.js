// ---- Supabase config ----
// Vul dit in met de Project URL en anon key van je NIEUWE Supabase-project
// (Project Settings > API). Run eerst supabase.sql in de SQL editor van dat project.
const SUPABASE_URL = 'https://aqjrdtanuinleufvcppd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxanJkdGFudWlubGV1ZnZjcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDAzNTUsImV4cCI6MjEwMDQ3NjM1NX0.rcWCss0WveZO7VzMn4AoqRfg5pzawUVbYHLuWyobEVI';

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const APP_VERSION = '1.3.0';
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('appVersion');
  if (el) el.textContent = 'v' + APP_VERSION;
});

// Vast account: de app logt hier automatisch mee in, geen inlogscherm nodig.
const FIXED_EMAIL = 'thomas.kern@mailo.com';
const FIXED_PASSWORD = 'Donald';

const START_YEAR = 2017;
const TYPE_LABELS = {
  dd_weekblad: 'Donald Duck Weekblad',
  kd_weekblad: 'Katrien Duck Weekblad',
  pocket: 'Pocket',
  dubbel_pocket: 'Dubbel Pocket',
};
const TYPE_MAX_NUMBER = { dd_weekblad: 52, kd_weekblad: 12 };
const TYPE_UNIT = { dd_weekblad: 'week', kd_weekblad: 'maand' };

let currentUser = null;
let magazines = [];
let realtimeChannel = null;
let statusTimer = null;
const pendingMutations = new Set();

let currentType = 'dd_weekblad';
let currentYear = new Date().getFullYear();
let currentPocketTab = 'pocket';

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

if (!supabaseClient) {
  $('authStatus').textContent = 'De app kon niet worden geladen. Controleer je internetverbinding en herlaad de pagina.';
  throw new Error('Supabase dependency kon niet worden geladen.');
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
  const { data, error } = await supabaseClient
    .from('magazines')
    .select('*')
    .order('year', { ascending: true })
    .order('number', { ascending: true });
  if (error) {
    showStatus(errorMessage(error, 'De collectie kon niet worden geladen.'));
    return false;
  }
  magazines = data || [];
  renderCurrentView();
  return true;
}

async function toggleGelezen(row) {
  return withMutation(`toggle:${row.id}`, async () => {
    const newVal = !row.gelezen;
    const { data, error } = await supabaseClient
      .from('magazines')
      .update({ gelezen: newVal, gelezen_op: newVal ? new Date().toISOString() : null })
      .eq('id', row.id)
      .eq('gelezen', row.gelezen)
      .select()
      .maybeSingle();
    if (error) {
      showStatus(errorMessage(error, 'De status kon niet worden gewijzigd.'));
      return null;
    }
    if (!data) {
      await refetchMagazines();
      showStatus('De editie was intussen op een ander apparaat gewijzigd. De collectie is vernieuwd.');
      return null;
    }
    const idx = magazines.findIndex((m) => m.id === row.id);
    if (idx >= 0) magazines[idx] = data;
    return data;
  });
}

async function insertRow(partial) {
  if (!currentUser) {
    showStatus('Log opnieuw in om een editie toe te voegen.');
    return null;
  }
  const { data, error } = await supabaseClient
    .from('magazines')
    .insert({ user_id: currentUser.id, ...partial })
    .select()
    .single();
  if (error) {
    showStatus(errorMessage(error, 'De editie kon niet worden toegevoegd.'));
    return null;
  }
  magazines.push(data);
  return data;
}

async function deleteRow(id) {
  const { error } = await supabaseClient.from('magazines').delete().eq('id', id);
  if (error) {
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
      const { data, error } = await supabaseClient
        .from('magazines')
        .update({ number, label: theme.trim() || null })
        .eq('id', row.id)
        .select()
        .single();
      if (error) {
        showStatus(errorMessage(error, 'De editie kon niet worden bijgewerkt.'));
      } else {
        const idx = magazines.findIndex((m) => m.id === row.id);
        magazines[idx] = data;
        renderPockets();
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

// ---------- auth (vast account, geen inlogscherm) ----------
async function onLogin(user) {
  if (currentUser?.id === user.id) return;
  currentUser = user;
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  showView('view-home');
  const loaded = await refetchMagazines();
  if (!loaded || currentUser?.id !== user.id) return;

  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel('magazines-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'magazines', filter: `user_id=eq.${user.id}` }, () => {
      refetchMagazines();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') showStatus('Live synchronisatie kon niet worden gestart.');
    });
}

function onLogout() {
  currentUser = null;
  magazines = [];
  if (realtimeChannel) { supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  $('appScreen').classList.add('hidden');
  $('authScreen').classList.remove('hidden');
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session?.user) void onLogin(session.user);
  else onLogout();
});

async function autoLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session && data.session.user && data.session.user.email === FIXED_EMAIL) {
    onLogin(data.session.user);
    return;
  }
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: FIXED_EMAIL,
      password: FIXED_PASSWORD,
    });
    if (error) throw error;
  } catch (err) {
    $('authStatus').textContent = 'Kon niet automatisch inloggen: ' + (err.message || 'onbekende fout');
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

void autoLogin();
