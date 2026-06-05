/**
 * SkeletonCard — animated placeholder shown while a course is being resolved.
 */
export default function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-busy="true" aria-label="Loading course...">
      {/* Header */}
      <div className="skeleton-header">
        <div className="skeleton skeleton-line w-60" />
        <div className="skeleton skeleton-line w-40" style={{ marginTop: 8, height: 10 }} />
      </div>

      {/* Section: Instructors */}
      <div className="skeleton-body">
        <div className="skeleton skeleton-line w-20" style={{ height: 10, marginBottom: 14 }} />
        {[1, 2].map((i) => (
          <div key={i} className="skeleton-person">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton-text">
              <div className="skeleton skeleton-line w-40" style={{ marginBottom: 6 }} />
              <div className="skeleton skeleton-line w-60" style={{ height: 10 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Section: TAs */}
      <div className="skeleton-body" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="skeleton skeleton-line w-20" style={{ height: 10, marginBottom: 14 }} />
        <div className="skeleton-person">
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton-text">
            <div className="skeleton skeleton-line w-40" style={{ marginBottom: 6 }} />
            <div className="skeleton skeleton-line w-60" style={{ height: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
