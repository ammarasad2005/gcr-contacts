/**
 * emailResolver.js
 * 4-step email resolution pipeline for people in the GCR Teachers list.
 *
 * Steps (in order, stops at first success):
 *   1. Direct GCR email (from profile.emailAddress)
 *   2. Roll number embedded in display name
 *   3. Fuzzy name match against faculty_data.json
 *   4. Google People API directory search
 */

'use strict';

import { isStudentEmail, extractRollFromName, campusFromEmail } from './studentRegex.js';
import { findFacultyByName, findFacultyByEmail } from './facultyCache.js';

/**
 * @typedef {Object} ResolvedPerson
 * @property {string}       userId
 * @property {string}       displayName
 * @property {string|null}  photoUrl
 * @property {string|null}  email
 * @property {'instructor'|'ta'|'lab_instructor'|'ld'} role
 * @property {'gcr'|'rollNumber'|'facultyJson'|'directory'|'notFound'} source
 * @property {string|null}  linkedin
 * @property {string|null}  office
 * @property {string|null}  status      - faculty title e.g. "Assistant Professor"
 * @property {string|null}  facultyImageUrl
 */

/**
 * Resolve a single person from the GCR Teachers list.
 *
 * @param {Object} teacher        - raw Classroom API teacher object
 * @param {boolean} isLabCourse   - true if course name contains 'lab' (case-insensitive)
 * @param {string}  accessToken   - valid Google OAuth access token
 * @param {string}  userCampus    - campus subdomain of the signed-in user e.g. 'isb'
 * @returns {Promise<ResolvedPerson>}
 */
export async function resolvePerson(teacher, isLabCourse, accessToken, userCampus) {
  const profile     = teacher.profile || {};
  const displayName = profile.name?.fullName || profile.name || 'Unknown';
  const photoUrl    = profile.photoUrl
    ? profile.photoUrl.replace(/^http:/, 'https:')
    : null;
  const gcrEmail    = profile.emailAddress || null;

  // ── Step 1: Direct GCR email ─────────────────────────────────────
  if (gcrEmail) {
    const studentEmail = isStudentEmail(gcrEmail);
    const role = deriveRole(studentEmail, isLabCourse);

    // Even if we have an email, enrich with faculty JSON if it's a faculty member
    let linkedin = null, office = null, status = null, facultyImageUrl = null;
    if (!studentEmail) {
      const fac = await findFacultyByEmail(gcrEmail);
      if (fac) {
        linkedin       = fac.linkedin_profile || null;
        office         = fac.office_room      || null;
        status         = fac.status           || null;
        facultyImageUrl = fac.image_url       || null;
      }
    }

    return {
      userId: teacher.userId,
      displayName,
      photoUrl,
      email: gcrEmail,
      role,
      source: 'gcr',
      linkedin,
      office,
      status,
      facultyImageUrl,
    };
  }

  // ── Step 2: Roll number in display name ──────────────────────────
  const rollResult = extractRollFromName(displayName, userCampus);
  if (rollResult) {
    const role = deriveRole(true, isLabCourse);
    return {
      userId: teacher.userId,
      displayName,
      photoUrl,
      email: rollResult.email,
      role,
      source: 'rollNumber',
      linkedin: null,
      office: null,
      status: null,
      facultyImageUrl: null,
    };
  }

  // ── Step 3: faculty_data.json fuzzy match ────────────────────────
  const fac = await findFacultyByName(displayName);
  if (fac) {
    const role = deriveRole(false, isLabCourse);
    return {
      userId: teacher.userId,
      displayName,
      photoUrl,
      email: fac.email || null,
      role,
      source: 'facultyJson',
      linkedin:        fac.linkedin_profile || null,
      office:          fac.office_room      || null,
      status:          fac.status           || null,
      facultyImageUrl: fac.image_url        || null,
    };
  }

  // ── Step 4: Google People API (Workspace directory) ──────────────
  try {
    const dirResult = await searchDirectory(displayName, accessToken);
    if (dirResult) {
      const dirEmail   = dirResult.email;
      const isStudent  = isStudentEmail(dirEmail);
      const role       = deriveRole(isStudent, isLabCourse);

      // Enrich faculty members from faculty JSON using found email
      let linkedin = null, office = null, status = null, facultyImageUrl = null;
      if (!isStudent && dirEmail) {
        const facByEmail = await findFacultyByEmail(dirEmail);
        if (facByEmail) {
          linkedin       = facByEmail.linkedin_profile || null;
          office         = facByEmail.office_room      || null;
          status         = facByEmail.status           || null;
          facultyImageUrl = facByEmail.image_url       || null;
        }
      }

      return {
        userId: teacher.userId,
        displayName,
        photoUrl,
        email: dirEmail,
        role,
        source: 'directory',
        linkedin,
        office,
        status,
        facultyImageUrl,
      };
    }
  } catch {
    // Directory lookup failed silently — fall through to notFound
  }

  // ── Not found ────────────────────────────────────────────────────
  return {
    userId: teacher.userId,
    displayName,
    photoUrl,
    email: null,
    role: isLabCourse ? 'ld' : 'ta', // default to TA/LD when unknown
    source: 'notFound',
    linkedin: null,
    office: null,
    status: null,
    facultyImageUrl: null,
  };
}

/**
 * Resolve all teachers for a course in parallel.
 *
 * @param {Array}   teachers
 * @param {string}  courseName
 * @param {string}  accessToken
 * @param {string}  userCampus
 * @returns {Promise<ResolvedPerson[]>}
 */
export async function resolveTeachers(teachers, courseName, accessToken, userCampus) {
  const isLab = /lab/i.test(courseName || '');
  return Promise.all(
    teachers.map((t) => resolvePerson(t, isLab, accessToken, userCampus))
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

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

  // Take the first result's primary email
  const person = people[0];
  const email  = person.emailAddresses?.[0]?.value || null;
  return email ? { email } : null;
}
