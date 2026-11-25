import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, User as UserIcon, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Course, User } from '../types';

export type SignInTab = 'student' | 'admin' | 'register' | 'forgot';

interface EnrolModalProps {
  isOpen: boolean;
  courses: Course[];
  initialCourseId?: number | null;
  onClose: () => void;
  onSuccess: (token: string, user: User, message: string) => void;
  onSwitchToSignIn: () => void;
}

export const EnrolModal: React.FC<EnrolModalProps> = ({
  isOpen,
  courses,
  initialCourseId,
  onClose,
  onSuccess,
  onSwitchToSignIn,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [courseId, setCourseId] = useState<string>(
    initialCourseId ? String(initialCourseId) : courses[0]?.id ? String(courses[0].id) : ''
  );
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setError('');
      if (initialCourseId) {
        setCourseId(String(initialCourseId));
      } else if (!courseId && courses[0]?.id) {
        setCourseId(String(courses[0].id));
      }
    }
  }, [isOpen, initialCourseId, courses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !phone.trim() || !email.trim() || password.length < 6 || !courseId) {
      setError('Please complete all required fields and choose a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{ token: string; user: User; message: string }>('/api/enrol', {
        method: 'POST',
        body: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          course_id: Number(courseId),
          message: message.trim(),
        },
      });
      setFullName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setMessage('');
      onSuccess(data.token, data.user, data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit enrolment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enrol-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="enrol-modal-title" className="font-display text-xl font-bold text-slate-900">
              Enrol at Nexora Digital Skills Academy
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Create your student account and access your selected programme right away.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close enrolment dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="enrol-name" className="block text-sm font-medium text-slate-800">
              Full Name <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="enrol-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Grace Wanjiku"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="enrol-phone" className="block text-sm font-medium text-slate-800">
                Phone / WhatsApp Number <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="enrol-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2547..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="enrol-email" className="block text-sm font-medium text-slate-800">
                Email Address <span className="text-red-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="enrol-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="enrol-password" className="block text-sm font-medium text-slate-800">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="enrol-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password (min 6 characters)"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="enrol-course" className="block text-sm font-medium text-slate-800">
              Select Course <span className="text-red-600">*</span>
            </label>
            <select
              id="enrol-course"
              required
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="" disabled>
                Choose a training programme
              </option>
              {courses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.title} ({c.target_audience})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enrol-message" className="block text-sm font-medium text-slate-800">
              Message (Optional)
            </label>
            <textarea
              id="enrol-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share your learning goals or questions..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Submitting Enrolment...' : 'Submit Enrolment'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="font-semibold text-blue-700 hover:underline"
            >
              Student Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

interface SignInModalProps {
  isOpen: boolean;
  initialTab?: SignInTab;
  onClose: () => void;
  onSuccess: (token: string, user: User) => void;
  onSwitchToEnrol: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  initialTab = 'student',
  onClose,
  onSuccess,
  onSwitchToEnrol,
}) => {
  const [tab, setTab] = useState<SignInTab>(initialTab);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Create account fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError('');
      setInfoMsg('');
      setPassword('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          password,
          loginMode: tab === 'admin' ? 'admin' : 'any',
        },
      });
      onSuccess(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: {
          full_name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword,
        },
      });
      onSuccess(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: {
          email: resetEmail.trim(),
          phone: resetPhone.trim(),
          new_password: resetPassword,
        },
      });
      setInfoMsg(data.message);
      setTab('student');
      setIdentifier(resetEmail.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="signin-modal-title" className="font-display text-xl font-bold text-slate-900">
              {tab === 'admin'
                ? 'Admin Log In'
                : tab === 'register'
                  ? 'Create Student Account'
                  : tab === 'forgot'
                    ? 'Reset Password'
                    : 'Student Sign In'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {tab === 'admin'
                ? 'Sign in with your administrator email and password.'
                : tab === 'register'
                  ? 'Sign up with your email and password to access your dashboard.'
                  : tab === 'forgot'
                    ? 'Verify your registered email and phone to set a new password.'
                    : 'Enter your email or phone number and password.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close sign in dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('student');
              setError('');
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'student' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('admin');
              setError('');
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        {infoMsg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
            {infoMsg}
          </div>
        )}

        {(tab === 'student' || tab === 'admin') && (
          <form onSubmit={handleSignIn} className="mt-4 space-y-4">
            <div>
              <label htmlFor="login-identifier" className="block text-sm font-medium text-slate-800">
                {tab === 'admin' ? 'Administrator Email' : 'Email or Phone Number'}
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-identifier"
                  type={tab === 'admin' ? 'email' : 'text'}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={tab === 'admin' ? 'admin@nexora.com' : 'you@example.com or +254...'}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-800">
                  Password
                </label>
                {tab === 'student' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setError('');
                    }}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Signing In...' : tab === 'admin' ? 'Open Admin Dashboard' : 'Sign In'}
            </button>

            {tab === 'student' && (
              <p className="text-center text-xs text-slate-500">
                New to Nexora Digital Skills Academy?{' '}
                <button
                  type="button"
                  onClick={onSwitchToEnrol}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Enrol in a Course
                </button>
              </p>
            )}
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-800">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your full name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-800">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-800">
                Phone / WhatsApp Number
              </label>
              <input
                id="reg-phone"
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+2547..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reg-pass" className="block text-sm font-medium text-slate-800">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgot} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-800">
                Registered Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reset-phone" className="block text-sm font-medium text-slate-800">
                Registered Phone Number
              </label>
              <input
                id="reset-phone"
                type="tel"
                required
                value={resetPhone}
                onChange={(e) => setResetPhone(e.target.value)}
                placeholder="+2547..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reset-pass" className="block text-sm font-medium text-slate-800">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="reset-pass"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
