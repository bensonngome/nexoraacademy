import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  ADMIN_EMAIL,
  type AuthenticatedRequest,
  createSessionToken,
  hashPassword,
  isValidHttpUrl,
  requireAdminMiddleware,
  requireAuthMiddleware,
  verifyPassword,
} from './server/auth.ts';
import { db, initDatabase, UPLOAD_DIRS, UPLOADS_ROOT } from './server/db.ts';
import type {
  AdminLearnerProgressRow,
  CourseModule,
  CourseProgress,
  NoteResource,
  QuizAssignment,
  QuizSubmission,
  VideoLesson,
} from './src/types.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '5mb' }));

function loadUserById(id: number) {
  const row = db
    .prepare('SELECT id, full_name, email, phone, role, is_active FROM users WHERE id = ?')
    .get(id) as
    | { id: number; full_name: string; email: string; phone: string; role: 'admin' | 'student'; is_active: number }
    | undefined;
  if (!row || row.is_active === 0) return null;
  return row;
}

const requireAuth = requireAuthMiddleware(loadUserById);
const requireAdmin = requireAdminMiddleware;

const DOC_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx']);
const QUIZ_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${Date.now()}-${base || 'file'}${ext}`;
}

function makeUploader(targetDir: string, allowedExts: Set<string>, maxMb = 20) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, targetDir),
      filename: (_req, file, cb) => cb(null, sanitizeFilename(file.originalname)),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExts.has(ext)) {
        cb(new Error(`Unsupported file type (${ext}). Allowed: ${Array.from(allowedExts).join(', ')}`));
        return;
      }
      cb(null, true);
    },
  });
}

const uploadCourseImage = makeUploader(UPLOAD_DIRS.courses, IMAGE_EXTENSIONS, 8);
const uploadNoteFile = makeUploader(UPLOAD_DIRS.notes, DOC_EXTENSIONS, 25);
const uploadQuizFile = makeUploader(UPLOAD_DIRS.quizzes, QUIZ_EXTENSIONS, 25);
const uploadSubmissionFile = makeUploader(UPLOAD_DIRS.submissions, QUIZ_EXTENSIONS, 25);

function getSiteSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

function getCourseModulesTree(courseId: number, userId?: number): CourseModule[] {
  const modules = db
    .prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC, id ASC')
    .all(courseId) as CourseModule[];

  const completedVideoIds = new Set<number>();
  const completedNoteIds = new Set<number>();
  const submissionByQuizId = new Map<number, QuizSubmission>();

  if (userId) {
    const progressRows = db
      .prepare('SELECT item_type, item_id FROM activity_progress WHERE user_id = ? AND course_id = ?')
      .all(userId, courseId) as { item_type: 'video' | 'note'; item_id: number }[];
    for (const p of progressRows) {
      if (p.item_type === 'video') completedVideoIds.add(p.item_id);
      if (p.item_type === 'note') completedNoteIds.add(p.item_id);
    }

    const subs = db
      .prepare('SELECT * FROM submissions WHERE user_id = ? AND course_id = ? ORDER BY submitted_at DESC')
      .all(userId, courseId) as QuizSubmission[];
    for (const s of subs) {
      if (!submissionByQuizId.has(s.quiz_id)) {
        submissionByQuizId.set(s.quiz_id, s);
      }
    }
  }

  return modules.map((mod) => {
    const videos = (
      db
        .prepare('SELECT * FROM videos WHERE module_id = ? ORDER BY order_index ASC, id ASC')
        .all(mod.id) as VideoLesson[]
    ).map((v) => ({
      ...v,
      completed: userId ? completedVideoIds.has(v.id) : false,
    }));

    const notes = (
      db
        .prepare('SELECT * FROM notes WHERE module_id = ? ORDER BY order_index ASC, id ASC')
        .all(mod.id) as NoteResource[]
    ).map((n) => ({
      ...n,
      completed: userId ? completedNoteIds.has(n.id) : false,
    }));

    const quizzes = (
      db
        .prepare('SELECT * FROM quizzes WHERE module_id = ? ORDER BY order_index ASC, id ASC')
        .all(mod.id) as QuizAssignment[]
    ).map((q) => ({
      ...q,
      submission: userId ? submissionByQuizId.get(q.id) || null : null,
    }));

    return {
      ...mod,
      videos,
      notes,
      quizzes,
    };
  });
}

function computeCourseProgressForUser(courseId: number, userId: number): CourseProgress | null {
  const course = db
    .prepare('SELECT id, title, description, image_url, target_audience FROM courses WHERE id = ?')
    .get(courseId) as
    | { id: number; title: string; description: string; image_url: string | null; target_audience: string }
    | undefined;
  if (!course) return null;

  const modules = getCourseModulesTree(courseId, userId);

  let totalVideos = 0;
  let videosWatched = 0;
  let totalNotes = 0;
  let notesAccessed = 0;
  let totalQuizzes = 0;
  let assignmentsSubmitted = 0;
  let assignmentsMarked = 0;
  let marksAwarded = 0;
  let completedModules = 0;

  for (const mod of modules) {
    totalVideos += mod.videos.length;
    totalNotes += mod.notes.length;
    totalQuizzes += mod.quizzes.length;

    const modVidDone = mod.videos.filter((v) => v.completed).length;
    const modNotesDone = mod.notes.filter((n) => n.completed).length;
    const modQuizzesSub = mod.quizzes.filter((q) => Boolean(q.submission)).length;
    const modQuizzesMarked = mod.quizzes.filter((q) => q.submission && q.submission.marks_awarded !== null).length;
    const modMarks = mod.quizzes.reduce((sum, q) => sum + (q.submission?.marks_awarded ?? 0), 0);

    videosWatched += modVidDone;
    notesAccessed += modNotesDone;
    assignmentsSubmitted += modQuizzesSub;
    assignmentsMarked += modQuizzesMarked;
    marksAwarded += modMarks;

    const modTotalItems = mod.videos.length + mod.notes.length + mod.quizzes.length;
    const modDoneItems = modVidDone + modNotesDone + modQuizzesSub;
    if (modTotalItems > 0 && modDoneItems === modTotalItems) {
      completedModules += 1;
    }
  }

  const totalItems = totalVideos + totalNotes + totalQuizzes;
  const doneItems = videosWatched + notesAccessed + assignmentsSubmitted;
  const percentage = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return {
    course_id: course.id,
    course_title: course.title,
    course_description: course.description,
    image_url: course.image_url,
    target_audience: course.target_audience,
    total_modules: modules.length,
    completed_modules: completedModules,
    total_videos: totalVideos,
    videos_watched: videosWatched,
    total_notes: totalNotes,
    notes_accessed: notesAccessed,
    total_quizzes: totalQuizzes,
    assignments_submitted: assignmentsSubmitted,
    assignments_marked: assignmentsMarked,
    marks_awarded: marksAwarded,
    percentage,
  };
}

// ==========================================
// PUBLIC BOOTSTRAP & COURSE DETAILS
// ==========================================

app.get('/api/public/bootstrap', (_req, res) => {
  const courses = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
       FROM courses c WHERE c.is_published = 1 ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();
  const testimonials = db
    .prepare('SELECT * FROM testimonials WHERE is_published = 1 ORDER BY id DESC')
    .all();
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all();
  const settings = getSiteSettings();
  res.json({ courses, testimonials, faqs, settings });
});

app.get('/api/public/courses/:id', (req, res) => {
  const courseId = Number(req.params.id);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({ error: 'Invalid course ID.' });
  }
  const course = db
    .prepare('SELECT * FROM courses WHERE id = ? AND is_published = 1')
    .get(courseId) as Record<string, unknown> | undefined;
  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }
  const modules = getCourseModulesTree(courseId);
  res.json({ ...course, modules });
});

// ==========================================
// AUTHENTICATION & ENROLMENT
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const loginMode = req.body?.loginMode === 'admin' ? 'admin' : 'any';

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/phone and password are required.' });
  }

  const user = db
    .prepare(
      'SELECT id, full_name, email, phone, password_hash, role, is_active, created_at FROM users WHERE LOWER(email) = LOWER(?) OR phone = ?'
    )
    .get(identifier, identifier) as
    | {
        id: number;
        full_name: string;
        email: string;
        phone: string;
        password_hash: string;
        role: 'admin' | 'student';
        is_active: number;
        created_at: string;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials. Please check your email and password.' });
  }

  if (user.is_active === 0) {
    return res.status(403).json({
      error: 'This student account is currently inactive. Please contact Nexora Digital Skills Academy support.',
    });
  }

  if (loginMode === 'admin' && (user.role !== 'admin' || user.email.toLowerCase() !== ADMIN_EMAIL)) {
    return res.status(403).json({ error: 'Administrator dashboard is restricted to the academy administrator account.' });
  }

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
    },
  });
});

app.post('/api/auth/register', (req, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName || !email || !phone || password.length < 6) {
    return res.status(400).json({
      error: 'Full name, email, phone number, and a password of at least 6 characters are required.',
    });
  }

  if (email === ADMIN_EMAIL) {
    return res.status(403).json({ error: 'This email address is reserved for academy administration.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const result = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(fullName, email, phone, hashPassword(password), 'student');

  const userId = Number(result.lastInsertRowid);
  const user = db
    .prepare('SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?')
    .get(userId) as {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    role: 'student';
    created_at: string;
  };

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.status(201).json({ token, user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (!email || !phone || newPassword.length < 6) {
    return res.status(400).json({
      error: 'Please enter your registered email, phone number, and a new password (min 6 characters).',
    });
  }
  if (email === ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Administrator credentials cannot be reset from this form.' });
  }

  const user = db
    .prepare('SELECT id, phone, role FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email) as { id: number; phone: string; role: string } | undefined;

  if (!user || user.role !== 'student' || user.phone.trim() !== phone) {
    return res.status(400).json({ error: 'No matching student account was found for that email and phone number.' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  res.json({ message: 'Your password has been updated. You can now sign in.' });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

app.post('/api/enrol', (req, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const courseId = Number(req.body?.course_id);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!fullName || !phone || !email || password.length < 6 || !Number.isInteger(courseId)) {
    return res.status(400).json({
      error: 'Full name, phone/WhatsApp number, email, password (min 6 chars), and course are required.',
    });
  }

  if (email === ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Please use a learner email address to enrol.' });
  }

  const course = db
    .prepare('SELECT id, title FROM courses WHERE id = ? AND is_published = 1')
    .get(courseId) as { id: number; title: string } | undefined;
  if (!course) {
    return res.status(404).json({ error: 'Selected course was not found.' });
  }

  let userRow = db
    .prepare('SELECT id, full_name, email, phone, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email) as
    | {
        id: number;
        full_name: string;
        email: string;
        phone: string;
        password_hash: string;
        role: 'student' | 'admin';
        created_at: string;
      }
    | undefined;

  if (userRow) {
    if (!verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({
        error: 'An account with this email already exists. Enter your existing password or sign in first.',
      });
    }
  } else {
    const uRes = db
      .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(fullName, email, phone, hashPassword(password), 'student');
    userRow = db
      .prepare('SELECT id, full_name, email, phone, password_hash, role, created_at FROM users WHERE id = ?')
      .get(Number(uRes.lastInsertRowid)) as typeof userRow;
  }

  if (!userRow) {
    return res.status(500).json({ error: 'Could not create student account.' });
  }

  const existingEnrol = db
    .prepare('SELECT id FROM enrolments WHERE user_id = ? AND course_id = ?')
    .get(userRow.id, courseId);

  if (!existingEnrol) {
    db.prepare(
      'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userRow.id, courseId, fullName, phone, email, message, 'Approved');
  }

  const token = createSessionToken({
    userId: userRow.id,
    email: userRow.email,
    role: userRow.role,
  });

  res.status(201).json({
    message: `Enrolment confirmed for ${course.title}. Your student dashboard is ready.`,
    token,
    user: {
      id: userRow.id,
      full_name: userRow.full_name,
      email: userRow.email,
      phone: userRow.phone,
      role: userRow.role,
      created_at: userRow.created_at,
    },
  });
});

// ==========================================
// SECURE FILE SERVING
// ==========================================

function resolveSafeUploadPath(bucketDir: string, filename: string): string | null {
  const safeName = path.basename(filename);
  const resolved = path.resolve(bucketDir, safeName);
  if (!resolved.startsWith(bucketDir + path.sep)) {
    return null;
  }
  return resolved;
}

app.get('/api/files/courses/:filename', (req, res) => {
  const filePath = resolveSafeUploadPath(UPLOAD_DIRS.courses, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found.' });
  }
  res.sendFile(filePath);
});

app.get('/api/files/notes/:filename', requireAuth, (req, res) => {
  const filePath = resolveSafeUploadPath(UPLOAD_DIRS.notes, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found.' });
  }
  res.download(filePath, path.basename(filePath));
});

app.get('/api/files/quizzes/:filename', requireAuth, (req, res) => {
  const filePath = resolveSafeUploadPath(UPLOAD_DIRS.quizzes, req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Quiz file not found.' });
  }
  res.download(filePath, path.basename(filePath));
});

app.get('/api/files/submissions/:filename', requireAuth, (req: AuthenticatedRequest, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = resolveSafeUploadPath(UPLOAD_DIRS.submissions, safeName);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Submission file not found.' });
  }

  if (req.authUser?.role !== 'admin') {
    const own = db
      .prepare('SELECT id FROM submissions WHERE user_id = ? AND file_url LIKE ?')
      .get(req.authUser?.id, `%${safeName}`);
    if (!own) {
      return res.status(403).json({ error: 'Access denied to this submission.' });
    }
  }
  res.download(filePath, safeName);
});

// ==========================================
// STUDENT DASHBOARD & LEARNING ROUTES
// ==========================================

app.get('/api/student/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.authUser!.id;
  const enrolments = db
    .prepare(
      `SELECT e.*, c.title as course_title
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ? AND e.status != 'Rejected'
       ORDER BY e.enrolled_at DESC`
    )
    .all(userId) as { course_id: number; status: string }[];

  const enrolledCourseIds = Array.from(new Set(enrolments.map((e) => e.course_id)));

  const enrolledCourses = enrolledCourseIds
    .map((cid) => {
      const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(cid) as Record<string, unknown> | undefined;
      if (!course) return null;
      const modules = getCourseModulesTree(cid, userId);
      const progress = computeCourseProgressForUser(cid, userId);
      return {
        ...course,
        modules,
        progress,
      };
    })
    .filter(Boolean);

  const progressList = enrolledCourseIds
    .map((cid) => computeCourseProgressForUser(cid, userId))
    .filter((p): p is CourseProgress => Boolean(p));

  const availableCourses = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as module_count
       FROM courses c WHERE c.is_published = 1 ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();

  res.json({
    enrolments,
    enrolledCourses,
    progressList,
    availableCourses,
  });
});

app.post('/api/student/enrol', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const courseId = Number(req.body?.course_id);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({ error: 'Valid course ID is required.' });
  }

  const course = db
    .prepare('SELECT id, title FROM courses WHERE id = ? AND is_published = 1')
    .get(courseId) as { id: number; title: string } | undefined;
  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  const existing = db
    .prepare('SELECT id FROM enrolments WHERE user_id = ? AND course_id = ?')
    .get(user.id, courseId);
  if (existing) {
    return res.json({ message: `You are already enrolled in ${course.title}.` });
  }

  db.prepare(
    'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, courseId, user.full_name, user.phone, user.email, 'Direct enrolment from student dashboard', 'Approved');

  res.status(201).json({ message: `Successfully enrolled in ${course.title}.` });
});

app.post('/api/student/progress', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.authUser!.id;
  const courseId = Number(req.body?.course_id);
  const moduleId = Number(req.body?.module_id);
  const itemType = req.body?.item_type;
  const itemId = Number(req.body?.item_id);
  const completed = req.body?.completed !== false;

  if (
    !Number.isInteger(courseId) ||
    !Number.isInteger(moduleId) ||
    !Number.isInteger(itemId) ||
    (itemType !== 'video' && itemType !== 'note')
  ) {
    return res.status(400).json({ error: 'Invalid progress payload.' });
  }

  if (req.authUser!.role !== 'admin') {
    const enrolled = db
      .prepare("SELECT id FROM enrolments WHERE user_id = ? AND course_id = ? AND status != 'Rejected'")
      .get(userId, courseId);
    if (!enrolled) {
      return res.status(403).json({ error: 'Please enrol in this course first.' });
    }
  }

  if (completed) {
    db.prepare(
      'INSERT OR IGNORE INTO activity_progress (user_id, course_id, module_id, item_type, item_id) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, courseId, moduleId, itemType, itemId);
  } else {
    db.prepare('DELETE FROM activity_progress WHERE user_id = ? AND item_type = ? AND item_id = ?').run(
      userId,
      itemType,
      itemId
    );
  }

  const progress = computeCourseProgressForUser(courseId, userId);
  res.json({ progress });
});

app.post(
  '/api/student/submissions',
  requireAuth,
  uploadSubmissionFile.single('file'),
  (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const quizId = Number(req.body?.quiz_id);
    const notesText = typeof req.body?.notes_text === 'string' ? req.body.notes_text.trim() : '';

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Valid quiz/assignment ID is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload your completed assignment as a PDF or Word document.' });
    }

    const quizInfo = db
      .prepare(
        `SELECT q.id, q.module_id, q.max_marks, m.course_id
         FROM quizzes q
         JOIN modules m ON m.id = q.module_id
         WHERE q.id = ?`
      )
      .get(quizId) as { id: number; module_id: number; max_marks: number; course_id: number } | undefined;

    if (!quizInfo) {
      return res.status(404).json({ error: 'Quiz/Assignment not found.' });
    }

    if (req.authUser!.role !== 'admin') {
      const enrolled = db
        .prepare("SELECT id FROM enrolments WHERE user_id = ? AND course_id = ? AND status != 'Rejected'")
        .get(userId, quizInfo.course_id);
      if (!enrolled) {
        return res.status(403).json({ error: 'You are not enrolled in this course.' });
      }
    }

    const fileUrl = `/api/files/submissions/${req.file.filename}`;
    const existing = db
      .prepare('SELECT id FROM submissions WHERE quiz_id = ? AND user_id = ?')
      .get(quizId, userId) as { id: number } | undefined;

    if (existing) {
      // Re-submission resets marks_awarded to NULL so trainer marks the updated submission manually
      db.prepare(
        `UPDATE submissions
         SET file_url = ?, file_name = ?, notes_text = ?, marks_awarded = NULL, feedback = NULL, marked_by = NULL, marked_at = NULL, submitted_at = datetime('now')
         WHERE id = ?`
      ).run(fileUrl, req.file.originalname, notesText, existing.id);
    } else {
      db.prepare(
        `INSERT INTO submissions (quiz_id, user_id, course_id, module_id, file_url, file_name, notes_text, marks_awarded, max_marks)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
      ).run(quizId, userId, quizInfo.course_id, quizInfo.module_id, fileUrl, req.file.originalname, notesText, quizInfo.max_marks);
    }

    const progress = computeCourseProgressForUser(quizInfo.course_id, userId);
    res.status(201).json({ message: 'Assignment submitted for trainer marking.', progress });
  }
);

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================

