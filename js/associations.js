// ── Data stores ──────────────────────────────────────────────────────────────
let contacts  = {};   // id → record
let companies = {};   // id → record
let deals     = {};   // id → record
let stageMap  = {};   // stageId → label

// Association maps
let companyContacts = {};  // companyId → Set<contactId>
let dealContacts    = {};  // dealId    → Set<contactId>
let dealCompanies   = {};  // dealId    → Set<companyId>

// ── Display helpers ──────────────────────────────────────────────────────────
const contactName  = id => { const p = contacts[id]?.properties;  return p ? (`${p.firstname||''} ${p.lastname||''}`.trim() || p.email || id) : id; };
const companyName  = id => companies[id]?.properties?.name || id;
const dealLabel    = id => {
  const p = deals[id]?.properties;
  if (!p) return id;
  const stage  = stageMap[p.dealstage] || p.dealstage || '';
  const amount = p.amount ? ` · $${Number(p.amount).toLocaleString()}` : '';
  return `${p.dealname || 'Unnamed'}${amount}${stage ? ' · ' + stage : ''}`;
};

// ── Init ─────────────────────────────────────────────────────────────────────
async function initAssoc() {
  ACCESS_TOKEN = document.getElementById('token').value.trim();
  const statusEl = document.getElementById('tokenStatus');
  if (!ACCESS_TOKEN) {
    statusEl.textContent = 'Please enter a token.';
    statusEl.style.color = '#c0392b';
    return;
  }
  statusEl.textContent = '⏳ Loading...';
  statusEl.style.color = '#888';

  await Promise.all([ loadAllRecords(), loadStageMap() ]);
  await loadAllAssociations();

  renderTree();
  populateLinkDropdowns();

  statusEl.textContent = '✓ Loaded';
  statusEl.style.color = '#27ae60';
}

// ── Load all records (contacts, companies, deals) ────────────────────────────
async function loadAllRecords() {
  const [cr, cor, dr] = await Promise.all([
    hubspot('GET', 'contacts?limit=50&properties=firstname,lastname,email'),
    hubspot('GET', 'companies?limit=50&properties=name,domain'),
    hubspot('GET', 'deals?limit=50&properties=dealname,amount,dealstage'),
  ]);
  contacts  = {};
  companies = {};
  deals     = {};
  (cr?.data?.results  || []).forEach(r => { contacts[r.id]  = r; });
  (cor?.data?.results || []).forEach(r => { companies[r.id] = r; });
  (dr?.data?.results  || []).forEach(r => { deals[r.id]     = r; });
}

// ── Load deal stages ─────────────────────────────────────────────────────────
async function loadStageMap() {
  const res = await hubspotRaw('crm/v3/pipelines/deals');
  stageMap  = {};
  (res?.data?.results || []).forEach(pipeline => {
    (pipeline.stages || []).forEach(s => { stageMap[s.id] = s.label; });
  });
}

// ── Load all associations in parallel ────────────────────────────────────────
async function loadAllAssociations() {
  companyContacts = {};
  dealContacts    = {};
  dealCompanies   = {};

  const tasks = [];

  Object.keys(companies).forEach(id => {
    tasks.push(
      hubspot('GET', `companies/${id}/associations/contacts`).then(res => {
        const ids = (res?.data?.results || []).map(r => r.id);
        if (ids.length) companyContacts[id] = new Set(ids);
      })
    );
  });

  Object.keys(deals).forEach(id => {
    tasks.push(
      hubspot('GET', `deals/${id}/associations/contacts`).then(res => {
        const ids = (res?.data?.results || []).map(r => r.id);
        if (ids.length) dealContacts[id] = new Set(ids);
      }),
      hubspot('GET', `deals/${id}/associations/companies`).then(res => {
        const ids = (res?.data?.results || []).map(r => r.id);
        if (ids.length) dealCompanies[id] = new Set(ids);
      })
    );
  });

  await Promise.all(tasks);
}

