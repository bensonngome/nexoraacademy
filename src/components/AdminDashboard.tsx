import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Plus,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Video,
  X,
} from 'lucide-react';
import { apiRequest, downloadProtectedFile, formatShortDate } from '../lib/api';
import type {
  AdminLearnerProgressRow,
  AdminOverviewStats,
  Course,
  Enrolment,
  FaqItem,
  QuizSubmission,
  SiteSettings,
  Testimonial,
  User,
} from '../types';
import { BrandLogo } from './BrandLogo';

type AdminSection =
  | 'overview'
  | 'courses'
  | 'modules'
  | 'videos'
  | 'notes'
  | 'quizzes'
  | 'submissions'
  | 'marking'
  | 'learners'
  | 'enrolments'
  | 'progress'
  | 'testimonials'
  | 'faqs'
  | 'settings';

interface AdminLearnerRow extends User {
  enrolled_courses: string | null;
  is_active: number;
}

interface AdminEnrolmentRow extends Enrolment {
  is_active?: number;
}

interface AdminOverviewData {
  stats: AdminOverviewStats;
  courses: Course[];
  learners: AdminLearnerRow[];
  enrolments: AdminEnrolmentRow[];
  submissions: QuizSubmission[];
  learnerProgress: AdminLearnerProgressRow[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  settings: SiteSettings;
}

interface AdminDashboardProps {
  user: User;
  token: string;
  onGoHome: () => void;
  onSignOut: () => void;
  onDataUpdated: () => void;
}

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'courses', label: 'Course Management', icon: BookOpen },
  { id: 'modules', label: 'Module Management', icon: Layers },
  { id: 'videos', label: 'Video Lessons', icon: Video },
  { id: 'notes', label: 'Notes and Resources', icon: FileText },
  { id: 'quizzes', label: 'Quizzes and Assignments', icon: ClipboardCheck },
  { id: 'submissions', label: 'Assignment Submissions', icon: Inbox },
  { id: 'marking', label: 'Marking and Feedback', icon: Award },
  { id: 'learners', label: 'Learner Management', icon: Users },
  { id: 'enrolments', label: 'Enrolment Requests', icon: UserPlus },
  { id: 'progress', label: 'Learner Progress', icon: TrendingUp },
  { id: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { id: 'faqs', label: 'FAQ Management', icon: HelpCircle },
  { id: 'settings', label: 'Website Settings', icon: Settings },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  token,
  onGoHome,
  onSignOut,
  onDataUpdated,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // Shared course/module selectors
  const [selectedCourseId, setSelectedCourseId] = useState<number>(0);
  const [selectedModuleId, setSelectedModuleId] = useState<number>(0);

  // Course form
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseAudience, setCourseAudience] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [coursePublished, setCoursePublished] = useState(true);
  const [courseImageFile, setCourseImageFile] = useState<File | null>(null);

  // Module form
  const [modTitle, setModTitle] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [editingModId, setEditingModId] = useState<number | null>(null);

  // Video form
  const [vidTitle, setVidTitle] = useState('');
  const [vidType, setVidType] = useState<'Live Session' | 'Recorded Session'>('Live Session');
  const [vidUrl, setVidUrl] = useState('');
  const [vidDesc, setVidDesc] = useState('');

  // Notes form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);

  // Quiz form
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizInstructions, setQuizInstructions] = useState('');
  const [quizFile, setQuizFile] = useState<File | null>(null);

  // Marking state
  const [markingTarget, setMarkingTarget] = useState<QuizSubmission | null>(null);
  const [markValue, setMarkValue] = useState('');
  const [markFeedback, setMarkFeedback] = useState('');

  // Manual add learner state
  const [newLearnerName, setNewLearnerName] = useState('');
  const [newLearnerPhone, setNewLearnerPhone] = useState('');
  const [newLearnerEmail, setNewLearnerEmail] = useState('');
  const [newLearnerPassword, setNewLearnerPassword] = useState('');
  const [showNewLearnerPass, setShowNewLearnerPass] = useState(false);
  const [newLearnerCourseId, setNewLearnerCourseId] = useState('');

  // Edit learner state
  const [editingLearnerId, setEditingLearnerId] = useState<number | null>(null);
  const [editLearnerName, setEditLearnerName] = useState('');
  const [editLearnerPhone, setEditLearnerPhone] = useState('');
  const [editLearnerEmail, setEditLearnerEmail] = useState('');
  const [editLearnerCourseId, setEditLearnerCourseId] = useState('');

  // Search & filter state
  const [learnerSearch, setLearnerSearch] = useState('');
  const [learnerCourseFilter, setLearnerCourseFilter] = useState('All');

  // Testimonial form
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testName, setTestName] = useState('');
  const [testRole, setTestRole] = useState('');
  const [testOrg, setTestOrg] = useState('');
  const [testQuote, setTestQuote] = useState('');

  // FAQ form
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');

  // Website settings form
  const [settingsForm, setSettingsForm] = useState<SiteSettings>({
    academy_name: '',
    hero_heading: '',
    hero_intro: '',
    support_email: '',
    whatsapp_1: '',
    whatsapp_2: '',
    certificate_note: '',
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview', { token });
      setData(res);
      setSettingsForm(res.settings);
      if (res.courses.length > 0) {
        const cid = res.courses.some((c) => c.id === selectedCourseId) ? selectedCourseId : res.courses[0].id;
        setSelectedCourseId(cid);
        const courseObj = res.courses.find((c) => c.id === cid);
        if (courseObj?.modules && courseObj.modules.length > 0) {
          const mid = courseObj.modules.some((m) => m.id === selectedModuleId)
            ? selectedModuleId
            : courseObj.modules[0].id;
          setSelectedModuleId(mid);
        } else {
          setSelectedModuleId(0);
        }
      }
      onDataUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const activeCourse = useMemo(
    () => data?.courses.find((c) => c.id === selectedCourseId) || null,
    [data, selectedCourseId]
  );

  const activeModules = activeCourse?.modules || [];
  const activeModule = activeModules.find((m) => m.id === selectedModuleId) || activeModules[0] || null;

  useEffect(() => {
    if (activeCourse) {
      const mods = activeCourse.modules || [];
      if (mods.length > 0 && !mods.some((m) => m.id === selectedModuleId)) {
        setSelectedModuleId(mods[0].id);
      } else if (mods.length === 0) {
        setSelectedModuleId(0);
      }
    }
  }, [selectedCourseId, activeCourse]);

  // Filtered learners, enrolments, progress
  const filteredLearners = useMemo(() => {
    if (!data) return [];
    const q = learnerSearch.trim().toLowerCase();
    return data.learners.filter((l) => {
      const matchesQ =
        !q ||
        l.full_name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q);
      const matchesCourse =
        learnerCourseFilter === 'All' ||
        (l.enrolled_courses || '').toLowerCase().includes(learnerCourseFilter.toLowerCase());
      return matchesQ && matchesCourse;
    });
  }, [data, learnerSearch, learnerCourseFilter]);

  const filteredEnrolments = useMemo(() => {
    if (!data) return [];
    const q = learnerSearch.trim().toLowerCase();
    return data.enrolments.filter((e) => {
      const matchesQ =
        !q ||
        e.full_name.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q);
      const matchesCourse =
        learnerCourseFilter === 'All' || e.course_title === learnerCourseFilter;
      return matchesQ && matchesCourse;
    });
  }, [data, learnerSearch, learnerCourseFilter]);

  const filteredProgress = useMemo(() => {
    if (!data) return [];
    const q = learnerSearch.trim().toLowerCase();
    return data.learnerProgress.filter((p) => {
      const matchesQ =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q);
      const matchesCourse = learnerCourseFilter === 'All' || p.course_title === learnerCourseFilter;
      return matchesQ && matchesCourse;
    });
  }, [data, learnerSearch, learnerCourseFilter]);

  // Handlers
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', courseTitle.trim());
      fd.append('target_audience', courseAudience.trim());
      fd.append('description', courseDesc.trim());
      fd.append('is_published', String(coursePublished));
      if (courseImageFile) fd.append('image', courseImageFile);

      if (editingCourse) {
        await apiRequest(`/api/admin/courses/${editingCourse.id}`, {
          method: 'PUT',
          token,
          body: fd,
          isFormData: true,
        });
        notify('Course updated.');
      } else {
        await apiRequest('/api/admin/courses', {
          method: 'POST',
          token,
          body: fd,
          isFormData: true,
        });
        notify('New course added.');
      }
      setEditingCourse(null);
      setCourseTitle('');
      setCourseAudience('');
      setCourseDesc('');
      setCoursePublished(true);
      setCourseImageFile(null);
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save course.');
    }
  };

  const handleTogglePublish = async (course: Course) => {
    try {
      await apiRequest(`/api/admin/courses/${course.id}/publish`, {
        method: 'PATCH',
        token,
        body: { is_published: course.is_published === 0 },
      });
      notify(course.is_published ? 'Course unpublished.' : 'Course published.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Could not update course.');
    }
  };

  const handleDeleteCourse = async (id: number) => {
    try {
      await apiRequest(`/api/admin/courses/${id}`, { method: 'DELETE', token });
      notify('Course removed.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to remove course.');
    }
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !modTitle.trim()) return;
    try {
      if (editingModId) {
        await apiRequest(`/api/admin/modules/${editingModId}`, {
          method: 'PUT',
          token,
          body: { title: modTitle.trim(), description: modDesc.trim() },
        });
        notify('Module updated.');
      } else {
        await apiRequest('/api/admin/modules', {
          method: 'POST',
          token,
          body: { course_id: selectedCourseId, title: modTitle.trim(), description: modDesc.trim() },
        });
        notify('Module added.');
      }
      setEditingModId(null);
      setModTitle('');
      setModDesc('');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save module.');
    }
  };

  const handleMoveModule = async (modId: number, direction: 'up' | 'down') => {
    try {
      await apiRequest(`/api/admin/modules/${modId}/move`, {
        method: 'POST',
        token,
        body: { direction },
      });
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Could not reorder module.');
    }
  };

  const handleDeleteModule = async (modId: number) => {
    try {
      await apiRequest(`/api/admin/modules/${modId}`, { method: 'DELETE', token });
      notify('Module deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Could not delete module.');
    }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule) return;
    try {
      await apiRequest('/api/admin/videos', {
        method: 'POST',
        token,
        body: {
          module_id: activeModule.id,
          title: vidTitle.trim(),
          session_type: vidType,
          video_url: vidUrl.trim(),
          description: vidDesc.trim(),
        },
      });
      setVidTitle('');
      setVidUrl('');
      setVidDesc('');
      notify('Video lesson added.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to add video.');
    }
  };

  const handleDeleteVideo = async (id: number) => {
    try {
      await apiRequest(`/api/admin/videos/${id}`, { method: 'DELETE', token });
      notify('Video deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete video.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule || !noteFile) {
      notify('Select a module and document file.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('module_id', String(activeModule.id));
      fd.append('title', noteTitle.trim());
      fd.append('description', noteDesc.trim());
      fd.append('file', noteFile);
      await apiRequest('/api/admin/notes', {
        method: 'POST',
        token,
        body: fd,
        isFormData: true,
      });
      setNoteTitle('');
      setNoteDesc('');
      setNoteFile(null);
      notify('Downloadable notes uploaded.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to upload notes.');
    }
  };

  const handleDeleteNote = async (id: number) => {
    try {
      await apiRequest(`/api/admin/notes/${id}`, { method: 'DELETE', token });
      notify('Notes deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete notes.');
    }
  };

  const handleAddQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule) return;
    try {
      const fd = new FormData();
      fd.append('module_id', String(activeModule.id));
      fd.append('title', quizTitle.trim());
      fd.append('description', quizDesc.trim());
      fd.append('instructions', quizInstructions.trim() || quizDesc.trim());
      if (quizFile) fd.append('file', quizFile);
      await apiRequest('/api/admin/quizzes', {
        method: 'POST',
        token,
        body: fd,
        isFormData: true,
      });
      setQuizTitle('');
      setQuizDesc('');
      setQuizInstructions('');
      setQuizFile(null);
      notify('Quiz/assignment added.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to add quiz.');
    }
  };

  const handleDeleteQuiz = async (id: number) => {
    try {
      await apiRequest(`/api/admin/quizzes/${id}`, { method: 'DELETE', token });
      notify('Quiz/assignment deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete quiz.');
    }
  };

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markingTarget) return;
    const numericMark = Number(markValue);
    if (!Number.isFinite(numericMark) || numericMark < 0 || numericMark > 50) {
      notify('Marks must be between 0 and 50.');
      return;
    }
    try {
      await apiRequest(`/api/admin/submissions/${markingTarget.id}/mark`, {
        method: 'PATCH',
        token,
        body: { marks_awarded: numericMark, feedback: markFeedback.trim() },
      });
      setMarkingTarget(null);
      setMarkValue('');
      setMarkFeedback('');
      notify('Marks published to learner.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save marks.');
    }
  };

  const handleAddLearnerManually = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/learners', {
        method: 'POST',
        token,
        body: {
          full_name: newLearnerName.trim(),
          phone: newLearnerPhone.trim(),
          email: newLearnerEmail.trim(),
          password: newLearnerPassword,
          course_id: newLearnerCourseId ? Number(newLearnerCourseId) : null,
        },
      });
      setNewLearnerName('');
      setNewLearnerPhone('');
      setNewLearnerEmail('');
      setNewLearnerPassword('');
      setNewLearnerCourseId('');
      notify('Learner added manually and ready to sign in.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to add learner.');
    }
  };

  const handleUpdateLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLearnerId) return;
    try {
      await apiRequest(`/api/admin/learners/${editingLearnerId}`, {
        method: 'PUT',
        token,
        body: {
          full_name: editLearnerName.trim(),
          phone: editLearnerPhone.trim(),
          email: editLearnerEmail.trim(),
          course_id: editLearnerCourseId ? Number(editLearnerCourseId) : null,
        },
      });
      setEditingLearnerId(null);
      setEditLearnerName('');
      setEditLearnerPhone('');
      setEditLearnerEmail('');
      setEditLearnerCourseId('');
      notify('Learner details updated.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to update learner.');
    }
  };

  const handleToggleLearnerStatus = async (userId: number, currentActive: number) => {
    try {
      const nextActive = currentActive === 0;
      const res = await apiRequest<{ message: string }>(`/api/admin/learners/${userId}/status`, {
        method: 'PATCH',
        token,
        body: { is_active: nextActive },
      });
      notify(res.message);
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to update learner status.');
    }
  };

  const handleDeleteLearner = async (id: number) => {
    try {
      await apiRequest(`/api/admin/learners/${id}`, { method: 'DELETE', token });
      notify('Learner removed.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to remove learner.');
    }
  };

  const handleEnrolmentStatus = async (id: number, status: 'Approved' | 'Pending' | 'Rejected') => {
    try {
      await apiRequest(`/api/admin/enrolments/${id}`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      notify(`Enrolment updated to ${status}.`);
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to update enrolment.');
    }
  };

  const handleDeleteEnrolment = async (id: number) => {
    try {
      await apiRequest(`/api/admin/enrolments/${id}`, { method: 'DELETE', token });
      notify('Enrolment deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete enrolment.');
    }
  };

  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTestimonial) {
        await apiRequest(`/api/admin/testimonials/${editingTestimonial.id}`, {
          method: 'PUT',
          token,
          body: { author_name: testName, author_role: testRole, organization: testOrg, quote: testQuote },
        });
        notify('Testimonial updated.');
      } else {
        await apiRequest('/api/admin/testimonials', {
          method: 'POST',
          token,
          body: { author_name: testName, author_role: testRole, organization: testOrg, quote: testQuote },
        });
        notify('Testimonial added.');
      }
      setEditingTestimonial(null);
      setTestName('');
      setTestRole('');
      setTestOrg('');
      setTestQuote('');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save testimonial.');
    }
  };

  const handleDeleteTestimonial = async (id: number) => {
    try {
      await apiRequest(`/api/admin/testimonials/${id}`, { method: 'DELETE', token });
      notify('Testimonial deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete testimonial.');
    }
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await apiRequest(`/api/admin/faqs/${editingFaq.id}`, {
          method: 'PUT',
          token,
          body: { question: faqQ, answer: faqA },
        });
        notify('FAQ updated.');
      } else {
        await apiRequest('/api/admin/faqs', {
          method: 'POST',
          token,
          body: { question: faqQ, answer: faqA },
        });
        notify('FAQ added.');
      }
      setEditingFaq(null);
      setFaqQ('');
      setFaqA('');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save FAQ.');
    }
  };

  const handleDeleteFaq = async (id: number) => {
    try {
      await apiRequest(`/api/admin/faqs/${id}`, { method: 'DELETE', token });
      notify('FAQ deleted.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to delete FAQ.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        token,
        body: settingsForm,
      });
      notify('Website settings saved.');
      await fetchOverview();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const CourseModuleSelector = ({ showModule = true }: { showModule?: boolean }) => (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <div>
        <label className="block text-xs font-semibold text-slate-700">Select Course</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        >
          {data?.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {showModule && (
        <div>
          <label className="block text-xs font-semibold text-slate-700">Select Module</label>
          <select
            value={activeModule?.id || ''}
            onChange={(e) => setSelectedModuleId(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {activeModules.length === 0 ? (
              <option value="">No modules in this course yet</option>
            ) : (
              activeModules.map((m) => (
                <option key={m.id} value={m.id}>
                  Module {m.order_index}: {m.title}
                </option>
              ))
            )}
          </select>
        </div>
      )}
    </div>
  );

  const LearnerFilterBar = () => (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={learnerSearch}
          onChange={(e) => setLearnerSearch(e.target.value)}
          placeholder="Search by learner name, phone number, or email..."
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        />
      </div>
      <select
        value={learnerCourseFilter}
        onChange={(e) => setLearnerCourseFilter(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none sm:w-64"
      >
        <option value="All">All Courses</option>
        {data?.courses.map((c) => (
          <option key={c.id} value={c.title}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Nav — All 14 menu items visible without scrolling on desktop */}
      <aside
        className={`${
          mobileNavOpen ? 'fixed inset-0 z-50 flex' : 'hidden'
        } lg:static lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200 bg-white`}
      >
        <div className="flex h-full w-64 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <button type="button" onClick={onGoHome} className="text-left">
              <BrandLogo compact />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close admin menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 px-2.5 py-2.5 space-y-0.5" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-left whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-3 space-y-1.5">
            <p className="truncate px-1 text-xs font-semibold text-slate-700">{user.email}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onGoHome}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Home className="h-3.5 w-3.5" />
                Site
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="flex-1 bg-slate-950/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-slate-700 hover:bg-slate-100"
              aria-label="Open admin menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-bold text-slate-900 truncate sm:text-lg">
              {NAV_ITEMS.find((n) => n.id === section)?.label || 'Administrator Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500">Administrator Console</span>
          </div>
        </header>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading administrator workspace...
            </div>
          ) : null}

          {/* 1. DASHBOARD OVERVIEW */}
          {data && section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Registered Learners', val: data.stats.total_learners },
                  { label: 'Enrolled Learners', val: data.stats.total_enrolled_learners },
                  { label: 'Total Courses', val: data.stats.total_courses },
                  { label: 'Pending Enrolments', val: data.stats.pending_enrolments },
                  { label: 'Submitted Work', val: data.stats.submitted_assignments },
                  { label: 'Unmarked Work', val: data.stats.unmarked_assignments },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                    <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900">{kpi.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Recent Enrolments</h2>
                    <button
                      type="button"
                      onClick={() => setSection('enrolments')}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="mt-4 divide-y divide-slate-100">
                    {data.enrolments.slice(0, 5).map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{e.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {e.course_title} · {e.phone}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono-num text-xs text-slate-500">
                          {formatShortDate(e.enrolled_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Assignments Awaiting Marking</h2>
                    <button
                      type="button"
                      onClick={() => setSection('marking')}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Open Marking
                    </button>
                  </div>
                  <div className="mt-4 divide-y divide-slate-100">
                    {data.submissions.filter((s) => s.marks_awarded === null).slice(0, 5).length === 0 ? (
                      <p className="py-4 text-sm text-slate-500">All submitted assignments have been marked.</p>
                    ) : (
                      data.submissions
                        .filter((s) => s.marks_awarded === null)
                        .slice(0, 5)
                        .map((s) => (
                          <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{s.student_name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {s.course_title} · {s.quiz_title}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSection('marking');
                                setMarkingTarget(s);
                                setMarkValue('');
                                setMarkFeedback('');
                              }}
                              className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                            >
                              Mark
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. COURSE MANAGEMENT */}
          {data && section === 'courses' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveCourse} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {editingCourse ? `Edit Course: ${editingCourse.title}` : 'Add New Course'}
                  </h2>
                  {editingCourse && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCourse(null);
                        setCourseTitle('');
                        setCourseAudience('');
                        setCourseDesc('');
                        setCoursePublished(true);
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Course Title</label>
                    <input
                      type="text"
                      required
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                      placeholder="e.g. AI Data Analytics"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Target Audience</label>
                    <input
                      type="text"
                      required
                      value={courseAudience}
                      onChange={(e) => setCourseAudience(e.target.value)}
                      placeholder="e.g. Analysts and Managers"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    required
                    value={courseDesc}
                    onChange={(e) => setCourseDesc(e.target.value)}
                    placeholder="Concise summary of course outcomes..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Course Image (JPG/PNG/WebP, Optional)
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCourseImageFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs text-slate-600"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={coursePublished}
                      onChange={(e) => setCoursePublished(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Published on Homepage
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <Plus className="h-4 w-4" />
                  {editingCourse ? 'Save Course Changes' : 'Add Course'}
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {data.courses.map((c) => (
                    <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-blue-700">{c.target_audience}</span>
                          <span className="text-slate-300">·</span>
                          <span className={c.is_published ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                            {c.is_published ? 'Published' : 'Unpublished'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono-num text-slate-500">{c.modules?.length || 0} modules</span>
                        </div>
                        <p className="mt-0.5 font-display text-sm font-bold text-slate-900">{c.title}</p>
                        <p className="text-xs text-slate-600 line-clamp-1">{c.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(c)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {c.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCourse(c);
                            setCourseTitle(c.title);
                            setCourseAudience(c.target_audience);
                            setCourseDesc(c.description);
                            setCoursePublished(Boolean(c.is_published));
                          }}
                          className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                          aria-label={`Edit ${c.title}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(c.id)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                          aria-label={`Delete ${c.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. MODULE MANAGEMENT */}
          {data && section === 'modules' && (
            <div className="space-y-6">
              <CourseModuleSelector showModule={false} />

              <form onSubmit={handleSaveModule} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {editingModId ? 'Edit Module' : `Add Module to ${activeCourse?.title || 'Course'}`}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Module Title</label>
                    <input
                      type="text"
                      required
                      value={modTitle}
                      onChange={(e) => setModTitle(e.target.value)}
                      placeholder="e.g. Module 3: Advanced Workflows"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Short Description</label>
                    <input
                      type="text"
                      value={modDesc}
                      onChange={(e) => setModDesc(e.target.value)}
                      placeholder="What learners cover in this module..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Plus className="h-4 w-4" />
                    {editingModId ? 'Update Module' : 'Add Module'}
                  </button>
                  {editingModId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingModId(null);
                        setModTitle('');
                        setModDesc('');
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {activeModules.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No modules in this course yet.</p>
                ) : (
                  activeModules.map((mod, idx) => (
                    <div key={mod.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-mono-num text-xs font-semibold text-blue-700">Order #{mod.order_index}</p>
                        <p className="font-display text-sm font-bold text-slate-900">{mod.title}</p>
                        {mod.description && <p className="text-xs text-slate-600">{mod.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveModule(mod.id, 'up')}
                          className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          title="Move Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === activeModules.length - 1}
                          onClick={() => handleMoveModule(mod.id, 'down')}
                          className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingModId(mod.id);
                            setModTitle(mod.title);
                            setModDesc(mod.description);
                          }}
                          className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModule(mod.id)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. VIDEO LESSONS */}
          {data && section === 'videos' && (
            <div className="space-y-6">
              <CourseModuleSelector />

              <form onSubmit={handleAddVideo} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900">Add Video Lesson</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Video Title</label>
                    <input
                      type="text"
                      required
                      value={vidTitle}
                      onChange={(e) => setVidTitle(e.target.value)}
                      placeholder="Lesson title"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Session Type</label>
                    <select
                      value={vidType}
                      onChange={(e) => setVidType(e.target.value as 'Live Session' | 'Recorded Session')}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Live Session">Live Session</option>
                      <option value="Recorded Session">Recorded Session</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Video Link (YouTube or URL)</label>
                    <input
                      type="url"
                      required
                      value={vidUrl}
                      onChange={(e) => setVidUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Short Description</label>
                  <input
                    type="text"
                    value={vidDesc}
                    onChange={(e) => setVidDesc(e.target.value)}
                    placeholder="Summary of what this video covers..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!activeModule}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Video Lesson
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {!activeModule || activeModule.videos.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No video lessons in this module yet.</p>
                ) : (
                  activeModule.videos.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-blue-700">{v.session_type}</p>
                        <p className="font-display text-sm font-bold text-slate-900">{v.title}</p>
                        <p className="truncate text-xs text-slate-500">{v.video_url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(v.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. NOTES AND RESOURCES */}
          {data && section === 'notes' && (
            <div className="space-y-6">
              <CourseModuleSelector />

              <form onSubmit={handleAddNote} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900">Upload Downloadable Notes</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Notes Title</label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g. Module Summary Slides"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Upload Document (PDF, DOC, DOCX, PPT, PPTX)
                    </label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Short Description</label>
                  <input
                    type="text"
                    value={noteDesc}
                    onChange={(e) => setNoteDesc(e.target.value)}
                    placeholder="Brief note description..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!activeModule}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Upload Notes
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {!activeModule || activeModule.notes.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No notes uploaded in this module yet.</p>
                ) : (
                  activeModule.notes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-mono-num text-xs font-semibold text-slate-500">{n.file_type}</p>
                        <p className="font-display text-sm font-bold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-600">{n.file_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => downloadProtectedFile(n.file_url, token, n.file_name)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. QUIZZES AND ASSIGNMENTS */}
          {data && section === 'quizzes' && (
            <div className="space-y-6">
              <CourseModuleSelector />

              <form onSubmit={handleAddQuiz} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900">Add Quiz / Assignment</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Quiz / Assignment Title</label>
                    <input
                      type="text"
                      required
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="e.g. Module Practical Assignment"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Upload Quiz Questions (Word or PDF)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setQuizFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Quiz Description</label>
                  <input
                    type="text"
                    required
                    value={quizDesc}
                    onChange={(e) => setQuizDesc(e.target.value)}
                    placeholder="Short overview of this assessment..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Detailed Instructions</label>
                  <textarea
                    rows={2}
                    value={quizInstructions}
                    onChange={(e) => setQuizInstructions(e.target.value)}
                    placeholder="Step-by-step instructions for learners..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!activeModule}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Quiz / Assignment
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {!activeModule || activeModule.quizzes.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No quizzes or assignments in this module yet.</p>
                ) : (
                  activeModule.quizzes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-mono-num text-xs text-slate-500">Max Marks: {q.max_marks}</p>
                        <p className="font-display text-sm font-bold text-slate-900">{q.title}</p>
                        <p className="text-xs text-slate-600">{q.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {q.question_file_url && (
                          <button
                            type="button"
                            onClick={() =>
                              downloadProtectedFile(q.question_file_url!, token, q.question_file_name || 'quiz.pdf')
                            }
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Download Questions
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuiz(q.id)}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 7. ASSIGNMENT SUBMISSIONS */}
          {data && section === 'submissions' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {data.submissions.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No learner assignment submissions yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Learner</th>
                      <th className="px-4 py-3">Course / Assignment</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{s.student_name}</p>
                          <p className="text-xs text-slate-500">{s.student_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{s.course_title}</p>
                          <p className="text-xs text-slate-500">{s.quiz_title}</p>
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-600">
                          {formatShortDate(s.submitted_at)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          {s.marks_awarded !== null ? (
                            <span className="text-emerald-700 font-mono-num">
                              Marked ({s.marks_awarded}/50)
                            </span>
                          ) : (
                            <span className="text-amber-700">Unmarked</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => downloadProtectedFile(s.file_url, token, s.file_name)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSection('marking');
                              setMarkingTarget(s);
                              setMarkValue(s.marks_awarded !== null ? String(s.marks_awarded) : '');
                              setMarkFeedback(s.feedback || '');
                            }}
                            className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            {s.marks_awarded !== null ? 'Edit Marks' : 'Mark'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 8. MARKING AND FEEDBACK */}
          {data && section === 'marking' && (
            <div className="space-y-6">
              {markingTarget && (
                <form
                  onSubmit={handleSaveMarks}
                  className="rounded-xl border border-blue-200 bg-white p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-blue-700">Trainer Evaluation (Max 50)</p>
                      <h2 className="font-display text-base font-bold text-slate-900">
                        {markingTarget.student_name} — {markingTarget.quiz_title}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {markingTarget.course_title} · {markingTarget.module_title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadProtectedFile(markingTarget.file_url, token, markingTarget.file_name)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {markingTarget.file_name}
                    </button>
                  </div>

                  {markingTarget.notes_text && (
                    <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      <span className="font-semibold">Learner Note:</span> {markingTarget.notes_text}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Marks Awarded (0 - 50)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        required
                        value={markValue}
                        onChange={(e) => setMarkValue(e.target.value)}
                        placeholder="e.g. 44"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Trainer Feedback / Comments
                      </label>
                      <input
                        type="text"
                        required
                        value={markFeedback}
                        onChange={(e) => setMarkFeedback(e.target.value)}
                        placeholder="Constructive trainer comments..."
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      Save & Publish Marks
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarkingTarget(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {data.submissions.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">No submissions available for marking yet.</p>
                ) : (
                  data.submissions.map((s) => (
                    <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-900">{s.student_name}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">{s.course_title}</span>
                          <span className="text-slate-300">·</span>
                          {s.marks_awarded !== null ? (
                            <span className="font-mono-num font-semibold text-emerald-700">
                              {s.marks_awarded} / 50
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700">Pending Marking</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{s.quiz_title}</p>
                        {s.feedback && <p className="mt-1 text-xs text-slate-600">Feedback: {s.feedback}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => downloadProtectedFile(s.file_url, token, s.file_name)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Download Submission
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMarkingTarget(s);
                            setMarkValue(s.marks_awarded !== null ? String(s.marks_awarded) : '');
                            setMarkFeedback(s.feedback || '');
                          }}
                          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          {s.marks_awarded !== null ? 'Update Marks' : 'Enter Marks'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 9. LEARNER MANAGEMENT (MANUAL ADD + SEARCH/FILTER) */}
          {data && section === 'learners' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddLearnerManually}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-900">Add Learner Manually</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newLearnerName}
                      onChange={(e) => setNewLearnerName(e.target.value)}
                      placeholder="Student full name"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Phone No</label>
                    <input
                      type="tel"
                      required
                      value={newLearnerPhone}
                      onChange={(e) => setNewLearnerPhone(e.target.value)}
                      placeholder="+2547..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      required
                      value={newLearnerEmail}
                      onChange={(e) => setNewLearnerEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <div className="relative mt-1">
                      <input
                        type={showNewLearnerPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newLearnerPassword}
                        onChange={(e) => setNewLearnerPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewLearnerPass((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                        aria-label={showNewLearnerPass ? 'Hide password' : 'Show password'}
                      >
                        {showNewLearnerPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Assign Course (Optional)</label>
                    <select
                      value={newLearnerCourseId}
                      onChange={(e) => setNewLearnerCourseId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">None yet</option>
                      {data.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Learner
                </button>
              </form>

              <LearnerFilterBar />

              {editingLearnerId && (
                <form
                  onSubmit={handleUpdateLearner}
                  className="rounded-xl border border-blue-200 bg-white p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Edit Learner Details</h2>
                    <button
                      type="button"
                      onClick={() => setEditingLearnerId(null)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Name</label>
                      <input
                        type="text"
                        required
                        value={editLearnerName}
                        onChange={(e) => setEditLearnerName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Phone no</label>
                      <input
                        type="tel"
                        required
                        value={editLearnerPhone}
                        onChange={(e) => setEditLearnerPhone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Email</label>
                      <input
                        type="email"
                        required
                        value={editLearnerEmail}
                        onChange={(e) => setEditLearnerEmail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Add Course (Optional)</label>
                      <select
                        value={editLearnerCourseId}
                        onChange={(e) => setEditLearnerCourseId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Keep current courses</option>
                        {data.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Save Learner Changes
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLearners.map((l) => {
                  const isActive = l.is_active !== 0;
                  return (
                    <div
                      key={l.id}
                      className={`flex flex-col justify-between rounded-xl border bg-white p-5 ${
                        isActive ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
                      }`}
                    >
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <span className="text-xs font-semibold text-slate-500">Student Account</span>
                          <span
                            className={`text-xs font-semibold ${
                              isActive ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</p>
                          <p className="font-display font-bold text-slate-900">{l.full_name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone no</p>
                          <p className="font-mono-num text-xs text-slate-800">{l.phone}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                          <p className="text-xs text-slate-800 break-all">{l.email}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Course</p>
                          <p className="text-xs font-medium text-blue-700">{l.enrolled_courses || 'Not enrolled yet'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date enrolled</p>
                          <p className="font-mono-num text-xs text-slate-700">{formatShortDate(l.created_at)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLearnerId(l.id);
                            setEditLearnerName(l.full_name);
                            setEditLearnerPhone(l.phone);
                            setEditLearnerEmail(l.email);
                            setEditLearnerCourseId('');
                          }}
                          title="Edit learner"
                          aria-label={`Edit ${l.full_name}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLearnerStatus(l.id, l.is_active)}
                          title={isActive ? 'Inactivate learner' : 'Activate learner'}
                          aria-label={isActive ? `Inactivate ${l.full_name}` : `Activate ${l.full_name}`}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            isActive
                              ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          {isActive ? 'Inactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLearner(l.id)}
                          title="Delete learner"
                          aria-label={`Delete ${l.full_name}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 10. ENROLMENT REQUESTS (Vertical learner details + Edit, Inactivate, Delete icons) */}
          {data && section === 'enrolments' && (
            <div className="space-y-6">
              <LearnerFilterBar />

              {editingLearnerId && (
                <form
                  onSubmit={handleUpdateLearner}
                  className="rounded-xl border border-blue-200 bg-white p-5 space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900">Edit Learner Details</h2>
                    <button
                      type="button"
                      onClick={() => setEditingLearnerId(null)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Name</label>
                      <input
                        type="text"
                        required
                        value={editLearnerName}
                        onChange={(e) => setEditLearnerName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Phone no</label>
                      <input
                        type="tel"
                        required
                        value={editLearnerPhone}
                        onChange={(e) => setEditLearnerPhone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Email</label>
                      <input
                        type="email"
                        required
                        value={editLearnerEmail}
                        onChange={(e) => setEditLearnerEmail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Save Learner Changes
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEnrolments.map((e) => {
                  const isActive = e.is_active !== 0;
                  return (
                    <div
                      key={e.id}
                      className={`flex flex-col justify-between rounded-xl border bg-white p-5 ${
                        isActive ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
                      }`}
                    >
                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <span
                            className={`text-xs font-semibold ${
                              e.status === 'Approved'
                                ? 'text-emerald-700'
                                : e.status === 'Pending'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                          >
                            {e.status}
                          </span>
                          <span className={`text-xs font-semibold ${isActive ? 'text-slate-600' : 'text-amber-700'}`}>
                            {isActive ? 'Account Active' : 'Account Inactive'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</p>
                          <p className="font-display font-bold text-slate-900">{e.full_name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone no</p>
                          <p className="font-mono-num text-xs text-slate-800">{e.phone}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                          <p className="text-xs text-slate-800 break-all">{e.email}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Course</p>
                          <p className="text-xs font-semibold text-blue-700">{e.course_title}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date enrolled</p>
                          <p className="font-mono-num text-xs text-slate-700">{formatShortDate(e.enrolled_at)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div>
                          {e.status !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleEnrolmentStatus(e.id, 'Approved')}
                              className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {e.user_id && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLearnerId(e.user_id!);
                                  setEditLearnerName(e.full_name);
                                  setEditLearnerPhone(e.phone);
                                  setEditLearnerEmail(e.email);
                                  setEditLearnerCourseId('');
                                }}
                                title="Edit learner"
                                aria-label={`Edit ${e.full_name}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleLearnerStatus(e.user_id!, e.is_active ?? 1)}
                                title={isActive ? 'Inactivate learner' : 'Activate learner'}
                                aria-label={isActive ? `Inactivate ${e.full_name}` : `Activate ${e.full_name}`}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                                  isActive
                                    ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEnrolment(e.id)}
                            title="Delete enrolment"
                            aria-label={`Delete enrolment for ${e.full_name}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 11. LEARNER PROGRESS */}
          {data && section === 'progress' && (
            <div className="space-y-6">
              <LearnerFilterBar />

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Learner</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Modules</th>
                      <th className="px-4 py-3">Videos / Notes</th>
                      <th className="px-4 py-3">Assignments / Marks</th>
                      <th className="px-4 py-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProgress.map((p) => (
                      <tr key={`${p.user_id}-${p.course_id}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{p.full_name}</p>
                          <p className="text-xs text-slate-500 font-mono-num">{p.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-800">{p.course_title}</td>
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-700">
                          {p.completed_modules}/{p.total_modules}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-700">
                          {p.videos_watched}/{p.total_videos} vid · {p.notes_accessed}/{p.total_notes} notes
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-700">
                          {p.assignments_submitted}/{p.total_quizzes} sub · {p.marks_awarded} pts
                        </td>
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-blue-700" style={{ width: `${p.percentage}%` }} />
                            </div>
                            <span className="font-mono-num text-xs font-semibold text-slate-900">
                              {p.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 12. TESTIMONIALS */}
          {data && section === 'testimonials' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveTestimonial}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-900">
                  {editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Learner Name"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value)}
                    placeholder="Role / Title"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={testOrg}
                    onChange={(e) => setTestOrg(e.target.value)}
                    placeholder="Organization (Optional)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  value={testQuote}
                  onChange={(e) => setTestQuote(e.target.value)}
                  placeholder="Testimonial quote..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    {editingTestimonial ? 'Update Testimonial' : 'Add Testimonial'}
                  </button>
                  {editingTestimonial && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTestimonial(null);
                        setTestName('');
                        setTestRole('');
                        setTestOrg('');
                        setTestQuote('');
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {data.testimonials.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        {t.author_name} · <span className="font-normal text-slate-600">{t.author_role}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-700">“{t.quote}”</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTestimonial(t);
                          setTestName(t.author_name);
                          setTestRole(t.author_role);
                          setTestOrg(t.organization);
                          setTestQuote(t.quote);
                        }}
                        className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 13. FAQ MANAGEMENT */}
          {data && section === 'faqs' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveFaq} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {editingFaq ? 'Edit FAQ' : 'Add FAQ'}
                </h2>
                <input
                  type="text"
                  required
                  value={faqQ}
                  onChange={(e) => setFaqQ(e.target.value)}
                  placeholder="Question"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  required
                  value={faqA}
                  onChange={(e) => setFaqA(e.target.value)}
                  placeholder="Answer"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    {editingFaq ? 'Update FAQ' : 'Add FAQ'}
                  </button>
                  {editingFaq && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFaq(null);
                        setFaqQ('');
                        setFaqA('');
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {data.faqs.map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">{f.question}</p>
                      <p className="mt-1 text-xs text-slate-600">{f.answer}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFaq(f);
                          setFaqQ(f.question);
                          setFaqA(f.answer);
                        }}
                        className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(f.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. WEBSITE SETTINGS */}
          {data && section === 'settings' && (
            <form onSubmit={handleSaveSettings} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900">Academy & Support Settings</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Academy Name</label>
                  <input
                    type="text"
                    value={settingsForm.academy_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, academy_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Hero Heading</label>
                  <input
                    type="text"
                    value={settingsForm.hero_heading}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hero_heading: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Hero Introduction</label>
                <textarea
                  rows={3}
                  value={settingsForm.hero_intro}
                  onChange={(e) => setSettingsForm({ ...settingsForm, hero_intro: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Support Email</label>
                  <input
                    type="text"
                    value={settingsForm.support_email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, support_email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">WhatsApp Support 1</label>
                  <input
                    type="text"
                    value={settingsForm.whatsapp_1}
                    onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp_1: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">WhatsApp Support 2</label>
                  <input
                    type="text"
                    value={settingsForm.whatsapp_2}
                    onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp_2: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Certificate Policy Note</label>
                <input
                  type="text"
                  value={settingsForm.certificate_note}
                  onChange={(e) => setSettingsForm({ ...settingsForm, certificate_note: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save Website Settings
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};
