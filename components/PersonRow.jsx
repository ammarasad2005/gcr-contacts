'use client';

import { useState } from 'react';
import CopyButton from './CopyButton';

const ROLE_LABELS = {
  instructor:     'Instructor',
  lab_instructor: 'Lab Instructor',
  ta:             'TA',
  ld:             'LD',
};

/**
 * PersonRow — renders one person inside a course card.
 *
 * @param {Object}      person
 * @param {string}      person.displayName
 * @param {string|null} person.photoUrl
 * @param {string|null} person.email
 * @param {string}      person.role
 * @param {string|null} person.linkedin
 * @param {string|null} person.office
 * @param {string|null} person.status
 * @param {string|null} person.facultyImageUrl
 */
export default function PersonRow({ person }) {
  const { displayName, photoUrl, email, role, linkedin, office, status, facultyImageUrl } = person;
  const [imgError, setImgError] = useState(false);

  // Prefer GCR photo, fall back to faculty JSON image, then initials
  const avatarSrc = (!imgError && (photoUrl || facultyImageUrl)) || null;
  const initials  = (displayName || '?').charAt(0).toUpperCase();

  return (
    <div className="person-row">
      {/* Avatar */}
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={displayName}
          className="person-avatar"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="person-avatar-fallback" aria-hidden="true">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="person-info">
        <div className="person-name">{displayName}</div>
        <div className="person-meta">
          {person.section && (
            <span className="section-badge">🏷 {person.section}</span>
          )}
          {email ? (
            <span className="person-email">{email}</span>
          ) : (
            <span className="not-found-badge">⚠ Email Not Found</span>
          )}
          {status && (
            <span className="person-link" style={{ cursor: 'default', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: '11px' }}>
              {status}
            </span>
          )}
        </div>
        {/* Secondary links */}
        {(office || linkedin) && (
          <div className="person-links">
            {office && (
              <span className="person-link" style={{ cursor: 'default' }}>
                🚪 {office}
              </span>
            )}
            {linkedin && (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="person-link"
              >
                in LinkedIn
              </a>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="person-actions">
        <CopyButton
          text={email}
          className="btn-copy-email"
          disabled={!email}
        />
      </div>
    </div>
  );
}
