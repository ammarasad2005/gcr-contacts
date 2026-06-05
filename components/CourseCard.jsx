'use client';

import { useState } from 'react';
import PersonRow from './PersonRow';
import CopyButton from './CopyButton';

const IS_LAB_RE = /lab/i;

/**
 * CourseCard — fully resolved course card.
 *
 * @param {Object}   course
 * @param {string}   course.name
 * @param {Array}    course.people  - ResolvedPerson[]
 */
export default function CourseCard({ course }) {
  const { name, people = [] } = course;
  const isLab = IS_LAB_RE.test(name);

  // Split into instructors and TAs/LDs
  const instructors = people.filter((p) =>
    p.role === 'instructor' || p.role === 'lab_instructor'
  );
  const assistants = people.filter((p) =>
    p.role === 'ta' || p.role === 'ld'
  );

  // Bulk copy: all resolved emails for this course
  const allEmails = people
    .map((p) => p.email)
    .filter(Boolean)
    .join(', ');

  const instructorLabel = isLab ? 'Lab Instructors' : 'Instructors';
  const assistantLabel  = isLab ? 'Lab Demonstrators (LDs)' : 'Teaching Assistants (TAs)';

  return (
    <div className="course-card">
      {/* Card header */}
      <div className="card-header">
        <div className="card-title-row">
          <div className="card-course-name">{name}</div>
          <span className={`card-lab-badge ${isLab ? '' : 'theory'}`}>
            {isLab ? '🔬 Lab' : '📖 Theory'}
          </span>
        </div>
        <CopyButton
          text={allEmails}
          className="btn-copy-all"
          disabled={!allEmails}
          label={allEmails ? '⎘ Copy all emails' : 'No emails'}
        />
      </div>

      {/* Instructors section */}
      {instructors.length > 0 && (
        <div className="card-section">
          <div className="section-label">{instructorLabel}</div>
          {instructors.map((p) => (
            <PersonRow key={p.userId} person={p} />
          ))}
        </div>
      )}

      {/* TAs / LDs section */}
      {assistants.length > 0 && (
        <div className="card-section">
          <div className="section-label">{assistantLabel}</div>
          {assistants.map((p) => (
            <PersonRow key={p.userId} person={p} />
          ))}
        </div>
      )}

      {/* Edge case: nobody resolved */}
      {people.length === 0 && (
        <div className="card-section" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          No teachers found in this course.
        </div>
      )}
    </div>
  );
}
