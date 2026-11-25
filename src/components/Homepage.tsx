import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Search,
  TrendingUp,
  Video,
  X,
} from 'lucide-react';
import type { Course, FaqItem, SiteSettings, Testimonial, User } from '../types';
import type { SignInTab } from './AuthModals';
import { BrandLogo } from './BrandLogo';

interface HomepageProps {
  courses: Course[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  settings: SiteSettings;
  currentUser: User | null;
  enrolledCourseIds: number[];
  onOpenEnrol: (courseId?: number) => void;
  onOpenSignIn: (tab?: SignInTab) => void;
  onOpenDashboard: (courseId?: number) => void;
  onDirectEnrol: (courseId: number) => void;
  onViewCourse: (courseId: number) => void;
  onSignOut: () => void;
}

export const Homepage: React.FC<HomepageProps> = ({
  courses,
  testimonials,
  faqs,
  settings,
  currentUser,
  enrolledCourseIds,
  onOpenEnrol,
  onOpenSignIn,
  onOpenDashboard,
  onDirectEnrol,
  onViewCourse,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [openFaqId, setOpenFaqId] = useState<number | null>(faqs[0]?.id ?? null);

  const audienceOptions = useMemo(() => {
    const unique = Array.from(new Set(courses.map((c) => c.target_audience).filter(Boolean)));
    return ['All', ...unique];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesAudience = audienceFilter === 'All' || c.target_audience === audienceFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.target_audience.toLowerCase().includes(q);
      return matchesAudience && matchesSearch;
    });
  }, [courses, audienceFilter, searchQuery]);

  const handleCourseEnrolAction = (courseId: number) => {
    if (currentUser && currentUser.role === 'student') {
      if (enrolledCourseIds.includes(courseId)) {
        onOpenDashboard(courseId);
      } else {
        onDirectEnrol(courseId);
      }
    } else if (currentUser && currentUser.role === 'admin') {
      onOpenDashboard();
    } else {
      onOpenEnrol(courseId);
    }
  };

