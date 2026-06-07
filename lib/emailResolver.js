/**
 * emailResolver.js
 * 5-step email resolution pipeline for people in the GCR Teachers list.
 *
 * Steps (in order, stops at first success for each person):
 *   0. TA Sheet lookup (NEW — foremost for TAs/LDs)
 *   1. Direct GCR email (from profile.emailAddress)
 *   2. Roll number embedded in display name
 *   3. Fuzzy name match against faculty_data.json
 *   4. Google People API directory search
 *
 * Additionally: TAs in the sheet who are NOT in the GCR Teachers list at all
 * are appended to the result so they still appear on the course card.
 */

'use strict';

import { isStudentEmail, extractRollFromName, campusFromEmail } from './studentRegex.js';
import { findFacultyByName, findFacultyByEmail }               from './facultyCache.js';
import { matchCourseInSheet }                                  from './taSheet.js';

/**
 * @typedef {Object} ResolvedPerson
 * @property {string}       userId
 * @property {string}       displayName
 * @property {string|null}  photoUrl
 * @property {string|null}  email
 * @property {'instructor'|'ta'|'lab_instructor'|'ld'} role
 * @property {'taSheet'|'gcr'|'rollNumber'|'facultyJson'|'directory'|'notFound'} source
 * @property {string|null}  section        — e.g. "BCS-4A", only from taSheet
 * @property {string|null}  linkedin
 * @property {string|null}  office
 * @property {string|null}  status
 * @property {string|null}  facultyImageUrl
 */

/**
 * Resolve all teachers for a course in parallel, then append any
 * sheet-only TAs (those not listed in GCR at all).
 *
 * @param {Object[]}      teachers       Raw Classroom API teacher objects
 * @param {string}        courseName     GCR course name
 * @param {string}        accessToken    Valid Google OAuth access token
 * @param {string}        userCampus     Campus subdomain of signed-in user e.g. 'isb'
 * @param {import('./taSheet').TaSheetRow[]} taSheetRows  Full parsed TA sheet
 * @returns {Promise<ResolvedPerson[]>}
 */
export async function resolveTeachers(teachers, courseName, accessToken, userCampus, taSheetRows = []) {
  const isLab = /lab/i.test(courseName || '');

  // ── Step 0: Match course against TA sheet ─────────────────────────
  // Get all sheet TA rows for this GCR course (confidence-based match)
  const gcrTeacherNames = teachers.map((t) =>
    t.profile?.name?.fullName || t.profile?.name || ''
  ).filter(Boolean);

  const sheetTaRows = matchCourseInSheet(gcrTeacherNames, taSheetRows);

  // Build a set of sheet TA emails for quick dedup later
  const sheetTaEmailSet = new Set(sheetTaRows.map((r) => r.taEmail.toLowerCase()));

  // ── Resolve each GCR teacher in parallel ─────────────────────────
  const resolvedFromGCR = await Promise.all(
    teachers.map((t) => resolvePerson(t, isLab, accessToken, userCampus, sheetTaRows))
  );

  // ── Inject sheet-only TAs (not in GCR Teachers list at all) ──────
  const resolvedEmails = new Set(
    resolvedFromGCR.map((p) => (p.email || '').toLowerCase()).filter(Boolean)
  );

  const sheetOnlyTAs = sheetTaRows
    .filter((row) => !resolvedEmails.has(row.taEmail.toLowerCase()))
    // Deduplicate by email (same TA can appear in multiple sections)
    .reduce((acc, row) => {
      const existing = acc.find((r) => r.taEmail === row.taEmail);
      if (existing) {
        // Merge sections: add badge to existing entry
        existing._sections = existing._sections || [existing.section];
        existing._sections.push(row.section);
      } else {
        acc.push({ ...row, _sections: [row.section] });
      }
      return acc;
    }, [])
    .map((row) => ({
      userId:         `sheet_${row.taRoll || row.taEmail}`,
      displayName:    row.taName,
      photoUrl:       null,
      email:          row.taEmail,
      role:           isLab ? 'ld' : 'ta',
      source:         'taSheet',
      section:        row._sections.length > 1
                        ? row._sections.join(', ')
                        : row._sections[0],
      linkedin:       null,
      office:         null,
      status:         null,
      facultyImageUrl: null,
    }));

  return [...resolvedFromGCR, ...sheetOnlyTAs];
}

/**
 * Resolve a single person from the GCR Teachers list.
 *
 * @param {Object}   teacher
 * @param {boolean}  isLabCourse
 * @param {string}   accessToken
 * @param {string}   userCampus
 * @param {import('./taSheet').TaSheetRow[]} sheetTaRows  Already-matched rows for this course
 * @returns {Promise<ResolvedPerson>}
 */
