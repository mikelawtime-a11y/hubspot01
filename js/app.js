// ── Display result ──────────────────────────────────────────────────────────
function show(id, result) {
  if (!result) return;
  const el = document.getElementById(id);
  el.className = 'result ' + (result.ok ? 'success' : 'error');
  el.textContent = JSON.stringify(result.data, null, 2);
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
  show('result-create-deal', await hubspot('POST', 'deals', {
    properties: {
      dealname:  document.getElementById('d-name').value,
      amount:    document.getElementById('d-amount').value,
      dealstage: document.getElementById('d-stage').value,
    },
  }));
}
