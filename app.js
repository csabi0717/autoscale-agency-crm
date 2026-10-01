const state = {
  clients: [],
  statuses: [],
  searchTerm: '',
  statusFilter: 'all',
};

const el = (id) => document.getElementById(id);

async function loadStatuses() {
  const res = await fetch('/api/statuses');
  state.statuses = await res.json();

  const filterSelect = el('statusFilter');
  const formSelect = el('status');
  state.statuses.forEach(s => {
    const opt1 = document.createElement('option');
    opt1.value = s; opt1.textContent = s;
    filterSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = s; opt2.textContent = s;
    formSelect.appendChild(opt2);
  });
}

async function loadClients() {
  const params = new URLSearchParams();
  if (state.searchTerm) params.set('q', state.searchTerm);
  if (state.statusFilter !== 'all') params.set('status', state.statusFilter);
  const res = await fetch('/api/clients?' + params.toString());
  state.clients = await res.json();
  renderTable();
}

function renderTable() {
  const body = el('clientsBody');
  const empty = el('emptyState');
  body.innerHTML = '';

  if (state.clients.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.clients.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Vállalkozás" class="company-cell">${escapeHtml(c.company_name)}</td>
      <td data-label="Kapcsolattartó">${escapeHtml(c.contact_name || '—')}</td>
      <td data-label="Email">${escapeHtml(c.email || '—')}</td>
      <td data-label="Telefon">${escapeHtml(c.phone || '—')}</td>
      <td data-label="Niche">${escapeHtml(c.niche || '—')}</td>
      <td data-label="Szolgáltatás">${escapeHtml(c.service || '—')}</td>
      <td data-label="Státusz"><span class="status-badge">${escapeHtml(c.status)}</span></td>
      <td></td>
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
  el('status').value = client ? client.status : state.statuses[0];
  el('notes').value = client ? client.notes || '' : '';
}

function closeModal() {
  el('modalOverlay').classList.remove('open');
}

async function handleSubmit(e) {
  e.preventDefault();
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

  if (id) {
    await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  closeModal();
  loadClients();
}

async function handleDelete() {
  const id = el('clientId').value;
  if (!id) return;
  if (!confirm('Biztosan törlöd ezt az ügyfelet?')) return;
  await fetch(`/api/clients/${id}`, { method: 'DELETE' });
  closeModal();
  loadClients();
}

let searchTimeout;
function handleSearchInput(e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.searchTerm = e.target.value;
    loadClients();
  }, 250);
}

function init() {
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

  loadStatuses().then(loadClients);
}

init();
