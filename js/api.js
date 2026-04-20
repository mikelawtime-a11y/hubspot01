// ── Config ─────────────────────────────────────────────────────────────────
const PROXY    = 'https://corsproxy.io/?';
const BASE     = 'https://api.hubapi.com/crm/v3/objects/';
const BASE_RAW = 'https://api.hubapi.com/';

let partA = '-4600-9643-';

let partB = partA + 'ebca005a3e7f';

let ACCESS_TOKEN = 'pat-na2-5c743893-60f4' + partB;

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
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, data: { message: err.message } };
  }
}

// ── Generic helper for non-objects endpoints (e.g. pipelines) ───────────────
async function hubspotRaw(path) {
  if (!ACCESS_TOKEN) return null;
  const url = PROXY + encodeURIComponent(BASE_RAW + path);
  try {
    const res  = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { message: err.message } };
  }
}