  const rawHeading = settings.hero_heading || 'Learn AI. Build Skills. Create Opportunities.';
  const headingParts = rawHeading.split('Create Opportunities.');
  const hasDefaultSplit = rawHeading.includes('Create Opportunities.');

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#top" className="whitespace-nowrap shrink-0">
            <BrandLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#top" className="hover:text-[#0B1F5B] transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#courses" className="hover:text-[#0B1F5B] transition-colors whitespace-nowrap shrink-0">
              Courses
            </a>
            <a href="#testimonials" className="hover:text-[#0B1F5B] transition-colors whitespace-nowrap shrink-0">
              Testimonials
            </a>
            <a href="#faqs" className="hover:text-[#0B1F5B] transition-colors whitespace-nowrap shrink-0">
              FAQs
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenDashboard()}
                  className="rounded-lg bg-[#0B1F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142F7A] transition-colors whitespace-nowrap shrink-0"
                >
                  {currentUser.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenSignIn('student')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onOpenEnrol()}
                  className="rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] transition-colors whitespace-nowrap shrink-0 shadow-xs"
                >
                  Enrol Now
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a href="#top" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Home
              </a>
              <a href="#courses" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Courses
              </a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Testimonials
              </a>
              <a href="#faqs" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                FAQs
              </a>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenDashboard();
                    }}
                    className="w-full rounded-lg bg-[#0B1F5B] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    {currentUser.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenEnrol();
                    }}
                    className="w-full rounded-lg bg-[#EA580C] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Enrol Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSignIn('student');
                    }}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/70 to-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="font-display text-sm font-bold tracking-wide text-[#EA580C]">
                {settings.academy_name || 'Nexora Digital Skills Academy'}
              </p>

              <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[#0B1F5B] sm:text-5xl lg:text-[3.35rem] text-balance leading-[1.08]">
                {hasDefaultSplit ? (
                  <>
                    <span>{headingParts[0]}</span>
                    <span className="bg-gradient-to-r from-[#1D4ED8] to-[#EA580C] bg-clip-text text-transparent">
                      Create Opportunities.
                    </span>
                  </>
                ) : (
                  rawHeading
                )}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {settings.hero_intro}
              </p>

              {/* Video, Notes, and Assignment each on its own line with its icon */}
              <div className="mt-6 flex flex-col space-y-3 border-t border-slate-200 pt-5 text-sm font-medium text-slate-800">
                <div className="flex items-center gap-3">
                  <Video className="h-4 w-4 shrink-0 text-[#1D4ED8]" />
                  <span>Video Lessons — Live sessions & Recorded sessions</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-[#D97706]" />
                  <span>Downloadable Notes — Structured PDF, Word & PowerPoint guides</span>
                </div>
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-4 w-4 shrink-0 text-[#059669]" />
                  <span>Assignments — Practical submissions with trainer marks & feedback</span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => onOpenDashboard()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F5B] px-6 py-3 text-sm font-semibold text-white hover:bg-[#142F7A] transition-colors shadow-sm"
                  >
                    {currentUser.role === 'admin' ? 'Open Admin Dashboard' : 'Go to My Dashboard'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenEnrol()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#EA580C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#C2410C] transition-colors shadow-sm"
                    >
                      Enrol Now
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenSignIn('student')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#0B1F5B] hover:bg-slate-50 transition-colors"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md aspect-[16/9] lg:aspect-auto lg:h-full min-h-[300px]">
                <img
                  src="/src/assets/images/hero_academy_learning_1795604358424.jpg"
                  alt="Nexora Digital Skills Academy modern learning studio"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Courses */}
      <section id="courses" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#0B1F5B] sm:text-3xl">
              Available Courses
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Structured AI training programmes featuring live sessions, recorded sessions, downloadable study notes, and practical assignments.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses or audience..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 w-fit max-w-full">
          {audienceOptions.map((aud) => (
            <button
              key={aud}
              type="button"
              onClick={() => setAudienceFilter(aud)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                audienceFilter === aud
                  ? 'bg-[#0B1F5B] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {aud}
            </button>
          ))}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-600">No programmes match your current search.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setAudienceFilter('All');
              }}
              className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
            >
              Show all courses
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledCourseIds.includes(course.id);
              return (
                <article
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                    {course.image_url ? (
                      <img
                        src={course.image_url}
                        alt={course.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <GraduationCap className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="text-[#1D4ED8]">{course.target_audience}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {course.module_count ?? 0} Module{course.module_count === 1 ? '' : 's'}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold text-[#0B1F5B]">{course.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-3">
                      {course.description}
                    </p>

                    <div className="mt-5 flex items-center gap-2.5 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onViewCourse(course.id)}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        View Course
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCourseEnrolAction(course.id)}
                        className={`flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap ${
                          isEnrolled
                            ? 'bg-[#0B1F5B] hover:bg-[#142F7A]'
                            : 'bg-[#EA580C] hover:bg-[#C2410C]'
                        }`}
                      >
                        {isEnrolled ? 'Continue Learning' : 'Enrol Now'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Why Learn with Nexora */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#0B1F5B] sm:text-3xl">
              Why Learn with Nexora?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              Built for clarity, real-world execution, and measurable skill progression from day one.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-6">
            <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
              <Layers className="h-5 w-5 text-[#EA580C]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F5B]">
                01. Practical AI Training
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Learn applied workflows you can immediately put to work in business, content creation, education, research, and automation.
              </p>
            </div>

            <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
              <GraduationCap className="h-5 w-5 text-[#1D4ED8]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F5B]">
                02. Step-by-Step Learning
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Every course is organized into sequential modules so beginners and experienced professionals build skills cleanly in order.
              </p>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
              <Video className="h-5 w-5 text-[#1D4ED8]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F5B]">
                03. Video Lessons & Notes
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Access live sessions, recorded sessions, and downloadable PDF, Word, and PowerPoint study notes inside every module.
              </p>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
              <ClipboardCheck className="h-5 w-5 text-[#059669]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F5B]">
                04. Practical Assignments
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Download assignment briefs, upload your completed Word or PDF solutions, and receive trainer-evaluated marks and written feedback.
              </p>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
              <TrendingUp className="h-5 w-5 text-[#EA580C]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F5B]">
                05. Trackable Learning Progress
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Monitor completed modules, videos watched, notes downloaded, and assignment results for each enrolled course in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#0B1F5B] sm:text-3xl">
            Learner Testimonials
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Outcomes shared by learners who completed Nexora Digital Skills Academy programmes.
          </p>
        </div>

        {testimonials.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Testimonials will appear here once published.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <blockquote
                key={t.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
              >
                <p className="text-sm leading-relaxed text-slate-700">“{t.quote}”</p>
                <footer className="mt-5 border-t border-slate-100 pt-4">
                  <p className="font-display text-sm font-bold text-[#0B1F5B]">{t.author_name}</p>
                  <p className="text-xs text-slate-500">
                    {t.author_role}
                    {t.organization ? ` · ${t.organization}` : ''}
                  </p>
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </section>

      {/* FAQs */}
      <section id="faqs" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#0B1F5B] sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Answers about enrolment, lessons, assignments, trainer marking, progress tracking, and certificates.
            </p>
          </div>

          <div className="mt-10 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/40">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="font-display text-sm font-semibold text-slate-900 sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-[#071336] text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <BrandLogo darkSurface />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
                Practical online AI training with live sessions, recorded lessons, downloadable notes, and trainer-evaluated assignments.
              </p>
            </div>

            <div className="md:col-span-3">
              <h3 className="font-display text-sm font-semibold text-white">Quick Links</h3>
              <ul className="mt-3.5 space-y-2 text-sm">
                <li>
                  <a href="#top" className="hover:text-white transition-colors">
                    Home
                  </a>
                </li>
                <li>
                  <a href="#courses" className="hover:text-white transition-colors">
                    Courses
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="hover:text-white transition-colors">
                    Testimonials
                  </a>
                </li>
                <li>
                  <a href="#faqs" className="hover:text-white transition-colors">
                    FAQs
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenSignIn('admin')}
                    className="text-left font-medium text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    Admin Log In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenSignIn('student')}
                    className="text-left hover:text-white transition-colors"
                  >
                    Student Sign In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenEnrol()}
                    className="text-left hover:text-white transition-colors"
                  >
                    Enrol Now
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <h3 className="font-display text-sm font-semibold text-white">Support Us</h3>
              <ul className="mt-3.5 space-y-2.5 text-sm">
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    Email:{' '}
                    <a
                      href={`mailto:${settings.support_email || 'nexoradigitalskillsacademy'}`}
                      className="text-white hover:underline"
                    >
                      {settings.support_email || 'nexoradigitalskillsacademy'}
                    </a>
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    WhatsApp Support 1:{' '}
                    <a
                      href={`https://wa.me/${(settings.whatsapp_1 || '+254183181744').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-num text-white hover:underline"
                    >
                      {settings.whatsapp_1 || '+254183181744'}
                    </a>
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    WhatsApp Support 2:{' '}
                    <a
                      href={`https://wa.me/${(settings.whatsapp_2 || '+254756511077').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-num text-white hover:underline"
                    >
                      {settings.whatsapp_2 || '+254756511077'}
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} Nexora Digital Skills Academy. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