app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  const totalLearners = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'").get() as { cnt: number })
    .cnt;
  const totalEnrolledLearners = (
    db.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM enrolments WHERE status = 'Approved'").get() as {
      cnt: number;
    }
  ).cnt;
  const totalCourses = (db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number }).cnt;
  const pendingEnrolments = (
    db.prepare("SELECT COUNT(*) as cnt FROM enrolments WHERE status = 'Pending'").get() as { cnt: number }
  ).cnt;
  const submittedAssignments = (db.prepare('SELECT COUNT(*) as cnt FROM submissions').get() as { cnt: number }).cnt;
  const unmarkedAssignments = (
    db.prepare('SELECT COUNT(*) as cnt FROM submissions WHERE marks_awarded IS NULL').get() as { cnt: number }
  ).cnt;

  const coursesRaw = db.prepare('SELECT * FROM courses ORDER BY sort_order ASC, id ASC').all() as Record<
    string,
    unknown
  >[];
  const courses = coursesRaw.map((c) => ({
    ...c,
    modules: getCourseModulesTree(Number(c.id)),
  }));

  const learners = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
              GROUP_CONCAT(DISTINCT c.title) as enrolled_courses
       FROM users u
       LEFT JOIN enrolments e ON e.user_id = u.id AND e.status != 'Rejected'
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE u.role = 'student'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();

  const enrolments = db
    .prepare(
      `SELECT e.*, c.title as course_title, COALESCE(u.is_active, 1) as is_active
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.enrolled_at DESC, e.id DESC`
    )
    .all();

  const submissions = db
    .prepare(
      `SELECT s.*, u.full_name as student_name, u.email as student_email, u.phone as student_phone,
              q.title as quiz_title, c.title as course_title, m.title as module_title
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN quizzes q ON q.id = s.quiz_id
       JOIN courses c ON c.id = s.course_id
       JOIN modules m ON m.id = s.module_id
       ORDER BY (s.marks_awarded IS NULL) DESC, s.submitted_at DESC`
    )
    .all();

  const enrolledPairs = db
    .prepare(
      `SELECT e.user_id, e.course_id, e.enrolled_at, u.full_name, u.email, u.phone, c.title as course_title
       FROM enrolments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       WHERE e.status != 'Rejected' AND u.role = 'student'
       ORDER BY e.enrolled_at DESC`
    )
    .all() as {
    user_id: number;
    course_id: number;
    enrolled_at: string;
    full_name: string;
    email: string;
    phone: string;
    course_title: string;
  }[];

  const learnerProgress: AdminLearnerProgressRow[] = enrolledPairs
    .map((pair) => {
      const p = computeCourseProgressForUser(pair.course_id, pair.user_id);
      if (!p) return null;
      return {
        user_id: pair.user_id,
        full_name: pair.full_name,
        email: pair.email,
        phone: pair.phone,
        course_id: pair.course_id,
        course_title: pair.course_title,
        enrolled_at: pair.enrolled_at,
        total_modules: p.total_modules,
        completed_modules: p.completed_modules,
        videos_watched: p.videos_watched,
        total_videos: p.total_videos,
        notes_accessed: p.notes_accessed,
        total_notes: p.total_notes,
        assignments_submitted: p.assignments_submitted,
        assignments_marked: p.assignments_marked,
        total_quizzes: p.total_quizzes,
        marks_awarded: p.marks_awarded,
        percentage: p.percentage,
      };
    })
    .filter((x): x is AdminLearnerProgressRow => Boolean(x));

  const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all();
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all();
  const settings = getSiteSettings();

  res.json({
    stats: {
      total_learners: totalLearners,
      total_enrolled_learners: totalEnrolledLearners,
      total_courses: totalCourses,
      pending_enrolments: pendingEnrolments,
      submitted_assignments: submittedAssignments,
      unmarked_assignments: unmarkedAssignments,
    },
    courses,
    learners,
    enrolments,
    submissions,
    learnerProgress,
    testimonials,
    faqs,
    settings,
  });
});

