/**
 * semesterFilter.js
 * Determines whether a Google Classroom course belongs to the current semester.
 *
 * SEMESTER_START is read from the NEXT_PUBLIC_SEMESTER_START env variable (YYYY-MM-DD).
 * A ± MARGIN_DAYS window is applied around the semester start date.
 * Comparison is made against the course's `creationTime` field.
 */

'use strict';

const MARGIN_DAYS = 7;
const MARGIN_MS   = MARGIN_DAYS * 24 * 60 * 60 * 1000;

/**
 * Returns the configured semester start as a Date object.
 * Falls back to a safe default if the env var is missing.
 */
export function getSemesterStart() {
  const raw = process.env.NEXT_PUBLIC_SEMESTER_START || '2025-02-03';
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    console.warn('[semesterFilter] Invalid NEXT_PUBLIC_SEMESTER_START, using 2025-02-03');
    return new Date('2025-02-03');
  }
  return d;
}

/**
 * Returns true if the course's creation time falls within ± MARGIN_DAYS
 * of the configured semester start date.
 *
 * @param {Object} course - Google Classroom course object
 * @param {string} course.creationTime - ISO 8601 timestamp
 */
export function isCurrentSemester(course) {
  if (!course?.creationTime) return false;
  const created     = new Date(course.creationTime);
  const semStart    = getSemesterStart();
  const diff        = Math.abs(created.getTime() - semStart.getTime());
  return diff <= MARGIN_MS;
}

/**
 * Filter a list of courses to only those matching the current semester.
 *
 * @param {Array} courses - Array of Classroom API course objects
 * @returns {Array}
 */
export function filterCurrentSemester(courses) {
  return (courses || []).filter(isCurrentSemester);
}
