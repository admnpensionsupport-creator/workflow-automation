/**
 * SOURCE: Pipedrive CRM API client
 * Wraps the Pipedrive REST v1 API for persons, organizations, notes, and labels.
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE = 'https://api.pipedrive.com/v1';

function getApiToken() {
  const raw = process.env.PIPEDRIVE_API_KEY;
  if (!raw) throw new Error('Missing PIPEDRIVE_API_KEY in .env');
  const match = raw.match(/[a-f0-9]{40}/);
  return match ? match[0] : raw.trim();
}

async function request(method, path, body) {
  const token = getApiToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}api_token=${token}`;

  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const json = await res.json();

  if (!json.success) {
    const msg = json.error || JSON.stringify(json);
    throw new Error(`Pipedrive ${method} ${path} failed: ${msg}`);
  }
  return json;
}

// ─── Persons ────────────────────────────────────────

export async function searchPersons(term) {
  const encoded = encodeURIComponent(term);
  return request('GET', `/persons/search?term=${encoded}&fields=email,name,phone&limit=5`);
}

export async function getAllPersons() {
  let all = [];
  let start = 0;
  const limit = 500;

  while (true) {
    const res = await request('GET', `/persons?start=${start}&limit=${limit}`);
    if (res.data) all = all.concat(res.data);
    if (!res.additional_data?.pagination?.more_items_in_collection) break;
    start += limit;
  }
  return all;
}

export async function addPerson(data) {
  return request('POST', '/persons', data);
}

export async function updatePerson(id, data) {
  return request('PUT', `/persons/${id}`, data);
}

// ─── Organizations ──────────────────────────────────

export async function searchOrganizations(term) {
  const encoded = encodeURIComponent(term);
  return request('GET', `/organizations/search?term=${encoded}&limit=5`);
}

export async function addOrganization(data) {
  return request('POST', '/organizations', data);
}

export async function updateOrganization(id, data) {
  return request('PUT', `/organizations/${id}`, data);
}

// ─── Notes ──────────────────────────────────────────

export async function addNote(data) {
  return request('POST', '/notes', data);
}

export async function getPersonNotes(personId) {
  return request('GET', `/persons/${personId}/notes?start=0&limit=100`);
}

// ─── Labels ─────────────────────────────────────────

export async function getPersonLabels() {
  const res = await request('GET', '/personFields/26');
  return res.data?.options || [];
}

export async function addPersonLabel(label) {
  const existing = await getPersonLabels();
  const found = existing.find(
    (o) => o.label.toLowerCase() === label.toLowerCase(),
  );
  if (found) return found.id;

  const options = [...existing, { label }];
  const res = await request('PUT', '/personFields/26', { options });
  const updated = res.data?.options || [];
  const created = updated.find(
    (o) => o.label.toLowerCase() === label.toLowerCase(),
  );
  return created ? created.id : null;
}

// ─── Field keys (custom) ────────────────────────────
// Job Title custom field hash (from personFields listing)
export const JOB_TITLE_KEY = '79c3efdd391500d1f7e9aa83bb1eb250c39f5159';

// ─── Standalone test ────────────────────────────────
if (process.argv[1]?.endsWith('pipedrive-api.js')) {
  (async () => {
    try {
      const labels = await getPersonLabels();
      console.log('Person labels:', labels);
      const persons = await getAllPersons();
      console.log(`Total persons: ${persons.length}`);
      if (persons.length > 0) {
        const p = persons[0];
        console.log('Sample:', { name: p.name, email: p.email, phone: p.phone });
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
  })();
}