// Courses CRUD
app.post('/api/admin/courses', requireAuth, requireAdmin, uploadCourseImage.single('image'), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const targetAudience = typeof req.body?.target_audience === 'string' ? req.body.target_audience.trim() : '';
  const isPublished = req.body?.is_published === 'false' || req.body?.is_published === false ? 0 : 1;

  if (!title || !description || !targetAudience) {
    return res.status(400).json({ error: 'Course title, description, and target audience are required.' });
  }

  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = `${baseSlug || 'course'}-${Date.now().toString().slice(-4)}`;
  const imageUrl = req.file
    ? `/api/files/courses/${req.file.filename}`
    : typeof req.body?.image_url === 'string' && req.body.image_url.trim()
      ? req.body.image_url.trim()
      : '/src/assets/images/course_ai_foundations_1795604358531.jpg';

  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM courses').get() as { m: number }).m;
  const result = db
    .prepare(
      'INSERT INTO courses (title, slug, description, target_audience, image_url, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(title, slug, description, targetAudience, imageUrl, isPublished, maxSort + 1);

  res.status(201).json({ id: Number(result.lastInsertRowid), message: 'Course created.' });
});

app.put('/api/admin/courses/:id', requireAuth, requireAdmin, uploadCourseImage.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as { image_url: string | null } | undefined;
  if (!existing) return res.status(404).json({ error: 'Course not found.' });

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const targetAudience = typeof req.body?.target_audience === 'string' ? req.body.target_audience.trim() : '';
  const isPublished = req.body?.is_published === 'false' || req.body?.is_published === false ? 0 : 1;

  if (!title || !description || !targetAudience) {
    return res.status(400).json({ error: 'Course title, description, and target audience are required.' });
  }

  const imageUrl = req.file ? `/api/files/courses/${req.file.filename}` : existing.image_url;
  db.prepare(
    'UPDATE courses SET title = ?, description = ?, target_audience = ?, image_url = ?, is_published = ? WHERE id = ?'
  ).run(title, description, targetAudience, imageUrl, isPublished, id);

  res.json({ message: 'Course updated.' });
});

