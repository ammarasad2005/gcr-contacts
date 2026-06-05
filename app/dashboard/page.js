'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CourseCard   from '@/components/CourseCard';
import SkeletonCard from '@/components/SkeletonCard';
import {
  saveTokens, saveUser, getUser, getValidToken,
  isSignedIn, signOut,
  getCachedCourses, setCachedCourses,
} from '@/lib/auth';
import { listCourses, getTeachers }  from '@/lib/classroom';
import { filterCurrentSemester }     from '@/lib/semesterFilter';
import { resolveTeachers }           from '@/lib/emailResolver';
import { campusFromEmail }           from '@/lib/studentRegex';

// ── Inner dashboard (needs useSearchParams so wrapped in Suspense) ──
function DashboardInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [user,    setUser]    = useState(null);
  const [courses, setCourses] = useState([]);   // fully resolved CourseCard data
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── 1. On mount: absorb tokens from URL (set by /api/auth/callback) ──
  useEffect(() => {
    const accessToken  = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn    = searchParams.get('expires_in');
    const userJson     = searchParams.get('user');

    if (accessToken) {
      // Save to localStorage and clean URL immediately
      saveTokens({ access_token: accessToken, refresh_token: refreshToken, expires_in: Number(expiresIn) });
      if (userJson) { try { saveUser(JSON.parse(userJson)); } catch {} }
      router.replace('/dashboard');
      return;
    }

    // If not signed in at all, redirect to home
    if (!isSignedIn()) {
      router.replace('/');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Load user state ────────────────────────────────────────────
  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
  }, []);

  // ── 3. Load courses (cache-first) ────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Check localStorage cache first
    const cached = getCachedCourses();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setCourses(cached);
      setLoading(false);
      return;
    }

    try {
      const token = await getValidToken();
      const currentUser = getUser();
      const campus = campusFromEmail(currentUser?.email);

      // Fetch all active courses
      const allCourses = await listCourses(token);
      const semCourses = filterCurrentSemester(allCourses);

      // Show skeletons immediately — one per course
      setSkeletonCount(semCourses.length);
      setLoading(false);

      if (semCourses.length === 0) {
        setCourses([]);
        return;
      }

      // Resolve each course in parallel, filling cards as they complete
      const resolved = [];
      await Promise.all(
        semCourses.map(async (course) => {
          try {
            const teachers = await getTeachers(course.id, token);
            const people   = await resolveTeachers(teachers, course.name, token, campus);
            const entry    = { id: course.id, name: course.name, people };
            resolved.push(entry);

            // Update state progressively so cards appear as they finish
            setCourses((prev) => {
              const next = [...prev, entry];
              // Reduce skeleton count by how many cards have resolved
              setSkeletonCount(Math.max(0, semCourses.length - next.length));
              return next;
            });
          } catch {
            // Single course failure — show card with empty people
            const entry = { id: course.id, name: course.name, people: [] };
            resolved.push(entry);
            setCourses((prev) => {
              const next = [...prev, entry];
              setSkeletonCount(Math.max(0, semCourses.length - next.length));
              return next;
            });
          }
        })
      );

      // Cache the fully resolved set
      setCachedCourses(resolved);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn()) loadCourses();
  }, [loadCourses]);

  // ── Sign-out ──────────────────────────────────────────────────────
  function handleSignOut() {
    signOut();
    router.replace('/');
  }

  // ── Semester label ────────────────────────────────────────────────
  const semStart = process.env.NEXT_PUBLIC_SEMESTER_START || '2025-02-03';
  const semLabel = (() => {
    const d = new Date(semStart);
    if (isNaN(d)) return 'Current Semester';
    const month = d.toLocaleString('default', { month: 'long' });
    const year  = d.getFullYear();
    return `${month} ${year} Semester`;
  })();

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <div className="container header-inner">
          <div className="site-logo">
            <div className="logo-icon" aria-hidden="true">📬</div>
            GCR Contacts
          </div>
          {user && (
            <div className="user-pill">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="user-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <span>{user.name}</span>
              <button className="btn-signout" onClick={handleSignOut} id="sign-out-btn">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="dashboard">
        <div className="container">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Your Course Contacts</h1>
            <p className="dashboard-sub">
              Instructors, TAs, and Lab Demonstrators for all your active courses.
            </p>
            <div className="semester-badge">
              📅 {semLabel}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="auth-error" role="alert" style={{ marginTop: 24 }}>
              ⚠ {error}
              <button
                onClick={loadCourses}
                style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', color: 'inherit', cursor: 'pointer', border: 'none', fontSize: 'inherit' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Initial full-page loading spinner */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
              Connecting to Google Classroom…
            </div>
          )}

          {/* Course grid */}
          {!loading && (
            <div className="courses-grid">
              {/* Resolved cards */}
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}

              {/* Skeleton placeholders for pending courses */}
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`sk-${i}`} />
              ))}

              {/* No courses found */}
              {courses.length === 0 && skeletonCount === 0 && !error && (
                <div className="no-courses">
                  <div className="no-courses-icon">🎓</div>
                  <p>No active courses found for the current semester.</p>
                  <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    Semester start: {semStart} ± 7 days
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
