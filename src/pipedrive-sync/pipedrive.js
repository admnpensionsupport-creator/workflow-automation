/**
 * Pipedrive REST API client.
 *
 * Handles persons, labels, and notes for the Google Sheets → Pipedrive sync.
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE = 'https://api.pipedrive.com/v1';

function getApiToken() {
  const raw = process.env.PIPEDRIVE_API_KEY || '';
  // Handle env values that may include a prefix like "Here's the API Key : <key>"
  const token = raw.includes(':') ? raw.split(':').pop().trim() : raw.trim();
  if (!token) throw new Error('Missing PIPEDRIVE_API_KEY in environment');
  return token;
}

async function request(path, { method = 'GET', body, query = {} } = {}) {
  const token = getApiToken();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_token', token);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url.toString(), opts);
  const json = await res.json();
  if (!json.success) {
    const msg = json.error || JSON.stringify(json);
    throw new Error(`Pipedrive ${method} ${path} failed: ${msg}`);
  }
  return json;
}

// ── Labels ──────────────────────────────────────────────

const LABEL_FIELD_ID = 2; // built-in "Label" enum field on persons

/**
 * Fetch all existing person-label options.
 * Returns Map<lowercase_label, id>.
 */
export async function getPersonLabelOptions() {
  const json = await request(`/personFields/${LABEL_FIELD_ID}`);
  const options = json.data?.options || [];
  const map = new Map();
  for (const o of options) {
    map.set(o.label.toLowerCase(), o.id);
  }
  return map;
}

/**
 * Create a new person-label option.  Returns the new option id.
 */
async function createLabelOption(label, color = '#b0b0b0') {
  // Pipedrive expects a PUT with the full options array to add one
  // But we can also use the dedicated label endpoint if available.
  // Simplest: update the field's options list via PUT /personFields/:id
  const json = await request(`/personFields/${LABEL_FIELD_ID}`);
  const existing = json.data?.options || [];
  existing.push({ label });
  const updated = await request(`/personFields/${LABEL_FIELD_ID}`, {
    method: 'PUT',
    body: { options: existing },
  });
  // Return the id of the newly-created option
  const newOptions = updated.data?.options || [];
  const created = newOptions.find(
    (o) => o.label.toLowerCase() === label.toLowerCase()
  );
  return created?.id ?? null;
}

/**
 * Ensure the given tag names exist as person-label options.
 * Returns Map<lowercase_tag, option_id>.
 */
export async function ensureLabels(tags) {
  const existing = await getPersonLabelOptions();
  for (const tag of tags) {
    if (!existing.has(tag.toLowerCase())) {
      console.log(`  Creating Pipedrive label: "${tag}"`);
      const id = await createLabelOption(tag);
      if (id) existing.set(tag.toLowerCase(), id);
    }
  }
  return existing;
}

// ── Persons ─────────────────────────────────────────────

/**
 * Search for an existing person by email.
 * Returns the first matching person object or null.
 */
export async function findPersonByEmail(email) {
  if (!email) return null;
  const json = await request('/persons/search', {
    query: { term: email, fields: 'email', limit: '1' },
  });
  const items = json.data?.items || [];
  if (items.length === 0) return null;
  return items[0].item;
}

/**
 * Create a new person. Returns the full person object.
 */
export async function createPerson(data) {
  const json = await request('/persons', { method: 'POST', body: data });
  return json.data;
}

/**
 * Update an existing person by id. Returns updated person.
 */
export async function updatePerson(id, data) {
  const json = await request(`/persons/${id}`, { method: 'PUT', body: data });
  return json.data;
}

/**
 * Add a note to a person.
 */
export async function addNote(personId, content) {
  if (!content) return;
  const json = await request('/notes', {
    method: 'POST',
    body: { content, person_id: personId, pinned_to_person_flag: 1 },
  });
  return json.data;
}

/**
 * Fetch all notes for a person.
 */
export async function getPersonNotes(personId) {
  const json = await request(`/persons/${personId}/notes`, {
    query: { limit: '50' },
  });
  return json.data || [];
}

// ── Activities ──────────────────────────────────────────

/**
 * Fetch call activities for a person.
 * Returns array of call activity objects sorted by add_time desc.
 */
export async function getPersonCallActivities(personId) {
  const json = await request(`/persons/${personId}/activities`, {
    query: { limit: '50', done: '1' },
  });
  const activities = json.data || [];
  return activities.filter((a) => a.type === 'call');
}