app.patch('/api/admin/courses/:id/publish', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const isPublished = req.body?.is_published ? 1 : 0;
  db.prepare('UPDATE courses SET is_published = ? WHERE id = ?').run(isPublished, id);
  res.json({ message: 'Course visibility updated.' });
});

app.delete('/api/admin/courses/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  res.json({ message: 'Course deleted.' });
});

// Modules CRUD + Reorder
app.post('/api/admin/modules', requireAuth, requireAdmin, (req, res) => {
  const courseId = Number(req.body?.course_id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!Number.isInteger(courseId) || !title) {
    return res.status(400).json({ error: 'Course and module title are required.' });
  }
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(order_index), 0) as m FROM modules WHERE course_id = ?').get(courseId) as {
      m: number;
    }
  ).m;
  const r = db
    .prepare('INSERT INTO modules (course_id, title, description, order_index) VALUES (?, ?, ?, ?)')
    .run(courseId, title, description, maxOrder + 1);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'Module added.' });
});

app.put('/api/admin/modules/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!title) return res.status(400).json({ error: 'Module title is required.' });
  db.prepare('UPDATE modules SET title = ?, description = ? WHERE id = ?').run(title, description, id);
  res.json({ message: 'Module updated.' });
});

app.post('/api/admin/modules/:id/move', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const direction = req.body?.direction === 'up' ? 'up' : 'down';
  const mod = db.prepare('SELECT id, course_id, order_index FROM modules WHERE id = ?').get(id) as
    | { id: number; course_id: number; order_index: number }
    | undefined;
  if (!mod) return res.status(404).json({ error: 'Module not found.' });

  const siblings = db
    .prepare('SELECT id, order_index FROM modules WHERE course_id = ? ORDER BY order_index ASC, id ASC')
    .all(mod.course_id) as { id: number; order_index: number }[];
  const idx = siblings.findIndex((s) => s.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= siblings.length) {
    return res.json({ message: 'Already at boundary.' });
  }

  const swap = siblings[idx];
  siblings[idx] = siblings[targetIdx];
  siblings[targetIdx] = swap;

  const updateStmt = db.prepare('UPDATE modules SET order_index = ? WHERE id = ?');
  siblings.forEach((s, i) => updateStmt.run(i + 1, s.id));
  res.json({ message: 'Module order updated.' });
});

