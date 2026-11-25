export type UserRole = 'admin' | 'student';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active?: number;
  created_at: string;
}

export interface VideoLesson {
  id: number;
  module_id: number;
  title: string;
  session_type: 'Live Session' | 'Recorded Session';
  video_url: string;
  description: string;
  order_index: number;
  created_at: string;
  completed?: boolean;
}

export interface NoteResource {
  id: number;
  module_id: number;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  file_type: string;
  order_index: number;
  created_at: string;
  completed?: boolean;
}

export interface QuizSubmission {
  id: number;
  quiz_id: number;
  user_id: number;
  course_id: number;
  module_id: number;
  file_url: string;
  file_name: string;
  notes_text: string;
  marks_awarded: number | null;
  max_marks: number;
  feedback: string | null;
  marked_by: string | null;
  marked_at: string | null;
  submitted_at: string;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  quiz_title?: string;
  course_title?: string;
  module_title?: string;
}

export interface QuizAssignment {
  id: number;
  module_id: number;
  title: string;
  description: string;
  instructions: string;
  question_file_url: string | null;
  question_file_name: string | null;
  max_marks: number;
  order_index: number;
  created_at: string;
  submission?: QuizSubmission | null;
}

export interface CourseModule {
  id: number;
  course_id: number;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
  videos: VideoLesson[];
  notes: NoteResource[];
  quizzes: QuizAssignment[];
}

export interface Course {
  id: number;
  title: string;
  slug: string;
  description: string;
  target_audience: string;
  image_url: string | null;
  is_published: number;
  sort_order: number;
  created_at: string;
  modules?: CourseModule[];
  module_count?: number;
}

export interface Enrolment {
  id: number;
  user_id: number | null;
  course_id: number;
  full_name: string;
  phone: string;
  email: string;
  message: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  enrolled_at: string;
  course_title?: string;
}

export interface CourseProgress {
  course_id: number;
  course_title: string;
  course_description: string;
  image_url: string | null;
  target_audience: string;
  total_modules: number;
  completed_modules: number;
  total_videos: number;
  videos_watched: number;
  total_notes: number;
  notes_accessed: number;
  total_quizzes: number;
  assignments_submitted: number;
  assignments_marked: number;
  marks_awarded: number;
  percentage: number;
}

export interface Testimonial {
  id: number;
  author_name: string;
  author_role: string;
  organization: string;
  quote: string;
  is_published: number;
  created_at: string;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

export interface SiteSettings {
  academy_name: string;
  hero_heading: string;
  hero_intro: string;
  support_email: string;
  whatsapp_1: string;
  whatsapp_2: string;
  certificate_note: string;
}

export interface AdminOverviewStats {
  total_learners: number;
  total_enrolled_learners: number;
  total_courses: number;
  pending_enrolments: number;
  submitted_assignments: number;
  unmarked_assignments: number;
}

export interface AdminLearnerProgressRow {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  course_id: number;
  course_title: string;
  enrolled_at: string;
  total_modules: number;
  completed_modules: number;
  videos_watched: number;
  total_videos: number;
  notes_accessed: number;
  total_notes: number;
  assignments_submitted: number;
  assignments_marked: number;
  total_quizzes: number;
  marks_awarded: number;
  percentage: number;
}
