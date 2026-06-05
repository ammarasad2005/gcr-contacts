/**
 * studentRegex.js
 * Roll number patterns and email reconstruction for NU students (TAs / LDs).
 */

'use strict';

// Matches a student email directly from GCR profile
// e.g. i220812@isb.nu.edu.pk
export const STUDENT_EMAIL_RE =
  /^(i|l|k|p|f|m)\d{6}@(isb|lhr|khi|pwr|cfd|mtn)\.nu\.edu\.pk$/i;

// Campus-letter-first: i220812, l231234, etc.
// Captures: [1]=campus letter, [2]=batch digits (2), [3]=serial (4)
export const ROLL_PATTERN_A = /\b([iIlLkKpPfFmM])(\d{2})(\d{4})\b/;

// Batch-digits-first: 22i-2079, 23l0012, etc.
// Captures: [1]=batch digits (2), [2]=campus letter, [3]=serial (4)
export const ROLL_PATTERN_B = /\b(\d{2})([iIlLkKpPfFmM])-?(\d{4})\b/;

// Campus letter → subdomain mapping
const CAMPUS_MAP = {
  i: 'isb',
  l: 'lhr',
  k: 'khi',
  p: 'pwr',
  f: 'cfd',
  m: 'mtn',
};

/**
 * Try to extract a roll number from a display name.
 * Returns { roll, email } or null.
 * @param {string} displayName
 * @param {string} [fallbackCampus] - e.g. 'isb' — used when campus letter is ambiguous
 */
export function extractRollFromName(displayName, fallbackCampus = 'isb') {
  // Try Pattern A first: i220812 Maria Naeem
  let m = ROLL_PATTERN_A.exec(displayName);
  if (m) {
    const campusLetter = m[1].toLowerCase();
    const campus = CAMPUS_MAP[campusLetter] || fallbackCampus;
    const roll = `${campusLetter}${m[2]}${m[3]}`;
    return { roll, email: `${roll}@${campus}.nu.edu.pk` };
  }

  // Try Pattern B: 22i-2079 Ghazanfar or 22i2079
  m = ROLL_PATTERN_B.exec(displayName);
  if (m) {
    const campusLetter = m[2].toLowerCase();
    const campus = CAMPUS_MAP[campusLetter] || fallbackCampus;
    const roll = `${campusLetter}${m[1]}${m[3]}`;
    return { roll, email: `${roll}@${campus}.nu.edu.pk` };
  }

  return null;
}

/**
 * Derive the campus subdomain from an NU email address.
 * e.g. "i220812@isb.nu.edu.pk" → "isb"
 *      "ammar.asad@isb.nu.edu.pk" → "isb"
 */
export function campusFromEmail(email) {
  const m = /@(isb|lhr|khi|pwr|cfd|mtn)\.nu\.edu\.pk$/i.exec(email || '');
  return m ? m[1].toLowerCase() : 'isb';
}

/**
 * Returns true if the email is a student roll-number email.
 */
export function isStudentEmail(email) {
  return STUDENT_EMAIL_RE.test(email || '');
}