app.delete('/api/admin/modules/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM modules WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Module deleted.' });
});

// Videos CRUD
app.post('/api/admin/videos', requireAuth, requireAdmin, (req, res) => {
  const moduleId = Number(req.body?.module_id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const sessionType = req.body?.session_type === 'Live Session' ? 'Live Session' : 'Recorded Session';
  const videoUrl = typeof req.body?.video_url === 'string' ? req.body.video_url.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

  if (!Number.isInteger(moduleId) || !title || !isValidHttpUrl(videoUrl)) {
    return res.status(400).json({ error: 'Module, title, and a valid http/https video link are required.' });
  }

  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(order_index), 0) as m FROM videos WHERE module_id = ?').get(moduleId) as {
      m: number;
    }
  ).m;
  const r = db
    .prepare(
      'INSERT INTO videos (module_id, title, session_type, video_url, description, order_index) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(moduleId, title, sessionType, videoUrl, description, maxOrder + 1);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'Video lesson added.' });
});

app.delete('/api/admin/videos/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM videos WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Video lesson removed.' });
});

// Notes CRUD
app.post('/api/admin/notes', requireAuth, requireAdmin, uploadNoteFile.single('file'), (req, res) => {
  const moduleId = Number(req.body?.module_id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

  if (!Number.isInteger(moduleId) || !title || !req.file) {
    return res
      .status(400)
      .json({ error: 'Module, notes title, and a document file (PDF, DOC, DOCX, PPT, PPTX) are required.' });
  }

  const ext = path.extname(req.file.originalname).replace('.', '').toUpperCase() || 'PDF';
  const fileUrl = `/api/files/notes/${req.file.filename}`;
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(order_index), 0) as m FROM notes WHERE module_id = ?').get(moduleId) as {
      m: number;
    }
  ).m;

  const r = db
    .prepare(
      'INSERT INTO notes (module_id, title, description, file_url, file_name, file_type, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(moduleId, title, description, fileUrl, req.file.originalname, ext, maxOrder + 1);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'Notes uploaded.' });
});

