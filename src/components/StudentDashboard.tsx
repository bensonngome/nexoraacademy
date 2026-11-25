import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Play,
  PlusCircle,
  TrendingUp,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { apiRequest, downloadProtectedFile, extractYouTubeEmbedUrl, formatShortDate } from '../lib/api';
import type {
  Course,
  CourseModule,
  CourseProgress,
  NoteResource,
  QuizAssignment,
  User,
  VideoLesson,
} from '../types';
import { BrandLogo } from './BrandLogo';

interface EnrolledCourseDetail extends Course {
  modules: CourseModule[];
  progress: CourseProgress;
}

interface StudentDashboardData {
  enrolledCourses: EnrolledCourseDetail[];
  progressList: CourseProgress[];
  availableCourses: Course[];
}

interface StudentDashboardProps {
  user: User;
  token: string;
  initialCourseId?: number | null;
  onGoHome: () => void;
  onSignOut: () => void;
  onCoursesUpdated: () => void;
}

type StudentTab = 'courses' | 'learning' | 'progress' | 'explore';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  token,
  initialCourseId,
  onGoHome,
  onSignOut,
  onCoursesUpdated,
}) => {
  const [tab, setTab] = useState<StudentTab>(initialCourseId ? 'learning' : 'courses');
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [activeCourseId, setActiveCourseId] = useState<number | null>(initialCourseId || null);
  const [activeVideo, setActiveVideo] = useState<{ video: VideoLesson; courseId: number; moduleId: number } | null>(
    null
  );
  const [activeQuiz, setActiveQuiz] = useState<{ quiz: QuizAssignment; courseId: number; moduleId: number } | null>(
    null
  );

  // Assignment submission state
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<StudentDashboardData>('/api/student/dashboard', { token });
      setData(res);
      if (initialCourseId && res.enrolledCourses.some((c) => c.id === initialCourseId)) {
        setActiveCourseId(initialCourseId);
        setTab('learning');
      } else if (!activeCourseId && res.enrolledCourses.length > 0) {
        setActiveCourseId(res.enrolledCourses[0].id);
      }
      onCoursesUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load student dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const activeCourse = data?.enrolledCourses.find((c) => c.id === activeCourseId) || null;
  const enrolledIds = new Set(data?.enrolledCourses.map((c) => c.id) || []);
  const unEnrolledCourses = (data?.availableCourses || []).filter((c) => !enrolledIds.has(c.id));

  const handleToggleActivity = async (
    courseId: number,
    moduleId: number,
    itemType: 'video' | 'note',
    itemId: number,
    completed: boolean
  ) => {
    try {
      await apiRequest('/api/student/progress', {
        method: 'POST',
        token,
        body: { course_id: courseId, module_id: moduleId, item_type: itemType, item_id: itemId, completed },
      });
      await fetchDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not update progress.');
    }
  };

  const handleWatchVideo = async (courseId: number, moduleId: number, video: VideoLesson) => {
    setActiveVideo({ video, courseId, moduleId });
    if (!video.completed) {
      await handleToggleActivity(courseId, moduleId, 'video', video.id, true);
    }
  };

  const handleDownloadNote = async (courseId: number, moduleId: number, note: NoteResource) => {
    try {
      await downloadProtectedFile(note.file_url, token, note.file_name);
      if (!note.completed) {
        await handleToggleActivity(courseId, moduleId, 'note', note.id, true);
      }
      showToast(`Downloaded ${note.file_name}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not download note.');
    }
  };

  const handleDownloadQuizQuestion = async (quiz: QuizAssignment) => {
    if (!quiz.question_file_url) return;
    try {
      await downloadProtectedFile(
        quiz.question_file_url,
        token,
        quiz.question_file_name || 'assignment-questions.pdf'
      );
      showToast('Quiz document downloaded.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not download quiz document.');
    }
  };

  const handleDownloadOwnSubmission = async (quiz: QuizAssignment) => {
    if (!quiz.submission?.file_url) return;
    try {
      await downloadProtectedFile(quiz.submission.file_url, token, quiz.submission.file_name);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not download submission.');
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuiz || !submissionFile) {
      showToast('Please select a PDF or Word document to upload.');
      return;
    }

    setSubmittingAssignment(true);
    try {
      const formData = new FormData();
      formData.append('quiz_id', String(activeQuiz.quiz.id));
      formData.append('notes_text', submissionNotes.trim());
      formData.append('file', submissionFile);

      const res = await apiRequest<{ message: string }>('/api/student/submissions', {
        method: 'POST',
        token,
        body: formData,
        isFormData: true,
      });

      setSubmissionFile(null);
      setSubmissionNotes('');
      setActiveQuiz(null);
      showToast(res.message);
      await fetchDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to submit assignment.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const handleDirectEnrol = async (courseId: number) => {
    try {
      const res = await apiRequest<{ message: string }>('/api/student/enrol', {
        method: 'POST',
        token,
        body: { course_id: courseId },
      });
      showToast(res.message);
      setActiveCourseId(courseId);
      await fetchDashboard();
      setTab('learning');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not complete enrolment.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 min-w-0">
            <button type="button" onClick={onGoHome} className="whitespace-nowrap shrink-0 text-left">
              <BrandLogo />
            </button>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="hidden sm:inline truncate text-sm font-medium text-slate-600">
              Student Learning Portal
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline text-xs font-medium text-slate-600 truncate max-w-[180px]">
              {user.full_name}
            </span>
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Home className="h-3.5 w-3.5" />
              Website
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setTab('courses')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'courses'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              My Courses ({data?.enrolledCourses.length ?? 0})
            </button>
            {activeCourse && (
              <button
                type="button"
                onClick={() => setTab('learning')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'learning'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Course Learning Area
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab('progress')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'progress'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              My Progress
            </button>
            <button
              type="button"
              onClick={() => setTab('explore')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'explore'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Enrol in Courses
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading your courses and progress...
          </div>
        ) : null}

        {/* TAB 1: MY COURSES */}
        {!loading && data && tab === 'courses' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">My Enrolled Courses</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Access live sessions, recorded lessons, downloadable notes, and practical assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab('explore')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors self-start"
              >
                <PlusCircle className="h-4 w-4" />
                Enrol in Another Course
              </button>
            </div>

            {data.enrolledCourses.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <p className="font-display text-base font-semibold text-slate-900">
                  You have not enrolled in a course yet
                </p>
                <p className="mt-1.5 text-sm text-slate-600">
                  Choose any available Nexora Digital Skills Academy programme to begin learning immediately.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('explore')}
                  className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Browse Available Courses
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {data.enrolledCourses.map((course) => (
                  <article
                    key={course.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                      {course.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <GraduationCap className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-medium text-blue-700">{course.target_audience}</p>
                      <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{course.title}</h2>
                      <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-2">{course.description}</p>

                      <div className="mt-3 flex flex-col space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Video className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                          <span className="tabular-nums">
                            {course.progress?.total_videos ?? 0} Video Lesson{(course.progress?.total_videos ?? 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span className="tabular-nums">
                            {course.progress?.total_notes ?? 0} Downloadable Note{(course.progress?.total_notes ?? 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          <span className="tabular-nums">
                            {course.progress?.total_quizzes ?? 0} Assignment{(course.progress?.total_quizzes ?? 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                          <span>Overall Progress</span>
                          <span className="font-mono-num font-semibold">{course.progress?.percentage ?? 0}%</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-blue-700 transition-all"
                            style={{ width: `${course.progress?.percentage ?? 0}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCourseId(course.id);
                            setTab('learning');
                          }}
                          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          Continue Learning
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COURSE LEARNING AREA */}
        {!loading && data && tab === 'learning' && activeCourse && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setTab('courses')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to My Courses
                </button>
                <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">{activeCourse.title}</h1>
                <p className="mt-1 text-sm text-slate-600 max-w-2xl">{activeCourse.description}</p>
              </div>

              <div className="sm:w-64 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Course Completion</span>
                  <span className="font-mono-num text-blue-700">{activeCourse.progress?.percentage ?? 0}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-blue-700 transition-all"
                    style={{ width: `${activeCourse.progress?.percentage ?? 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 tabular-nums">
                  {activeCourse.progress?.completed_modules ?? 0} of {activeCourse.progress?.total_modules ?? 0} modules completed
                </p>
              </div>
            </div>

            {activeCourse.modules.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                No modules have been published for this course yet.
              </div>
            ) : (
              <div className="space-y-6">
                {activeCourse.modules.map((mod) => {
                  const totalCount = mod.videos.length + mod.notes.length + mod.quizzes.length;
                  const doneCount =
                    mod.videos.filter((v) => v.completed).length +
                    mod.notes.filter((n) => n.completed).length +
                    mod.quizzes.filter((q) => Boolean(q.submission)).length;

                  return (
                    <section
                      key={mod.id}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono-num text-xs font-semibold text-blue-700">
                            Module {mod.order_index}
                          </p>
                          <h2 className="font-display text-lg font-bold text-slate-900">{mod.title}</h2>
                          {mod.description && <p className="mt-0.5 text-sm text-slate-600">{mod.description}</p>}
                        </div>
                        <span className="font-mono-num text-xs font-semibold text-slate-600 shrink-0">
                          {doneCount}/{totalCount} Completed
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 px-6">
                        {/* A. Video Lessons */}
                        <div className="py-5">
                          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <Video className="h-4 w-4 text-blue-700" />
                            Video Lessons (Live & Recorded Sessions)
                          </h3>
                          {mod.videos.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No video lessons in this module yet.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {mod.videos.map((vid) => (
                                <div
                                  key={vid.id}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-semibold text-blue-700">{vid.session_type}</span>
                                      <span aria-hidden="true" className="text-slate-300">·</span>
                                      {vid.completed ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Completed
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                          <Clock className="h-3.5 w-3.5" />
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 font-display text-sm font-semibold text-slate-900">
                                      {vid.title}
                                    </p>
                                    {vid.description && (
                                      <p className="mt-0.5 text-xs text-slate-600">{vid.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleWatchVideo(activeCourse.id, mod.id, vid)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
                                    >
                                      <Play className="h-3.5 w-3.5" />
                                      Watch Video
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleActivity(activeCourse.id, mod.id, 'video', vid.id, !vid.completed)
                                      }
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                                    >
                                      {vid.completed ? 'Mark Pending' : 'Mark Watched'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* B. Downloadable Notes */}
                        <div className="py-5">
                          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <FileText className="h-4 w-4 text-slate-700" />
                            Downloadable Notes
                          </h3>
                          {mod.notes.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No downloadable notes in this module yet.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {mod.notes.map((note) => (
                                <div
                                  key={note.id}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-mono-num font-semibold text-slate-700">
                                        {note.file_type}
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300">·</span>
                                      {note.completed ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Accessed
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                          <Clock className="h-3.5 w-3.5" />
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 font-display text-sm font-semibold text-slate-900">
                                      {note.title}
                                    </p>
                                    {note.description && (
                                      <p className="mt-0.5 text-xs text-slate-600">{note.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadNote(activeCourse.id, mod.id, note)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Download Notes
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* C. Quizzes and Assignments */}
                        <div className="py-5">
                          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                            Quizzes and Assignments
                          </h3>
                          {mod.quizzes.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No assignments in this module yet.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {mod.quizzes.map((quiz) => {
                                const sub = quiz.submission;
                                const isMarked = sub && sub.marks_awarded !== null;
                                return (
                                  <div
                                    key={quiz.id}
                                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          {isMarked ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                              <CheckCircle2 className="h-3.5 w-3.5" />
                                              Marked by Trainer
                                            </span>
                                          ) : sub ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                                              <Clock className="h-3.5 w-3.5" />
                                              Submitted · Pending Trainer Marking
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                              <Clock className="h-3.5 w-3.5" />
                                              Pending Submission
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-1 font-display text-sm font-semibold text-slate-900">
                                          {quiz.title}
                                        </p>
                                        {quiz.description && (
                                          <p className="mt-0.5 text-xs text-slate-600">{quiz.description}</p>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubmissionFile(null);
                                          setSubmissionNotes('');
                                          setActiveQuiz({ quiz, courseId: activeCourse.id, moduleId: mod.id });
                                        }}
                                        className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                                      >
                                        {sub ? 'View / Resubmit Quiz' : 'Attempt Quiz'}
                                      </button>
                                    </div>

                                    {sub && (
                                      <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-slate-600">
                                            Submitted file:{' '}
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadOwnSubmission(quiz)}
                                              className="font-semibold text-blue-700 hover:underline"
                                            >
                                              {sub.file_name}
                                            </button>
                                          </span>
                                          <span className="font-mono-num text-slate-500">
                                            {formatShortDate(sub.submitted_at)}
                                          </span>
                                        </div>

                                        {isMarked ? (
                                          <div className="pt-2 border-t border-slate-100 space-y-1">
                                            <p className="font-semibold text-emerald-800 font-mono-num">
                                              Trainer Marks: {sub.marks_awarded}
                                            </p>
                                            {sub.feedback && (
                                              <p className="text-slate-700">
                                                <span className="font-semibold">Trainer Feedback:</span> {sub.feedback}
                                              </p>
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-slate-500 pt-1">
                                            The trainer will set marks and feedback once your submission is reviewed.
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY PROGRESS */}
        {!loading && data && tab === 'progress' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">My Learning Progress</h1>
              <p className="mt-1 text-sm text-slate-600">
                Track module completion, videos watched, notes accessed, assignments submitted, and trainer marks for each enrolled course.
              </p>
            </div>

            {data.progressList.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                Enrol in a course to start tracking your progress.
              </div>
            ) : (
              <div className="space-y-4">
                {data.progressList.map((prog) => (
                  <div
                    key={prog.course_id}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium text-blue-700">{prog.target_audience}</p>
                        <h2 className="font-display text-lg font-bold text-slate-900">{prog.course_title}</h2>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono-num text-lg font-bold text-slate-900">
                          {prog.percentage}%
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCourseId(prog.course_id);
                            setTab('learning');
                          }}
                          className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                        >
                          Open Course
                        </button>
                      </div>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-blue-700 transition-all"
                        style={{ width: `${prog.percentage}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500">Modules Completed</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-slate-900">
                          {prog.completed_modules} / {prog.total_modules}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Videos Watched</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-slate-900">
                          {prog.videos_watched} / {prog.total_videos}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Notes Accessed</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-slate-900">
                          {prog.notes_accessed} / {prog.total_notes}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Assignments Submitted</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-slate-900">
                          {prog.assignments_submitted} / {prog.total_quizzes}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Assignments Marked</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-slate-900">
                          {prog.assignments_marked} / {prog.assignments_submitted}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Marks Awarded</p>
                        <p className="mt-1 font-mono-num text-base font-bold text-emerald-700">
                          {prog.marks_awarded}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPLORE & DIRECT ENROL (NO SECOND FORM REQUIRED!) */}
        {!loading && data && tab === 'explore' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">Enrol in Additional Courses</h1>
              <p className="mt-1 text-sm text-slate-600">
                Because you are already signed in as {user.full_name}, you can enrol directly in any course with one click.
              </p>
            </div>

            {unEnrolledCourses.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                You are already enrolled in all currently published NeXORA courses.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {unEnrolledCourses.map((course) => (
                  <article
                    key={course.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                      {course.image_url ? (
                        <img
                          src={course.image_url}
                          alt={course.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <GraduationCap className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-medium text-blue-700">{course.target_audience}</p>
                      <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{course.title}</h2>
                      <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-3">{course.description}</p>
                      <button
                        type="button"
                        onClick={() => handleDirectEnrol(course.id)}
                        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors"
                      >
                        Enrol in This Course
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold text-blue-700">{activeVideo.video.session_type}</p>
                <h3 className="font-display text-lg font-bold text-slate-900">{activeVideo.video.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close video player"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {extractYouTubeEmbedUrl(activeVideo.video.video_url) ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-950">
                  <iframe
                    src={extractYouTubeEmbedUrl(activeVideo.video.video_url) || ''}
                    title={activeVideo.video.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                  <p className="text-sm text-slate-700">
                    Open the lesson link below to view this session directly.
                  </p>
                  <a
                    href={activeVideo.video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Open Video Link
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}

              {activeVideo.video.description && (
                <p className="text-sm text-slate-600">{activeVideo.video.description}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <a
                  href={activeVideo.video.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                >
                  Open in new tab
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveVideo(null)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Done Watching
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempt Quiz & Assignment Upload Modal */}
      {activeQuiz && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Quiz & Practical Assignment</p>
                <h3 className="mt-0.5 font-display text-lg font-bold text-slate-900">
                  {activeQuiz.quiz.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close assignment modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Instructions</p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {activeQuiz.quiz.instructions || activeQuiz.quiz.description}
                </p>
                {activeQuiz.quiz.question_file_url && (
                  <button
                    type="button"
                    onClick={() => handleDownloadQuizQuestion(activeQuiz.quiz)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Quiz Document ({activeQuiz.quiz.question_file_name || 'Questions'})
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitAssignment} className="space-y-4">
                <div>
                  <label htmlFor="assignment-file" className="block text-sm font-medium text-slate-800">
                    Upload Completed Assignment (Word or PDF) <span className="text-red-600">*</span>
                  </label>
                  <div className="mt-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4">
                    <input
                      id="assignment-file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      required
                      onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Accepted formats: .pdf, .doc, .docx (max 25MB).
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="assignment-notes" className="block text-sm font-medium text-slate-800">
                    Notes for Trainer (Optional)
                  </label>
                  <textarea
                    id="assignment-notes"
                    rows={2}
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    placeholder="Add any comments about your submission..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Note: The trainer will review your uploaded file and set your marks and feedback.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveQuiz(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAssignment}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {submittingAssignment ? 'Uploading...' : 'Submit for Marking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
