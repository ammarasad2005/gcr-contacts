/**
 * taSheet.js
 * Fetches, parses, caches, and queries the official NU FAST Islamabad
 * TA/LD allocation Google Sheet (Spring 2026, School of Computing, ISB).
 *
 * Sheet URL (read-only, no auth needed via gviz):
 * https://docs.google.com/spreadsheets/d/123tAXm_a0HQ_DMcVeS8P18GhSBUyXskfiLY6_SkOJA8
 * GID: 1821072731
 */

'use strict';

const TA_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/123tAXm_a0HQ_DMcVeS8P18GhSBUyXskfiLY6_SkOJA8/gviz/tq?tqx=out:csv&sheet=TASheet';

const LD_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/123tAXm_a0HQ_DMcVeS8P18GhSBUyXskfiLY6_SkOJA8/gviz/tq?tqx=out:csv&sheet=LDSheet';

const LS_KEY_TA_SHEET = 'gcrc_ta_sheet';

// ── Cache helpers (localStorage) ─────────────────────────────────────

export function getTaSheetCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY_TA_SHEET);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setTaSheetCache(rows) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY_TA_SHEET, JSON.stringify(rows)); } catch {}
}

export function clearTaSheetCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_KEY_TA_SHEET);
}

// ── Fetch & Parse ─────────────────────────────────────────────────────

/**
 * Fetches and parses both TASheet and LDSheet, merging into one unified array.
 * Returns cached data if available.
 * @returns {Promise<TaSheetRow[]>}
 */
export async function fetchTaSheet() {
  const cached = getTaSheetCache();
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;

  // Fetch both sheets in parallel
  const [taRes, ldRes] = await Promise.all([
    fetch(TA_SHEET_URL),
    fetch(LD_SHEET_URL),
  ]);

  const results = [];

  if (taRes.ok) {
    const text = await taRes.text();
    results.push(...parseTaSheetCsv(text));
  }

  if (ldRes.ok) {
    const text = await ldRes.text();
    results.push(...parseLdSheetCsv(text));
  }

  if (!results.length) throw new Error('Failed to fetch TA/LD sheets');

  setTaSheetCache(results);
  return results;
}

/**
 * Parse the raw CSV text from gviz into structured TaSheetRow objects.
 * Handles forward-filling of merged cells (courseCode, courseName, creditHours).
 *
 * @param {string} csvText
 * @returns {TaSheetRow[]}
 *
 * @typedef {Object} TaSheetRow
 * @property {string} courseCode        e.g. "CS-2005"
 * @property {string} courseName        e.g. "Database Systems (CS)"
 * @property {string} section           e.g. "BCS-4A"
 * @property {string} courseInstructor  e.g. "Dr. Ejaz Ahmed"
 * @property {string} taName            e.g. "Hassan Rizwan" or "---"
 * @property {string} taRoll            e.g. "22i-0976" or ""
 * @property {string} taEmail           e.g. "i220976@nu.edu.pk" or "---"
 * @property {string} verified          e.g. "Verified" or ""
 */
function parseTaSheetCsv(csvText) {
  const lines = csvText.trim().split('\n');
  // Skip header row (index 0)
  const dataLines = lines.slice(1);

  const rows = [];
  let lastCourseCode = '';
  let lastCourseName = '';

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (!cols || cols.length < 10) continue;

    // Columns: [0]#, [1]Code, [2]CourseName, [3]CHs, [4]Section,
    //          [5]Instructor, [6]Strength, [7]TAName, [8]TARoll, [9]Email,
    //          [10]Verified, [11]NumAllocations

    const rawCode = clean(cols[1]);
    const rawName = clean(cols[2]);

    // Forward-fill merged cells
    if (rawCode) lastCourseCode = rawCode;
    if (rawName) lastCourseName = rawName;

    const section         = clean(cols[4]);
    const courseInstructor = clean(cols[5]);
    const taName          = clean(cols[7]);
    const taRoll          = clean(cols[8]);
    const taEmail         = clean(cols[9]);
    const verified        = clean(cols[10]);

    // Skip rows with no section (malformed / header continuation)
    if (!section || !courseInstructor) continue;

    rows.push({
      courseCode:        lastCourseCode,
      courseName:        lastCourseName,
      section,
      courseInstructor,
      taName:            taName  || '---',
      taRoll:            taRoll  || '',
      taEmail:           taEmail || '---',
      verified,
    });
  }

  return rows;
}

/**
 * Parse the LDSheet CSV.
 * Unlike TASheet, LDSheet has NO merged cells — every row is fully populated.
 *
 * Columns: [0]#, [1]Code, [2]LabName, [3]Section, [4]LabInstructor,
 *          [5]InstructorEmail, [6]Strength, [7]LDName, [8]LDRoll,
 *          [9]LDEmail, [10]AllocationCount, [11]Confirmed, [12]Verified, ...
 *
 * @param {string} csvText
 * @returns {TaSheetRow[]}
 */