app.delete('/api/admin/notes/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Notes deleted.' });
});

// Quizzes & Assignments CRUD
app.post('/api/admin/quizzes', requireAuth, requireAdmin, uploadQuizFile.single('file'), (req, res) => {
  const moduleId = Number(req.body?.module_id);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : description;

  if (!Number.isInteger(moduleId) || !title) {
    return res.status(400).json({ error: 'Module and quiz/assignment title are required.' });
  }

  const fileUrl = req.file ? `/api/files/quizzes/${req.file.filename}` : null;
  const fileName = req.file ? req.file.originalname : null;
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(order_index), 0) as m FROM quizzes WHERE module_id = ?').get(moduleId) as {
      m: number;
    }
  ).m;

  const r = db
    .prepare(
      'INSERT INTO quizzes (module_id, title, description, instructions, question_file_url, question_file_name, max_marks, order_index) VALUES (?, ?, ?, ?, ?, ?, 50, ?)'
    )
    .run(moduleId, title, description, instructions, fileUrl, fileName, maxOrder + 1);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'Quiz/assignment added.' });
});

app.delete('/api/admin/quizzes/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Quiz/assignment deleted.' });
});

// Assignment Marking (Strictly trainer-entered, max 50)
app.patch('/api/admin/submissions/:id/mark', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const marksAwarded = Number(req.body?.marks_awarded);
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';

  if (!Number.isFinite(marksAwarded) || marksAwarded < 0 || marksAwarded > 50) {
    return res.status(400).json({ error: 'Marks awarded must be between 0 and 50.' });
  }

  const sub = db.prepare('SELECT id FROM submissions WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });

  db.prepare(
    `UPDATE submissions
     SET marks_awarded = ?, feedback = ?, marked_by = ?, marked_at = datetime('now')
     WHERE id = ?`
  ).run(Math.round(marksAwarded), feedback, req.authUser!.full_name, id);

  res.json({ message: 'Marks and feedback saved and published to learner.' });
});

