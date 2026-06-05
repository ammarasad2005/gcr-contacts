/**
 * facultyCache.js
 * Fetches, caches, and searches the NU faculty data JSON.
 *
 * Source: https://raw.githubusercontent.com/ammarasad2005/Exam-Table/main/public/data/faculty/faculty_data.json
 *
 * Schema per faculty entry:
 *   { name, email, status, office_room, linkedin_profile, profile_url, image_url }
 */

'use strict';

const FACULTY_JSON_URL =
  'https://raw.githubusercontent.com/ammarasad2005/Exam-Table/main/public/data/faculty/faculty_data.json';

// Module-level flat cache — survives across calls within the same session
let _cachedFaculty = null;

/**
 * Load and flatten faculty data into a single array.
 * Returns cached result if already loaded.
 * @returns {Promise<Array>}
 */
export async function getFacultyList() {
  if (_cachedFaculty) return _cachedFaculty;

  const res = await fetch(FACULTY_JSON_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error('Failed to fetch faculty data');

  const departments = await res.json();
  const flat = [];
  for (const dept of departments) {
    for (const member of dept.faculty || []) {
      flat.push({ ...member, department: dept.department });
    }
  }
  _cachedFaculty = flat;
  return flat;
}

// Honorifics to strip before comparing
const HONORIFICS = /^(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|engr\.?|hod\.?)\s+/gi;

/**
 * Normalize a name for comparison:
 * - strip honorifics
 * - lowercase
 * - remove extra punctuation/spaces
 */
function normalizeName(name) {
  return (name || '')
    .replace(HONORIFICS, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lenient name matching:
 * 1. Exact normalized match
 * 2. All tokens of the shorter name appear in the longer name (order-insensitive)
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];

  // Every token in the shorter name must appear in the longer name
  return shorter.every((tok) => longer.includes(tok));
}

/**
 * Find a faculty member by display name.
 * Returns the full faculty object or null.
 * @param {string} displayName
 * @returns {Promise<Object|null>}
 */
export async function findFacultyByName(displayName) {
  if (!displayName) return null;
  try {
    const list = await getFacultyList();
    return list.find((f) => namesMatch(f.name, displayName)) || null;
  } catch {
    return null;
  }
}

/**
 * Find a faculty member by their email address (exact, case-insensitive).
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function findFacultyByEmail(email) {
  if (!email) return null;
  try {
    const list = await getFacultyList();
    const lc = email.toLowerCase();
    return list.find((f) => (f.email || '').toLowerCase() === lc) || null;
  } catch {
    return null;
  }
}