async function resolvePerson(teacher, isLabCourse, accessToken, userCampus, sheetTaRows) {
  const profile      = teacher.profile || {};
  const displayName  = profile.name?.fullName || profile.name || 'Unknown';
  const photoUrl     = profile.photoUrl
    ? profile.photoUrl.replace(/^http:/, 'https:')
    : null;
  const gcrEmail     = profile.emailAddress || null;

  // Quick pre-classification: is this person a student (TA/LD)?
  const looksLikeStudent =
    (gcrEmail && isStudentEmail(gcrEmail)) ||
    (!gcrEmail && !!extractRollFromName(displayName, userCampus));

  // ── Step 0: TA Sheet (runs for ALL GCR teachers — being in the sheet IS the proof) ──
  if (sheetTaRows.length > 0) {
    // Try matching by GCR email first, then by display name
    const matchedByEmail = gcrEmail
      ? sheetTaRows.find((r) => r.taEmail.toLowerCase() === gcrEmail.toLowerCase())
      : null;

    const matchedByName = !matchedByEmail
      ? sheetTaRows.find((r) => namesLooseMatch(r.taName, displayName))
      : null;

    const sheetMatch = matchedByEmail || matchedByName;

    if (sheetMatch) {
      // Collect all sections this TA appears in (within matched rows)
      const taEmailLc  = sheetMatch.taEmail.toLowerCase();
      const allSections = sheetTaRows
        .filter((r) => r.taEmail.toLowerCase() === taEmailLc)
        .map((r) => r.section);

      return {
        userId:         teacher.userId,
        displayName:    sheetMatch.taName || displayName,
        photoUrl,
        email:          sheetMatch.taEmail,
        role:           isLabCourse ? 'ld' : 'ta',
        source:         'taSheet',
        section:        allSections.join(', '),
        linkedin:       null,
        office:         null,
        status:         null,
        facultyImageUrl: null,
      };
    }
  }

  // ── Step 1: Direct GCR email ──────────────────────────────────────
  if (gcrEmail) {
    const studentEmail = isStudentEmail(gcrEmail);
    const role = deriveRole(studentEmail, isLabCourse);
    let linkedin = null, office = null, status = null, facultyImageUrl = null;

    if (!studentEmail) {
      const fac = await findFacultyByEmail(gcrEmail);
      if (fac) {
        linkedin        = fac.linkedin_profile || null;
        office          = fac.office_room      || null;
        status          = fac.status           || null;
        facultyImageUrl = fac.image_url        || null;
      }
    }

    return {
      userId: teacher.userId, displayName, photoUrl,
      email: gcrEmail, role, source: 'gcr', section: null,
      linkedin, office, status, facultyImageUrl,
    };
  }

  // ── Step 2: Roll number in display name ───────────────────────────
  const rollResult = extractRollFromName(displayName, userCampus);
  if (rollResult) {
    return {
      userId: teacher.userId, displayName, photoUrl,
      email: rollResult.email, role: deriveRole(true, isLabCourse),
      source: 'rollNumber', section: null,
      linkedin: null, office: null, status: null, facultyImageUrl: null,
    };
  }

  // ── Step 3: faculty_data.json fuzzy match ─────────────────────────
  const fac = await findFacultyByName(displayName);
  if (fac) {
    return {
      userId: teacher.userId, displayName, photoUrl,
      email:          fac.email           || null,
      role:           deriveRole(false, isLabCourse),
      source:         'facultyJson',
      section:        null,
      linkedin:       fac.linkedin_profile || null,
      office:         fac.office_room      || null,
      status:         fac.status           || null,
      facultyImageUrl: fac.image_url       || null,
    };
  }

  // ── Step 4: Google People API directory search ────────────────────
  try {
    const dirResult = await searchDirectory(displayName, accessToken);
    if (dirResult) {
      const isStudent = isStudentEmail(dirResult.email);
      let linkedin = null, office = null, status = null, facultyImageUrl = null;
      if (!isStudent && dirResult.email) {
        const facByEmail = await findFacultyByEmail(dirResult.email);
        if (facByEmail) {
          linkedin        = facByEmail.linkedin_profile || null;
          office          = facByEmail.office_room      || null;
          status          = facByEmail.status           || null;
          facultyImageUrl = facByEmail.image_url        || null;
        }
      }
      return {
        userId: teacher.userId, displayName, photoUrl,
        email: dirResult.email, role: deriveRole(isStudent, isLabCourse),
        source: 'directory', section: null,
        linkedin, office, status, facultyImageUrl,
      };
    }
  } catch { /* directory lookup failed silently */ }

  // ── Not found ─────────────────────────────────────────────────────
  return {
    userId: teacher.userId, displayName, photoUrl,
    email: null, role: isLabCourse ? 'ld' : 'ta',
    source: 'notFound', section: null,
    linkedin: null, office: null, status: null, facultyImageUrl: null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function deriveRole(isStudent, isLabCourse) {
  if (isLabCourse) return isStudent ? 'ld' : 'lab_instructor';
  return isStudent ? 'ta' : 'instructor';
}

async function searchDirectory(name, accessToken) {
  const url = new URL('https://people.googleapis.com/v1/people:searchDirectoryPeople');
  url.searchParams.set('query', name);
  url.searchParams.set('readMask', 'emailAddresses,names,photos');
  url.searchParams.set('sources', 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE');
  url.searchParams.set('pageSize', '5');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const people = data.people || [];
  if (!people.length) return null;
  const email = people[0].emailAddresses?.[0]?.value || null;
  return email ? { email } : null;
}

const HONORIFICS_NAME_RE = /\b(dr\.?|mr\.?|ms\.?|mrs\.?|prof\.?|engr\.?)\b\.?/gi;

function normalizeForMatch(name) {
  return (name || '')
    .replace(HONORIFICS_NAME_RE, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loose name match used to correlate a sheet TA name with a GCR display name.
 * True if at least one non-trivial token (length >= 3) matches.
 */
function namesLooseMatch(sheetName, gcrName) {
  const ns = normalizeForMatch(sheetName).split(' ').filter((t) => t.length >= 3);
  const ng = normalizeForMatch(gcrName).split(' ').filter((t) => t.length >= 3);
  return ns.some((tok) => ng.includes(tok));
}