function parseLdSheetCsv(csvText) {
  const lines = csvText.trim().split('\n');
  const dataLines = lines.slice(1); // Skip header

  const rows = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (!cols || cols.length < 10) continue;

    const courseCode       = clean(cols[1]);
    const courseName       = clean(cols[2]);
    const section          = clean(cols[3]);
    const courseInstructor = clean(cols[4]);
    const ldName           = clean(cols[7]);
    const ldRoll           = clean(cols[8]);
    const ldEmail          = clean(cols[9]);
    const verified         = clean(cols[12]) || '';

    if (!section || !courseInstructor) continue;
    if (!courseCode && !courseName) continue;

    rows.push({
      courseCode,
      courseName,
      section,
      courseInstructor,
      taName:    ldName  || '---',
      taRoll:    ldRoll  || '',
      taEmail:   ldEmail || '---',
      verified,
      sheetType: 'LD',
    });
  }

  return rows;
}

/**
 * Minimal CSV line parser that handles quoted fields (including commas inside quotes).
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function clean(s) {
  return (s || '').trim().replace(/^"|"$/g, '').trim();
}

// ── Name Similarity ───────────────────────────────────────────────────

const HONORIFICS_RE = /\b(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|engr\.?|vf|visiting)\b\.?/gi;

function normalizeName(name) {
  return (name || '')
    .replace(HONORIFICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a similarity score [0, 1] between two instructor name strings.
 * Uses token overlap (order-insensitive) after stripping honorifics.
 */
function similarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (!shorter.length) return 0;

  const matchCount = shorter.filter((tok) => longer.includes(tok)).length;
  return matchCount / shorter.length;
}

const CONFIDENCE_THRESHOLD = 0.6;

// ── Course Matching ───────────────────────────────────────────────────

/**
 * Given a GCR course's teacher display names, find the best-matching
 * course group in the TA sheet and return the relevant TA rows.
 *
 * Matching algorithm:
 *   Pass 1: Find the course group (courseCode+courseName) with the highest
 *           instructor-name similarity to the GCR teachers.
 *   Pass 2: Within that group, keep only rows whose individual courseInstructor
 *           matches at least one GCR teacher above the threshold.
 *           This correctly separates multi-batch offerings of the same course
 *           (e.g. AI-2002 offered to both 4th and 6th semester students).
 *
 * @param {string[]} gcrTeacherNames   display names of GCR teachers
 * @param {TaSheetRow[]} sheetRows     full parsed sheet
 * @returns {TaSheetRow[]}             matched TA/LD rows (email ≠ '---' only)
 */
export function matchCourseInSheet(gcrTeacherNames, sheetRows) {
  if (!gcrTeacherNames?.length || !sheetRows?.length) return [];

  // ── Pass 1: find the best-matching course group ───────────────────
  // Group sheet rows by (courseCode + courseName)
  const groups = new Map();
  for (const row of sheetRows) {
    const key = `${row.courseCode}||${row.courseName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let bestScore = 0;
  let bestGroup = [];

  for (const [, groupRows] of groups) {
    // Max similarity across all (row.instructor × gcrTeacher) pairs in this group
    const groupScore = maxSimilarity(
      [...new Set(groupRows.map((r) => r.courseInstructor).filter(Boolean))],
      gcrTeacherNames,
    );

    if (groupScore > bestScore) {
      bestScore = groupScore;
      bestGroup = groupRows;
    }
  }

  if (bestScore < CONFIDENCE_THRESHOLD) return [];

  // ── Pass 2: within the best group, filter to rows whose instructor ────
  // individually matches at least one GCR teacher above the threshold.
  // This strips out rows from a different batch/semester that happened to
  // share the same courseCode+courseName (e.g. AI-2002 for 4th vs 6th sem).
  const matchedRows = bestGroup.filter((row) => {
    const rowScore = maxSimilarity([row.courseInstructor], gcrTeacherNames);
    return rowScore >= CONFIDENCE_THRESHOLD;
  });

  // Fall back to the full group if the per-row filter removed everything
  // (shouldn't happen but guards against edge cases)
  const finalRows = matchedRows.length > 0 ? matchedRows : bestGroup;

  // Return only rows that have a real TA/LD assigned
  return finalRows.filter((row) => row.taEmail && row.taEmail !== '---');
}

// ── Internal helper ──────────────────────────────────────────────────

/**
 * Returns the maximum pairwise similarity score between two name lists.
 * @param {string[]} namesA
 * @param {string[]} namesB
 * @returns {number} score in [0, 1]
 */
function maxSimilarity(namesA, namesB) {
  let best = 0;
  for (const a of namesA) {
    for (const b of namesB) {
      const s = similarity(a, b);
      if (s > best) best = s;
    }
  }
  return best;
}
