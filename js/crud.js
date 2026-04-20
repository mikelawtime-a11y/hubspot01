// ── Schema: field definitions per object type ────────────────────────────────
const SCHEMA = {
  contacts:  { label: 'Contact', cols: ['firstname', 'lastname', 'email'] },
  companies: { label: 'Company', cols: ['name', 'domain'] },
  deals:     { label: 'Deal',    cols: ['dealname', 'amount', 'dealstage'] },
};

// In-memory record cache { type: { id: fullRecord } }
const CACHE = { contacts: {}, companies: {}, deals: {} };
let dealStageMap = {}; // { stageId → label }

// ── Init: save token + load all ──────────────────────────────────────────────
async function init() {
  ACCESS_TOKEN = document.getElementById('token').value.trim();
  const statusEl = document.getElementById('tokenStatus');
  if (!ACCESS_TOKEN) {
    statusEl.textContent = 'Please enter a token.';
    statusEl.style.color = '#c0392b';
    return;
  }
  statusEl.textContent = '✓ Saved';
  statusEl.style.color = '#27ae60';

  await loadStages();
  loadList('contacts');
  loadList('companies');
  loadList('deals');
}

// ── Deal stages ──────────────────────────────────────────────────────────────
async function loadStages() {
  const select = document.getElementById('deals-dealstage');
  const status = document.getElementById('stage-status');
  select.innerHTML = '<option disabled selected>Loading...</option>';

  const res = await hubspotRaw('crm/v3/pipelines/deals');
  if (!res || !res.ok) {
    select.innerHTML = '<option disabled selected>Failed to load stages</option>';
    status.textContent = 'Error: ' + (res?.data?.message || 'unknown');
    status.style.color = '#c0392b';
    return;
  }

  select.innerHTML = '';
  dealStageMap = {};
  res.data.results.forEach(pipeline => {
    const group = document.createElement('optgroup');
    group.label = pipeline.label;
    pipeline.stages
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(stage => {
        dealStageMap[stage.id] = stage.label;
        const opt = document.createElement('option');
        opt.value = stage.id;
        opt.textContent = stage.label;
        group.appendChild(opt);
      });
    select.appendChild(group);
  });

  status.textContent = '✓ Loaded';
  status.style.color = '#27ae60';
}

// ── Load & render list ───────────────────────────────────────────────────────
async function loadList(type) {
  const container = document.getElementById(`list-${type}`);
  container.innerHTML = '<p class="muted">Loading...</p>';

  const props = SCHEMA[type].cols.join(',');
  const res   = await hubspot('GET', `${type}?limit=20&properties=${props}`);

  if (!res || !res.ok) {
    container.innerHTML = `<span class="error">${res?.data?.message || 'Error loading records.'}</span>`;
    return;
  }

  const records = res.data.results;
  CACHE[type] = {};
  records.forEach(r => { CACHE[type][r.id] = r; });

  if (!records.length) {
    container.innerHTML = '<p class="muted">No records found.</p>';
    return;
  }

  const cols = SCHEMA[type].cols;
  let html = '<table><thead><tr><th>ID</th>';
  cols.forEach(col => { html += `<th>${col}</th>`; });
  html += '<th>Actions</th></tr></thead><tbody>';

  records.forEach(r => {
    html += `<tr><td class="id-cell">${r.id}</td>`;
    cols.forEach(col => {
      const val     = r.properties[col] ?? '';
      const display = (col === 'dealstage' && dealStageMap[val]) ? dealStageMap[val] : val;
      html += `<td>${display}</td>`;
    });
    html += `<td class="actions">
      ${r.url ? `<a class="btn-view" href="${r.url}" target="_blank">View</a>` : ''}
      <button class="btn-edit"   onclick="editRecord('${type}','${r.id}')">Edit</button>
      <button class="btn-delete" onclick="deleteRecord('${type}','${r.id}')">Delete</button>
    </td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ── Edit: fill form with existing data ───────────────────────────────────────
function editRecord(type, id) {
  const props = CACHE[type][id]?.properties || {};
  document.getElementById(`${type}-id`).value              = id;
  document.getElementById(`form-title-${type}`).textContent = `Update ${SCHEMA[type].label}`;
  document.getElementById(`cancel-${type}`).style.display  = 'inline-block';

  SCHEMA[type].cols.forEach(field => {
    const el = document.getElementById(`${type}-${field}`);
    if (el) el.value = props[field] ?? '';
  });

  document.getElementById(`form-title-${type}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Cancel: reset form to create mode ───────────────────────────────────────
function cancelEdit(type) {
  document.getElementById(`${type}-id`).value               = '';
  document.getElementById(`form-title-${type}`).textContent = `Create ${SCHEMA[type].label}`;
  document.getElementById(`cancel-${type}`).style.display   = 'none';
  SCHEMA[type].cols.forEach(field => {
    const el = document.getElementById(`${type}-${field}`);
    if (el) el.value = '';
  });
  showResult(type, null);
}

// ── Save: POST (create) or PATCH (update) ───────────────────────────────────
async function saveRecord(type) {
  const id = document.getElementById(`${type}-id`).value.trim();

  if (type === 'deals') {
    const stageEl = document.getElementById('deals-dealstage');
    if (!stageEl.value || stageEl.selectedOptions[0]?.disabled) {
      showResult(type, { ok: false, data: { message: 'Deal stages not loaded yet. Save your token first.' } });
      return;
    }
  }

  const properties = {};
  SCHEMA[type].cols.forEach(field => {
    const el = document.getElementById(`${type}-${field}`);
    if (el) properties[field] = el.value;
  });

  const method = id ? 'PATCH' : 'POST';
  const path   = id ? `${type}/${id}` : type;
  const res    = await hubspot(method, path, { properties });

  showResult(type, res);
  if (res?.ok) {
    cancelEdit(type);
    loadList(type);
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────
async function deleteRecord(type, id) {
  if (!confirm(`Delete this ${SCHEMA[type].label}? This cannot be undone.`)) return;

  const res     = await hubspot('DELETE', `${type}/${id}`);
  const success = res?.ok || res?.status === 204;

  showResult(type, success
    ? { ok: true,  data: { message: `${SCHEMA[type].label} deleted successfully.` } }
    : (res || { ok: false, data: { message: 'Unknown error.' } })
  );

  if (success) loadList(type);
}

// ── Show result ──────────────────────────────────────────────────────────────
function showResult(type, result) {
  const el = document.getElementById(`result-${type}`);
  if (!el) return;
  if (!result) { el.textContent = ''; el.className = 'result'; return; }
  el.className   = 'result ' + (result.ok ? 'success' : 'error');
  el.textContent = JSON.stringify(result.data, null, 2);
}
