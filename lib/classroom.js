/**
 * classroom.js
 * Google Classroom API helpers.
 */

'use strict';

const BASE = 'https://classroom.googleapis.com/v1';

/**
 * Fetch all non-archived courses for the authenticated user.
 * @param {string} accessToken
 * @returns {Promise<Array>}
 */
export async function listCourses(accessToken) {
  const courses = [];
  let pageToken = null;

  do {
    const url = new URL(`${BASE}/courses`);
    url.searchParams.set('courseStates', 'ACTIVE');
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await apiFetch(url.toString(), accessToken);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to list courses');

    courses.push(...(data.courses || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return courses;
}

/**
 * Fetch the "Teachers" roster for a course.
 * Returns an array of { userId, profile: { name, emailAddress, photoUrl } }
 * @param {string} courseId
 * @param {string} accessToken
 * @returns {Promise<Array>}
 */
export async function getTeachers(courseId, accessToken) {
  const teachers = [];
  let pageToken = null;

  do {
    const url = new URL(`${BASE}/courses/${courseId}/teachers`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await apiFetch(url.toString(), accessToken);
    const data = await res.json();
    if (!res.ok) {
      // 403 = no roster access — return empty rather than crashing
      if (res.status === 403) return [];
      throw new Error(data.error?.message || 'Failed to list teachers');
    }

    teachers.push(...(data.teachers || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return teachers;
}

/**
 * Tiny helper — always sends Authorization header.
 */
function apiFetch(url, accessToken) {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
