import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { EnrolModal, SignInModal, type SignInTab } from './components/AuthModals';
import { CoursePreviewModal } from './components/CoursePreviewModal';
import { Homepage } from './components/Homepage';
import { StudentDashboard } from './components/StudentDashboard';
import { apiRequest } from './lib/api';
import type { Course, FaqItem, SiteSettings, Testimonial, User } from './types';

interface BootstrapData {
  courses: Course[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  settings: SiteSettings;
}

type AppView = 'home' | 'student' | 'admin';

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData>({
    courses: [],
    testimonials: [],
    faqs: [],
    settings: {
      academy_name: 'Nexora Digital Skills Academy',
      hero_heading: 'Learn AI. Build Skills. Create Opportunities.',
      hero_intro:
        'Master practical artificial intelligence with structured programmes built for real work. Every course combines live sessions, recorded sessions, downloadable notes, and trainer-marked assignments.',
      support_email: 'nexoradigitalskillsacademy',
      whatsapp_1: '+254183181744',
      whatsapp_2: '+254756511077',
      certificate_note:
        'Certificates of Completion are issued to learners who complete all course modules and pass their trainer-evaluated assignments.',
    },
  });

  const [view, setView] = useState<AppView>('home');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<number[]>([]);

  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolCourseId, setEnrolCourseId] = useState<number | null>(null);

  const [signInOpen, setSignInOpen] = useState(false);
  const [signInTab, setSignInTab] = useState<SignInTab>('student');

  const [previewCourseId, setPreviewCourseId] = useState<number | null>(null);
  const [studentTargetCourseId, setStudentTargetCourseId] = useState<number | null>(null);

  const [globalNotice, setGlobalNotice] = useState('');

  const showNotice = (msg: string) => {
    setGlobalNotice(msg);
    setTimeout(() => setGlobalNotice(''), 4500);
  };

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<BootstrapData>('/api/public/bootstrap');
      setBootstrap(data);
    } catch {
      // Keep fallback settings if transient network error occurs
    }
  }, []);

  const loadStudentEnrolments = useCallback(async (authToken: string) => {
    try {
      const res = await apiRequest<{ enrolledCourses: { id: number }[] }>('/api/student/dashboard', {
        token: authToken,
      });
      setEnrolledCourseIds(res.enrolledCourses.map((c) => c.id));
    } catch {
      setEnrolledCourseIds([]);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const handleAuthSuccess = async (newToken: string, user: User, welcomeMsg?: string) => {
    setToken(newToken);
    setCurrentUser(user);
    setEnrolOpen(false);
    setSignInOpen(false);

    if (user.role === 'admin') {
      setView('admin');
    } else {
      await loadStudentEnrolments(newToken);
      setView('student');
    }

    if (welcomeMsg) {
      showNotice(welcomeMsg);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setCurrentUser(null);
    setEnrolledCourseIds([]);
    setStudentTargetCourseId(null);
    setView('home');
    showNotice('You have signed out.');
  };

  const handleDirectEnrol = async (courseId: number) => {
    if (!token || !currentUser || currentUser.role !== 'student') {
      setEnrolCourseId(courseId);
      setEnrolOpen(true);
      return;
    }

    try {
      const res = await apiRequest<{ message: string }>('/api/student/enrol', {
        method: 'POST',
        token,
        body: { course_id: courseId },
      });
      await loadStudentEnrolments(token);
      setStudentTargetCourseId(courseId);
      setView('student');
      showNotice(res.message);
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : 'Unable to enrol.');
    }
  };

  const handleOpenDashboard = (courseId?: number) => {
    if (!currentUser) {
      setSignInTab('student');
      setSignInOpen(true);
      return;
    }
    if (currentUser.role === 'admin') {
      setView('admin');
    } else {
      setStudentTargetCourseId(courseId ?? null);
      setView('student');
    }
  };

  return (
    <>
      {globalNotice && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {globalNotice}
        </div>
      )}

      {view === 'home' && (
        <Homepage
          courses={bootstrap.courses}
          testimonials={bootstrap.testimonials}
          faqs={bootstrap.faqs}
          settings={bootstrap.settings}
          currentUser={currentUser}
          enrolledCourseIds={enrolledCourseIds}
          onOpenEnrol={(cid) => {
            setEnrolCourseId(cid ?? null);
            setEnrolOpen(true);
          }}
          onOpenSignIn={(tab = 'student') => {
            setSignInTab(tab);
            setSignInOpen(true);
          }}
          onOpenDashboard={handleOpenDashboard}
          onDirectEnrol={handleDirectEnrol}
          onViewCourse={(cid) => setPreviewCourseId(cid)}
          onSignOut={handleSignOut}
        />
      )}

      {view === 'student' && currentUser && token && (
        <StudentDashboard
          user={currentUser}
          token={token}
          initialCourseId={studentTargetCourseId}
          onGoHome={() => setView('home')}
          onSignOut={handleSignOut}
          onCoursesUpdated={() => loadStudentEnrolments(token)}
        />
      )}

      {view === 'admin' && currentUser && currentUser.role === 'admin' && token && (
        <AdminDashboard
          user={currentUser}
          token={token}
          onGoHome={() => setView('home')}
          onSignOut={handleSignOut}
          onDataUpdated={loadBootstrap}
        />
      )}

      <EnrolModal
        isOpen={enrolOpen}
        courses={bootstrap.courses}
        initialCourseId={enrolCourseId}
        onClose={() => setEnrolOpen(false)}
        onSuccess={(tok, usr, msg) => handleAuthSuccess(tok, usr, msg)}
        onSwitchToSignIn={() => {
          setEnrolOpen(false);
          setSignInTab('student');
          setSignInOpen(true);
        }}
      />

      <SignInModal
        isOpen={signInOpen}
        initialTab={signInTab}
        onClose={() => setSignInOpen(false)}
        onSuccess={(tok, usr) => handleAuthSuccess(tok, usr)}
        onSwitchToEnrol={() => {
          setSignInOpen(false);
          setEnrolCourseId(null);
          setEnrolOpen(true);
        }}
      />

      <CoursePreviewModal
        courseId={previewCourseId}
        currentUser={currentUser}
        enrolledCourseIds={enrolledCourseIds}
        onClose={() => setPreviewCourseId(null)}
        onEnrolClick={(cid) => {
          setEnrolCourseId(cid);
          setEnrolOpen(true);
        }}
        onDirectEnrol={handleDirectEnrol}
        onOpenDashboardCourse={(cid) => handleOpenDashboard(cid)}
      />
    </>
  );
}