// ── Render tree ──────────────────────────────────────────────────────────────
function renderTree() {
  const container        = document.getElementById('tree-view');
  const renderedContacts = new Set();
  const renderedDeals    = new Set();
  let   html             = '';

  const node = (type, level, text, unlinked = false) =>
    `<div class="tree-node ${type}-node level-${level}${unlinked ? ' unlinked' : ''}">${text}</div>`;

  // ── Companies ──────────────────────────────────────────────────────────────
  Object.keys(companies)
    .sort((a, b) => companyName(a).localeCompare(companyName(b)))
    .forEach(coId => {
      html += node('company', 0, `🏢 ${companyName(coId)}`);

      const linkedContacts = companyContacts[coId] ? [...companyContacts[coId]] : [];
      linkedContacts.forEach(cId => {
        if (!contacts[cId]) return;
        renderedContacts.add(cId);
        html += node('contact', 1, `👤 ${contactName(cId)}`);
      });

      const linkedDeals = Object.keys(deals).filter(dId => dealCompanies[dId]?.has(coId));
      linkedDeals.forEach(dId => {
        renderedDeals.add(dId);
        html += node('deal', 1, `💰 ${dealLabel(dId)}`);
        (dealContacts[dId] ? [...dealContacts[dId]] : []).forEach(cId => {
          if (!contacts[cId]) return;
          renderedContacts.add(cId);
          html += node('contact', 2, `👤 ${contactName(cId)}`);
        });
      });

      if (!linkedContacts.length && !linkedDeals.length) {
        html += `<div class="tree-node empty-node level-1">— no linked contacts or deals</div>`;
      }
    });

  // ── Unlinked contacts ──────────────────────────────────────────────────────
  const unlinkedContacts = Object.keys(contacts).filter(id => !renderedContacts.has(id));
  if (unlinkedContacts.length) {
    html += `<div class="tree-section">Unlinked Contacts</div>`;
    unlinkedContacts.forEach(cId => {
      html += node('contact', 0, `👤 ${contactName(cId)}`, true);
    });
  }

  // ── Unlinked deals ─────────────────────────────────────────────────────────
  const unlinkedDeals = Object.keys(deals).filter(id => !renderedDeals.has(id));
  if (unlinkedDeals.length) {
    html += `<div class="tree-section">Unlinked Deals</div>`;
    unlinkedDeals.forEach(dId => {
      html += node('deal', 0, `💰 ${dealLabel(dId)}`, true);
      (dealContacts[dId] ? [...dealContacts[dId]] : []).forEach(cId => {
        if (!contacts[cId]) return;
        html += node('contact', 1, `👤 ${contactName(cId)}`);
      });
    });
  }

  container.innerHTML = html || '<p class="muted">No records found. Add some via the CRUD page first.</p>';
}

// ── Populate link dropdowns ───────────────────────────────────────────────────
function populateLinkDropdowns() {
  const fill = (id, records, labelFn) => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="" disabled selected>Select...</option>';
    Object.keys(records).forEach(rid => {
      const opt = document.createElement('option');
      opt.value       = rid;
      opt.textContent = labelFn(rid);
      sel.appendChild(opt);
    });
  };

  fill('lnk-contact',  contacts,  contactName);
  fill('lnk-company1', companies, companyName);
  fill('lnk-deal1',    deals,     dealLabel);
  fill('lnk-contact2', contacts,  contactName);
  fill('lnk-deal2',    deals,     dealLabel);
  fill('lnk-company2', companies, companyName);
}

// ── Link actions ──────────────────────────────────────────────────────────────
async function linkContactToCompany() {
  const cId  = document.getElementById('lnk-contact').value;
  const coId = document.getElementById('lnk-company1').value;
  if (!cId || !coId) return;
  await doLink(`contacts/${cId}/associations/companies/${coId}/contact_to_company`, 'link-result-1', 'Contact → Company');
}

async function linkDealToContact() {
  const dId = document.getElementById('lnk-deal1').value;
  const cId = document.getElementById('lnk-contact2').value;
  if (!dId || !cId) return;
  await doLink(`deals/${dId}/associations/contacts/${cId}/deal_to_contact`, 'link-result-2', 'Deal → Contact');
}

async function linkDealToCompany() {
  const dId  = document.getElementById('lnk-deal2').value;
  const coId = document.getElementById('lnk-company2').value;
  if (!dId || !coId) return;
  await doLink(`deals/${dId}/associations/companies/${coId}/deal_to_company`, 'link-result-3', 'Deal → Company');
}

async function doLink(path, resultId, label) {
  const res = await hubspot('PUT', path);
  const el  = document.getElementById(resultId);
  el.className   = 'result ' + (res?.ok ? 'success' : 'error');
  el.textContent = res?.ok
    ? `✓ ${label} linked successfully.`
    : JSON.stringify(res?.data, null, 2);

  if (res?.ok) {
    await loadAllAssociations();
    renderTree();
  }
}
