const state = {
  clients: [],
  statuses: [],
  searchTerm: '',
  statusFilter: 'all',
  requestId: 0,
};

const el = (id) => document.getElementById(id);

// Közös hívás a szerver felé. Ha a szerver hibát jelez, a hibaüzenetét adja tovább.
async function api(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error('Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Hiba történt (${res.status}). Próbáld újra.`);
  }
  return data;
}

// Hibaüzenet a lap tetején
function showError(message) {
  let banner = el('errorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'errorBanner';
    banner.className = 'error-banner';
    banner.setAttribute('role', 'alert');
    document.querySelector('main').prepend(banner);
  }
  banner.textContent = message || '';
  banner.style.display = message ? 'block' : 'none';
}

// Hibaüzenet az ügyfél-ablakban
function showFormError(message) {
  let box = el('formError');
  if (!box) {
    box = document.createElement('p');
    box.id = 'formError';
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    el('clientForm').querySelector('.modal-actions').before(box);
  }
  box.textContent = message || '';
  box.style.display = message ? 'block' : 'none';
}

// Ha az ablakot közben bezártad, a hibát a lap tetején mutatja
function reportFormError(message) {
  if (el('modalOverlay').classList.contains('open')) showFormError(message);
  else showError(message);
}

async function loadStatuses() {
  state.statuses = await api('/api/statuses');
  const filterSelect = el('statusFilter');
  const formSelect = el('status');
  state.statuses.forEach((s) => {
    filterSelect.appendChild(new Option(s, s));
    formSelect.appendChild(new Option(s, s));
  });
}

async function loadClients() {
  const requestId = ++state.requestId;
  const params = new URLSearchParams();
  if (state.searchTerm) params.set('q', state.searchTerm);
  if (state.statusFilter !== 'all') params.set('status', state.statusFilter);
  try {
    const clients = await api('/api/clients?' + params.toString());
    if (requestId !== state.requestId) return; // közben újabb keresés indult
    state.clients = Array.isArray(clients) ? clients : [];
    showError('');
    renderTable();
  } catch (err) {
    if (requestId !== state.requestId) return;
    showError(err.message);
  }
}

function renderTable() {
  const body = el('clientsBody');
  const empty = el('emptyState');
  body.innerHTML = '';

  if (state.clients.length === 0) {
    const filtered = state.searchTerm || state.statusFilter !== 'all';
    empty.textContent = filtered
      ? 'Nincs a keresésnek megfelelő ügyfél.'
      : 'Nincs még ügyfél felvéve. Kattints a "+ Új ügyfél" gombra.';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.clients.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Vállalkozás" class="company-cell">${escapeHtml(c.company_name)}</td>
      <td data-label="Kapcsolattartó">${escapeHtml(c.contact_name || '—')}</td>
      <td data-label="Email" class="email-cell">${escapeHtml(c.email || '—')}</td>
      <td data-label="Telefon" class="phone-cell">${escapeHtml(c.phone || '—')}</td>
      <td data-label="Niche">${escapeHtml(c.niche || '—')}</td>
      <td data-label="Szolgáltatás">${escapeHtml(c.service || '—')}</td>
      <td data-label="Státusz"><span class="status-badge">${escapeHtml(c.status)}</span></td>
    `;
    tr.addEventListener('click', () => openModal(c));
    body.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openModal(client = null) {
  showFormError('');
  el('modalOverlay').classList.add('open');
  el('modalTitle').textContent = client ? 'Ügyfél szerkesztése' : 'Új ügyfél';
  el('deleteBtn').style.display = client ? 'inline-block' : 'none';

  el('clientId').value = client ? client.id : '';
  el('company_name').value = client ? client.company_name : '';
  el('contact_name').value = client ? client.contact_name || '' : '';
  el('email').value = client ? client.email || '' : '';
  el('phone').value = client ? client.phone || '' : '';
  el('niche').value = client ? client.niche || '' : '';
  el('service').value = client ? client.service || '' : '';
  el('notes').value = client ? client.notes || '' : '';

  // Ha az ügyfél státusza már nem szerepel a listában (pl. átnevezted), ne vesszen el
  const statusSelect = el('status');
  statusSelect.querySelectorAll('option[data-legacy]').forEach((o) => o.remove());
  const status = client ? client.status : state.statuses[0];
  if (status && !state.statuses.includes(status)) {
    const opt = new Option(status, status);
    opt.dataset.legacy = '1';
    statusSelect.appendChild(opt);
  }
  statusSelect.value = status || '';
}

function closeModal() {
  el('modalOverlay').classList.remove('open');
}

async function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = el('clientForm').querySelector('button[type="submit"]');
  if (submitBtn.disabled) return; // már folyamatban van egy mentés

  const id = el('clientId').value;
  const payload = {
    company_name: el('company_name').value,
    contact_name: el('contact_name').value,
    email: el('email').value,
    phone: el('phone').value,
    niche: el('niche').value,
    service: el('service').value,
    status: el('status').value,
    notes: el('notes').value,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mentés...';
  showFormError('');
  try {
    await api(id ? `/api/clients/${id}` : '/api/clients', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    closeModal();
    loadClients();
  } catch (err) {
    reportFormError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Mentés';
  }
}

async function handleDelete() {
  const id = el('clientId').value;
  if (!id) return;
  if (!confirm('Biztosan törlöd ezt az ügyfelet?')) return;
  try {
    await api(`/api/clients/${id}`, { method: 'DELETE' });
    closeModal();
    loadClients();
  } catch (err) {
    reportFormError(err.message);
  }
}

let searchTimeout;
function handleSearchInput(e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.searchTerm = e.target.value.trim();
    loadClients();
  }, 250);
}

async function init() {
  el('newClientBtn').addEventListener('click', () => openModal());
  el('closeModalBtn').addEventListener('click', closeModal);
  el('cancelBtn').addEventListener('click', closeModal);
  el('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  el('clientForm').addEventListener('submit', handleSubmit);
  el('deleteBtn').addEventListener('click', handleDelete);
  el('searchInput').addEventListener('input', handleSearchInput);
  el('statusFilter').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    loadClients();
  });

  try {
    await loadStatuses();
  } catch (err) {
    showError(err.message);
  }
  await loadClients();
}

init();
