import React, { useEffect, useState } from 'react';
import { BookOpen, ClipboardCheck, FileText, Video, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Course, User } from '../types';

interface CoursePreviewModalProps {
  courseId: number | null;
  currentUser: User | null;
  enrolledCourseIds: number[];
  onClose: () => void;
  onEnrolClick: (courseId: number) => void;
  onDirectEnrol: (courseId: number) => void;
  onOpenDashboardCourse: (courseId: number) => void;
}

export const CoursePreviewModal: React.FC<CoursePreviewModalProps> = ({
  courseId,
  currentUser,
  enrolledCourseIds,
  onClose,
  onEnrolClick,
  onDirectEnrol,
  onOpenDashboardCourse,
}) => {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      return;
    }
    setLoading(true);
    apiRequest<Course>(`/api/public/courses/${courseId}`)
      .then((data) => setCourse(data))
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (!courseId) return null;

  const isEnrolled = enrolledCourseIds.includes(courseId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-preview-title"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            {course && (
              <p className="text-xs font-semibold tracking-wide text-blue-700">
                Target Audience · {course.target_audience}
              </p>
            )}
            <h2 id="course-preview-title" className="mt-1 font-display text-2xl font-bold text-slate-900">
              {loading ? 'Loading programme...' : course?.title || 'Course Details'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close course preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="space-y-3 py-8 text-center text-sm text-slate-500">Loading modules...</div>
          ) : course ? (
            <>
              {course.image_url && (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-[16/9]">
                  <img
                    src={course.image_url}
                    alt={course.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">Programme Overview</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{course.description}</p>
                <p className="mt-2.5 text-xs font-medium text-slate-600">
                  Includes: Live sessions · Recorded sessions · Downloadable notes · Practical assignments
                </p>
              </div>

              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Curriculum Structure ({course.modules?.length || 0} Modules)
                </h3>
                {course.modules && course.modules.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {course.modules.map((mod) => (
                      <div key={mod.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-display text-sm font-semibold text-slate-900">{mod.title}</h4>
                            {mod.description && (
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">{mod.description}</p>
                            )}
                          </div>
                          <span className="shrink-0 font-mono-num text-xs text-slate-500">
                            Module {mod.order_index}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col space-y-2 text-xs text-slate-700">
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 shrink-0 text-blue-700" />
                            <span>
                              {mod.videos.length} Video Lesson{mod.videos.length === 1 ? '' : 's'}
                              {mod.videos.some((v) => v.session_type === 'Live Session') && ' (Live & Recorded)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              {mod.notes.length} Downloadable Note{mod.notes.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                            <span>
                              {mod.quizzes.length} Assignment{mod.quizzes.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Modules are being updated by the academy team.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Unable to load course details.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          {currentUser && currentUser.role === 'student' ? (
            isEnrolled ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDashboardCourse(courseId);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Open in My Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDirectEnrol(courseId);
                }}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
              >
                Enrol Now (One Click)
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEnrolClick(courseId);
              }}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
            >
              Enrol Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
