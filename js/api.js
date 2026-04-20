// ── Config ─────────────────────────────────────────────────────────────────
const PROXY = 'https://corsproxy.io/?';
const BASE  = 'https://api.hubapi.com/crm/v3/objects/';

let ACCESS_TOKEN = '';

// ── Token ───────────────────────────────────────────────────────────────────
function saveToken() {
  ACCESS_TOKEN = document.getElementById('token').value.trim();
  document.getElementById('tokenStatus').textContent = ACCESS_TOKEN
    ? '✓ Token saved for this session'
    : '';
}

// ── Core HubSpot API helper ─────────────────────────────────────────────────
async function hubspot(method, path, body) {
  if (!ACCESS_TOKEN) {
    alert('Please enter your Access Token first.');
    return null;
  }

  const url  = PROXY + encodeURIComponent(BASE + path);
  const opts = {
    method,
    headers: {
      'Authorization': 'Bearer ' + ACCESS_TOKEN,
      'Content-Type':  'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(url, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, data: { message: err.message } };
  }
}