// Learners & Enrolments Management
app.post('/api/admin/learners', requireAuth, requireAdmin, (req, res) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const courseId = req.body?.course_id ? Number(req.body.course_id) : null;

  if (!fullName || !email || !phone || password.length < 6) {
    return res.status(400).json({
      error: 'Full name, email, phone number, and password (min 6 characters) are required.',
    });
  }
  if (email === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'Cannot add administrator email as a student.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A learner with this email already exists.' });
  }

  const r = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(fullName, email, phone, hashPassword(password), 'student');
  const userId = Number(r.lastInsertRowid);

  if (courseId && Number.isInteger(courseId)) {
    const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
    if (course) {
      db.prepare(
        'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, courseId, fullName, phone, email, 'Added manually by administrator', 'Approved');
    }
  }

  res.status(201).json({ id: userId, message: 'Learner account created.' });
});

app.put('/api/admin/learners/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const courseId = req.body?.course_id ? Number(req.body.course_id) : null;

  if (!fullName || !phone || !email) {
    return res.status(400).json({ error: 'Name, phone number, and email are required.' });
  }
  if (email === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'Cannot assign administrator email to a student.' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as
    | { id: number; role: string }
    | undefined;
  if (!user) return res.status(404).json({ error: 'Learner not found.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Cannot modify administrator account here.' });

  const conflict = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
    .get(email, id);
  if (conflict) {
    return res.status(409).json({ error: 'Another account already uses this email.' });
  }

  db.prepare('UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?').run(fullName, phone, email, id);
  db.prepare('UPDATE enrolments SET full_name = ?, phone = ?, email = ? WHERE user_id = ?').run(
    fullName,
    phone,
    email,
    id
  );

  if (courseId && Number.isInteger(courseId)) {
    const existingEnrol = db
      .prepare('SELECT id FROM enrolments WHERE user_id = ? AND course_id = ?')
      .get(id, courseId);
    if (!existingEnrol) {
      const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
      if (course) {
        db.prepare(
          'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, courseId, fullName, phone, email, 'Course added by administrator', 'Approved');
      }
    }
  }

  res.json({ message: 'Learner details updated.' });
});

app.patch('/api/admin/learners/:id/status', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const isActive = req.body?.is_active ? 1 : 0;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (!user) return res.status(404).json({ error: 'Learner not found.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Cannot inactivate administrator account.' });

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, id);
  res.json({ message: isActive ? 'Learner activated.' : 'Learner inactivated.' });
});

