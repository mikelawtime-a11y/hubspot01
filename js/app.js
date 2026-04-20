// ── Display result ──────────────────────────────────────────────────────────
function show(id, result) {
  if (!result) return;
  const el = document.getElementById(id);
  el.className = 'result ' + (result.ok ? 'success' : 'error');
  el.textContent = JSON.stringify(result.data, null, 2);
}

// ── Load real deal stages from this HubSpot account ────────────────────────
async function loadDealStages() {
  const select = document.getElementById('d-stage');
  const status = document.getElementById('stage-status');
  select.innerHTML = '<option disabled selected>Loading stages...</option>';
  status.textContent = '';

  const res = await hubspotRaw('crm/v3/pipelines/deals');
  if (!res || !res.ok) {
    select.innerHTML = '<option disabled selected>Failed to load stages</option>';
    const msg = res?.data?.message || JSON.stringify(res?.data) || 'Unknown error';
    status.textContent = 'Error: ' + msg;
    status.style.color = '#c0392b';
    return;
  }

  select.innerHTML = '';
  res.data.results.forEach(pipeline => {
    const group = document.createElement('optgroup');
    group.label = pipeline.label;
    pipeline.stages
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(stage => {
        const opt = document.createElement('option');
        opt.value = stage.id;
        opt.textContent = stage.label;
        group.appendChild(opt);
      });
    select.appendChild(group);
  });

  status.textContent = '✓ Stages loaded';
  status.style.color = '#27ae60';
}


// ── READ ────────────────────────────────────────────────────────────────────
async function getObjects(type) {
  const props = 'firstname,lastname,email,name,domain,dealname,amount,dealstage';
  show(`result-${type}`, await hubspot('GET', `${type}?limit=5&properties=${props}`));
}

// ── CREATE Contact ──────────────────────────────────────────────────────────
async function createContact() {
  show('result-create-contact', await hubspot('POST', 'contacts', {
    properties: {
      firstname: document.getElementById('c-firstname').value,
      lastname:  document.getElementById('c-lastname').value,
      email:     document.getElementById('c-email').value,
    },
  }));
}

// ── CREATE Company ──────────────────────────────────────────────────────────
async function createCompany() {
  show('result-create-company', await hubspot('POST', 'companies', {
    properties: {
      name:   document.getElementById('co-name').value,
      domain: document.getElementById('co-domain').value,
    },
  }));
}

// ── CREATE Deal ─────────────────────────────────────────────────────────────
async function createDeal() {
  const stageEl = document.getElementById('d-stage');
  if (!stageEl.value || stageEl.selectedOptions[0]?.disabled) {
    show('result-create-deal', { ok: false, data: { message: 'Please load deal stages first — save your token, then click Reload Stages.' } });
    return;
  }
  show('result-create-deal', await hubspot('POST', 'deals', {
    properties: {
      dealname:  document.getElementById('d-name').value,
      amount:    document.getElementById('d-amount').value,
      dealstage: stageEl.value,
    },
  }));
}
