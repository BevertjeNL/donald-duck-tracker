// ---- Supabase config ----
// Vul dit in met de Project URL en anon key van je NIEUWE Supabase-project
// (Project Settings > API). Run eerst supabase.sql in de SQL editor van dat project.
const SUPABASE_URL = 'https://aqjrdtanuinleufvcppd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxanJkdGFudWlubGV1ZnZjcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDAzNTUsImV4cCI6MjEwMDQ3NjM1NX0.rcWCss0WveZO7VzMn4AoqRfg5pzawUVbYHLuWyobEVI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

let currentType = 'dd_weekblad';
let currentYear = new Date().getFullYear();
let currentPocketTab = 'pocket';
let isSignup = false;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

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
  if (error) { console.error(error); return; }
  magazines = data || [];
  renderCurrentView();
}

async function toggleGelezen(row) {
  const newVal = !row.gelezen;
  const { data, error } = await supabaseClient
    .from('magazines')
    .update({ gelezen: newVal, gelezen_op: newVal ? new Date().toISOString() : null })
    .eq('id', row.id)
    .select()
    .single();
  if (error) { console.error(error); return; }
  const idx = magazines.findIndex((m) => m.id === row.id);
  if (idx >= 0) magazines[idx] = data;
}

async function insertRow(partial) {
  const { data, error } = await supabaseClient
    .from('magazines')
    .insert({ user_id: currentUser.id, ...partial })
    .select()
    .single();
  if (error) { console.error(error); return null; }
  magazines.push(data);
  return data;
}

async function deleteRow(id) {
  const { error } = await supabaseClient.from('magazines').delete().eq('id', id);
  if (error) { console.error(error); return; }
  magazines = magazines.filter((m) => m.id !== id);
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
    const y = parseInt(val, 10);
    if (y && y > 1900) {
      addExtraYear(currentType, y);
      currentYear = y;
      renderYearGrid();
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
      if (row) {
        await toggleGelezen(row);
      } else {
        await insertRow({ type: currentType, year: currentYear, number: n, is_special: false, gelezen: true, gelezen_op: new Date().toISOString() });
      }
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
  await insertRow({ type: currentType, year: currentYear, number: null, is_special: true, label, gelezen: false });
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
      const num = prompt('Nummer:', row.number ?? '');
      if (num === null) return;
      const theme = prompt('Thema / titel:', row.label ?? '');
      const { data, error } = await supabaseClient
        .from('magazines')
        .update({ number: num ? parseInt(num, 10) : null, label: theme || null })
        .eq('id', row.id)
        .select()
        .single();
      if (!error) {
        const idx = magazines.findIndex((m) => m.id === row.id);
        magazines[idx] = data;
        renderPockets();
      }
    });
    el.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (confirm('Deze editie verwijderen?')) { await deleteRow(row.id); renderPockets(); }
    });
    list.appendChild(el);
  });
}

$('btnAddPocket').addEventListener('click', async () => {
  const numVal = $('pocketNumber').value;
  const theme = $('pocketTheme').value.trim();
  if (!numVal && !theme) return;
  await insertRow({
    type: currentPocketTab,
    year: null,
    number: numVal ? parseInt(numVal, 10) : null,
    label: theme || null,
    is_special: false,
    gelezen: false,
  });
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
});
$('qcType').dispatchEvent(new Event('change'));

let qcCurrentRow = null;
let qcCurrentQuery = null;

$('qcForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('qcType').value;
  const isPeriodic = ['dd_weekblad', 'kd_weekblad'].includes(type);
  const year = isPeriodic ? parseInt($('qcYear').value, 10) : null;
  const number = parseInt($('qcNumber').value, 10);
  if (isPeriodic && !year) return;
  if (!number) return;

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
  if (qcCurrentRow) {
    await toggleGelezen(qcCurrentRow);
  } else {
    const { type, year, number } = qcCurrentQuery;
    qcCurrentRow = await insertRow({ type, year, number, is_special: false, gelezen: true, gelezen_op: new Date().toISOString() });
  }
  renderQcResult();
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

// ---------- auth ----------
$('btnAuthToggle').addEventListener('click', () => {
  isSignup = !isSignup;
  $('btnAuthSubmit').textContent = isSignup ? 'Account aanmaken' : 'Inloggen';
  $('btnAuthToggle').textContent = isSignup ? 'Al een account? Inloggen' : 'Nog geen account? Aanmaken';
  $('authStatus').textContent = '';
});

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  $('authStatus').textContent = '';
  try {
    if (isSignup) {
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      $('authStatus').textContent = 'Account aangemaakt. Check je mail als bevestiging nodig is, of log nu in.';
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    $('authStatus').textContent = err.message || 'Er ging iets mis.';
  }
});

// ---------- forgot / reset password ----------
function showAuthCard(id) {
  ['authForm', 'forgotForm', 'resetPasswordForm'].forEach((formId) => {
    $(formId).classList.toggle('hidden', formId !== id);
  });
}

$('btnForgotPassword').addEventListener('click', () => {
  $('forgotStatus').textContent = '';
  $('forgotEmail').value = $('authEmail').value.trim();
  showAuthCard('forgotForm');
});

$('btnForgotBack').addEventListener('click', () => {
  $('authStatus').textContent = '';
  showAuthCard('authForm');
});

$('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('forgotEmail').value.trim();
  $('forgotStatus').style.color = '';
  $('forgotStatus').textContent = '';
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    $('forgotStatus').style.color = 'var(--unread)';
    $('forgotStatus').textContent = 'Check je mail voor de link om een nieuw wachtwoord in te stellen.';
  } catch (err) {
    $('forgotStatus').textContent = err.message || 'Er ging iets mis.';
  }
});

$('resetPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('resetPassword').value;
  const confirm = $('resetPasswordConfirm').value;
  $('resetStatus').textContent = '';
  if (password !== confirm) {
    $('resetStatus').textContent = 'Wachtwoorden komen niet overeen.';
    return;
  }
  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    $('resetPasswordForm').reset();
    showAuthCard('authForm');
    $('authStatus').style.color = 'var(--unread)';
    $('authStatus').textContent = 'Wachtwoord gewijzigd. Je kunt nu inloggen.';
  } catch (err) {
    $('resetStatus').textContent = err.message || 'Er ging iets mis.';
  }
});

$('btnLogout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
});

async function onLogin(user) {
  currentUser = user;
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  showView('view-home');
  await refetchMagazines();

  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel('magazines-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'magazines', filter: `user_id=eq.${user.id}` }, () => {
      refetchMagazines();
    })
    .subscribe();
}

function onLogout() {
  currentUser = null;
  magazines = [];
  if (realtimeChannel) { supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  $('appScreen').classList.add('hidden');
  $('authScreen').classList.remove('hidden');
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    $('appScreen').classList.add('hidden');
    $('authScreen').classList.remove('hidden');
    showAuthCard('resetPasswordForm');
    return;
  }
  if (session && session.user) onLogin(session.user);
  else onLogout();
});

supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session && data.session.user) onLogin(data.session.user);
});