app.delete('/api/admin/learners/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
  if (!user) return res.status(404).json({ error: 'Learner not found.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete administrator account.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'Learner removed.' });
});

app.patch('/api/admin/enrolments/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== 'Approved' && status !== 'Pending' && status !== 'Rejected') {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  db.prepare('UPDATE enrolments SET status = ? WHERE id = ?').run(status, id);
  res.json({ message: `Enrolment marked as ${status}.` });
});

app.delete('/api/admin/enrolments/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM enrolments WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Enrolment deleted.' });
});

// Testimonials CRUD
app.post('/api/admin/testimonials', requireAuth, requireAdmin, (req, res) => {
  const authorName = typeof req.body?.author_name === 'string' ? req.body.author_name.trim() : '';
  const authorRole = typeof req.body?.author_role === 'string' ? req.body.author_role.trim() : '';
  const organization = typeof req.body?.organization === 'string' ? req.body.organization.trim() : '';
  const quote = typeof req.body?.quote === 'string' ? req.body.quote.trim() : '';
  if (!authorName || !authorRole || !quote) {
    return res.status(400).json({ error: 'Name, role, and testimonial quote are required.' });
  }
  const r = db
    .prepare(
      'INSERT INTO testimonials (author_name, author_role, organization, quote, is_published) VALUES (?, ?, ?, ?, 1)'
    )
    .run(authorName, authorRole, organization, quote);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'Testimonial added.' });
});

app.put('/api/admin/testimonials/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const authorName = typeof req.body?.author_name === 'string' ? req.body.author_name.trim() : '';
  const authorRole = typeof req.body?.author_role === 'string' ? req.body.author_role.trim() : '';
  const organization = typeof req.body?.organization === 'string' ? req.body.organization.trim() : '';
  const quote = typeof req.body?.quote === 'string' ? req.body.quote.trim() : '';
  if (!authorName || !authorRole || !quote) {
    return res.status(400).json({ error: 'Name, role, and testimonial quote are required.' });
  }
  db.prepare('UPDATE testimonials SET author_name = ?, author_role = ?, organization = ?, quote = ? WHERE id = ?').run(
    authorName,
    authorRole,
    organization,
    quote,
    id
  );
  res.json({ message: 'Testimonial updated.' });
});

app.delete('/api/admin/testimonials/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Testimonial deleted.' });
});

// FAQs CRUD
app.post('/api/admin/faqs', requireAuth, requireAdmin, (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required.' });
  }
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM faqs').get() as { m: number }).m;
  const r = db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)').run(question, answer, maxOrder + 1);
  res.status(201).json({ id: Number(r.lastInsertRowid), message: 'FAQ added.' });
});

app.put('/api/admin/faqs/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required.' });
  }
  db.prepare('UPDATE faqs SET question = ?, answer = ? WHERE id = ?').run(question, answer, id);
  res.json({ message: 'FAQ updated.' });
});

app.delete('/api/admin/faqs/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'FAQ deleted.' });
});

// Website Settings
app.put('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const allowedKeys = [
    'academy_name',
    'hero_heading',
    'hero_intro',
    'support_email',
    'whatsapp_1',
    'whatsapp_2',
    'certificate_note',
  ];
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const key of allowedKeys) {
    if (typeof req.body?.[key] === 'string') {
      upsert.run(key, req.body[key].trim());
    }
  }
  res.json({ message: 'Website settings saved.', settings: getSiteSettings() });
});

// Error handler for multer & upload errors
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload or request error.' });
  }
});

// ==========================================
// VITE / STATIC SERVING
// ==========================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`NeXORA AI Training Academy server running on http://0.0.0.0:${port}`);
    console.log(`Uploads directory: ${UPLOADS_ROOT}`);
  });
}

startServer();
