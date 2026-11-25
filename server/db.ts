import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ADMIN_EMAIL, hashPassword } from './auth.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
export const UPLOAD_DIRS = {
  courses: path.join(UPLOADS_ROOT, 'courses'),
  notes: path.join(UPLOADS_ROOT, 'notes'),
  quizzes: path.join(UPLOADS_ROOT, 'quizzes'),
  submissions: path.join(UPLOADS_ROOT, 'submissions'),
};

for (const dir of [DATA_DIR, UPLOADS_ROOT, ...Object.values(UPLOAD_DIRS)]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const db = new Database(path.join(DATA_DIR, 'nexora.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function writeMinimalPdf(filePath: string, title: string, lines: string[]) {
  if (fs.existsSync(filePath)) return;

  const contentLines = [
    'BT',
    '/F1 16 Tf',
    '54 740 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -26 Td',
  ];

  for (const line of lines) {
    contentLines.push(`(${escapePdfText(line)}) Tj`);
    contentLines.push('0 -18 Td');
  }
  contentLines.push('ET');

  const streamContent = contentLines.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  fs.writeFileSync(filePath, pdf, 'utf8');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin', 'student')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      image_url TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      session_type TEXT NOT NULL DEFAULT 'Recorded Session' CHECK(session_type IN ('Live Session', 'Recorded Session')),
      video_url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'PDF',
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      question_file_url TEXT,
      question_file_name TEXT,
      max_marks INTEGER NOT NULL DEFAULT 50,
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrolments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      course_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Approved' CHECK(status IN ('Approved', 'Pending', 'Rejected')),
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('video', 'note')),
      item_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, item_type, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      notes_text TEXT NOT NULL DEFAULT '',
      marks_awarded INTEGER,
      max_marks INTEGER NOT NULL DEFAULT 50,
      feedback TEXT,
      marked_by TEXT,
      marked_at TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      organization TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userCols.some((c) => c.name === 'is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }

  seedAdminAndSettings();
  seedInitialDataIfEmpty();
}

function seedAdminAndSettings() {
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'ADMIN2026';
  const existingAdmin = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(ADMIN_EMAIL) as
    | { id: number }
    | undefined;

  if (!existingAdmin) {
    db.prepare(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run('Academy Administrator', ADMIN_EMAIL, '+254183181744', hashPassword(defaultAdminPassword), 'admin');
  } else if (process.env.ADMIN_PASSWORD) {
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(
      hashPassword(defaultAdminPassword),
      'admin',
      existingAdmin.id
    );
  }

  const defaultSettings: Record<string, string> = {
    academy_name: 'Nexora Digital Skills Academy',
    hero_heading: 'Learn AI. Build Skills. Create Opportunities.',
    hero_intro:
      'Master practical artificial intelligence with structured programmes built for real work. Every course combines live sessions, recorded sessions, downloadable notes, and trainer-marked assignments so you build lasting capability.',
    support_email: 'nexoradigitalskillsacademy',
    whatsapp_1: '+254183181744',
    whatsapp_2: '+254756511077',
    certificate_note:
      'Certificates of Completion are issued to learners who complete all course modules and pass their trainer-evaluated assignments.',
  };

  const upsertSetting = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaultSettings)) {
    upsertSetting.run(k, v);
  }
  db.prepare(
    "UPDATE site_settings SET value = 'Nexora Digital Skills Academy' WHERE key = 'academy_name' AND value = 'NeXORA AI Training Academy'"
  ).run();
  db.prepare(
    "UPDATE faqs SET question = REPLACE(question, 'NeXORA AI Training Academy', 'Nexora Digital Skills Academy'), answer = REPLACE(answer, 'NeXORA AI Training Academy', 'Nexora Digital Skills Academy') WHERE question LIKE '%NeXORA AI Training Academy%' OR answer LIKE '%NeXORA AI Training Academy%'"
  ).run();
}

function seedInitialDataIfEmpty() {
  const courseCount = (db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number }).cnt;
  if (courseCount > 0) return;

  const starterCourses = [
    {
      title: 'AI Essentials',
      slug: 'ai-essentials',
      target_audience: 'Everyone',
      image_url: '/src/assets/images/course_ai_foundations_1795604358531.jpg',
      description:
        'Build confident everyday fluency with modern AI tools, structured prompting, safety practices, and practical workflows for work and daily productivity.',
      modules: [
        {
          title: 'Module 1: Understanding Modern AI & Prompt Craft',
          description: 'Learn how large language models work and how to write clear, reliable prompts for accurate outcomes.',
          videoTitle: 'Foundations of Practical AI & Prompt Structure',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=aircAruvnKk',
          noteTitle: 'AI Essentials Module 1 Study Guide',
          quizTitle: 'Assignment 1: Structured Prompting Workbook',
          quizInstructions:
            'Download the assignment brief, design five structured prompts tailored to a real task in your field, document the outputs, and upload your completed Word or PDF report.',
        },
        {
          title: 'Module 2: Everyday Productivity & Responsible AI Use',
          description: 'Apply AI to drafting, summarizing, organizing information, and verifying accuracy responsibly.',
          videoTitle: 'Daily AI Workflows & Fact-Checking Techniques',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=5sLYAQS9sWQ',
          noteTitle: 'Responsible AI Checklist & Templates',
          quizTitle: 'Assignment 2: Personal Productivity Workflow Plan',
          quizInstructions:
            'Map out a weekly workflow demonstrating how you integrate AI tools for notes, summaries, and decision preparation. Upload as PDF or DOCX.',
        },
      ],
    },
    {
      title: 'AI Content Creation',
      slug: 'ai-content-creation',
      target_audience: 'Content Creators',
      image_url: '/src/assets/images/course_ai_creative_1795604358063.jpg',
      description:
        'Produce engaging scripts, visual concepts, newsletters, and multi-channel media campaigns faster while preserving your authentic voice.',
      modules: [
        {
          title: 'Module 1: Story Frameworks & Voice Calibration',
          description: 'Train AI assistants to reflect your brand tone across articles, scripts, and social storytelling.',
          videoTitle: 'Voice Calibration & Scriptwriting with AI',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
          noteTitle: 'Creator Brand Voice Blueprint',
          quizTitle: 'Assignment 1: Multi-Platform Content Series',
          quizInstructions:
            'Create a 3-part content campaign script (video hook, carousel outline, and newsletter draft) using the brand voice template and submit as Word or PDF.',
        },
        {
          title: 'Module 2: Visual Direction & Media Production',
          description: 'Combine AI visual ideation, thumbnail planning, and audio scripting for polished releases.',
          videoTitle: 'Visual Storyboarding & Production Pipelines',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
          noteTitle: 'Visual Prompting & Storyboard Guide',
          quizTitle: 'Assignment 2: Visual Storyboard Submission',
          quizInstructions:
            'Compile a complete production storyboard with image prompts, scene notes, and captions in a single PDF or DOCX file.',
        },
      ],
    },
    {
      title: 'AI for Business',
      slug: 'ai-for-business',
      target_audience: 'Entrepreneurs',
      image_url: '/src/assets/images/course_ai_business_1795604358816.jpg',
      description:
        'Streamline operations, customer communication, market analysis, and financial planning with practical AI systems built for growing businesses.',
      modules: [
        {
          title: 'Module 1: AI Strategy & Operational Audits',
          description: 'Identify high-ROI workflows across sales, customer support, and administration.',
          videoTitle: 'Identifying High-Impact Business AI Use Cases',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=2ePf9rue1Ao',
          noteTitle: 'Business AI Readiness & ROI Matrix',
          quizTitle: 'Assignment 1: Business AI Opportunity Audit',
          quizInstructions:
            'Audit three operational bottlenecks in a real or sample business and propose practical AI interventions with expected time savings.',
        },
        {
          title: 'Module 2: Customer Experience & Proposals',
          description: 'Build standardized proposal templates, SOPs, and responsive client support playbooks.',
          videoTitle: 'Drafting Proposals, SOPs & Client Playbooks',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=JMUxmLyrhSk',
          noteTitle: 'SOP & Client Proposal Prompt Pack',
          quizTitle: 'Assignment 2: Standard Operating Procedure Pack',
          quizInstructions:
            'Download the case prompt and produce one complete client onboarding SOP and proposal summary in Word or PDF format.',
        },
      ],
    },
    {
      title: 'AI for Education',
      slug: 'ai-for-education',
      target_audience: 'Teachers and Students',
      image_url: '/src/assets/images/course_ai_foundations_1795604358531.jpg',
      description:
        'Design interactive lesson plans, personalized study guides, rubric builders, and ethical academic workflows for classrooms and self-study.',
      modules: [
        {
          title: 'Module 1: Lesson Planning & Differentiated Instruction',
          description: 'Create structured curricula, classroom activities, and adaptive explanations for diverse learners.',
          videoTitle: 'Designing Interactive Lessons & Study Guides',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=G2fqAlgmoPo',
          noteTitle: 'Educator Lesson Design Handbook',
          quizTitle: 'Assignment 1: Complete Lesson Unit Plan',
          quizInstructions:
            'Build a 2-week lesson unit or personal study roadmap complete with learning objectives and formative checks.',
        },
        {
          title: 'Module 2: Academic Integrity & Assessment Rubrics',
          description: 'Establish transparent guidelines for AI-assisted learning and clear grading criteria.',
          videoTitle: 'Building Clear Rubrics & Ethical Study Habits',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=aircAruvnKk',
          noteTitle: 'Academic AI Policy & Rubric Templates',
          quizTitle: 'Assignment 2: Assessment Rubric Submission',
          quizInstructions:
            'Download the template and submit a detailed grading rubric with feedback descriptors for a subject of your choice.',
        },
      ],
    },
    {
      title: 'AI Digital Marketing',
      slug: 'ai-digital-marketing',
      target_audience: 'Businesses',
      image_url: '/src/assets/images/course_ai_creative_1795604358063.jpg',
      description:
        'Plan data-backed ad campaigns, audience personas, SEO content briefs, and conversion-focused email funnels using modern AI marketing tools.',
      modules: [
        {
          title: 'Module 1: Audience Research & Campaign Positioning',
          description: 'Turn customer insights into targeted messaging, offers, and ad variations.',
          videoTitle: 'AI Customer Research & Messaging Angles',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=5sLYAQS9sWQ',
          noteTitle: 'Digital Campaign Positioning Guide',
          quizTitle: 'Assignment 1: Buyer Persona & Ad Copy Brief',
          quizInstructions:
            'Develop two buyer personas and three high-clarity ad copy variations for a chosen product or service.',
        },
        {
          title: 'Module 2: SEO Content & Email Nurture Funnels',
          description: 'Structure search-friendly content calendars and automated follow-up sequences.',
          videoTitle: 'Building SEO Briefs & Email Sequences',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
          noteTitle: 'SEO & Email Funnel Playbook',
          quizTitle: 'Assignment 2: 5-Email Conversion Sequence',
          quizInstructions:
            'Write and submit a complete 5-email nurture sequence with subject lines and calls to action.',
        },
      ],
    },
    {
      title: 'AI Automation',
      slug: 'ai-automation',
      target_audience: 'Professionals',
      image_url: '/src/assets/images/course_ai_automation_1795604358419.jpg',
      description:
        'Connect apps, spreadsheets, email triggers, and AI processing steps to eliminate repetitive manual work across teams.',
      modules: [
        {
          title: 'Module 1: Workflow Mapping & Trigger Architecture',
          description: 'Design dependable automation blueprints using webhooks, conditions, and structured outputs.',
          videoTitle: 'Designing Reliable AI Automation Pipelines',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
          noteTitle: 'Automation Architecture Reference Notes',
          quizTitle: 'Assignment 1: End-to-End Workflow Blueprint',
          quizInstructions:
            'Document a multi-step automation connecting form intake, AI classification, and notification routing.',
        },
        {
          title: 'Module 2: Error Handling & Human-in-the-Loop Controls',
          description: 'Build safeguards, approval checkpoints, and structured JSON formatting into live automations.',
          videoTitle: 'Adding Guardrails & Approval Checkpoints',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=2ePf9rue1Ao',
          noteTitle: 'Automation Testing & Reliability Guide',
          quizTitle: 'Assignment 2: Guardrail & Audit Report',
          quizInstructions:
            'Analyze potential failure modes in an automated workflow and submit your mitigation checklist as PDF or Word.',
        },
      ],
    },
    {
      title: 'AI Research Skills',
      slug: 'ai-research-skills',
      target_audience: 'Researchers',
      image_url: '/src/assets/images/course_ai_foundations_1795604358531.jpg',
      description:
        'Accelerate literature synthesis, source verification, structured data coding, and research writing without compromising scholarly rigor.',
      modules: [
        {
          title: 'Module 1: Literature Synthesis & Citation Verification',
          description: 'Use AI tools to organize papers, extract methodologies, and verify every primary source.',
          videoTitle: 'Structured Literature Reviews & Source Checks',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=G2fqAlgmoPo',
          noteTitle: 'Research Synthesis & Verification Manual',
          quizTitle: 'Assignment 1: Annotated Literature Matrix',
          quizInstructions:
            'Synthesize five peer-reviewed sources into a structured comparison matrix and verify all citations.',
        },
        {
          title: 'Module 2: Qualitative Coding & Executive Summaries',
          description: 'Extract themes from interview transcripts and translate findings into clear reports.',
          videoTitle: 'Thematic Coding & Research Brief Writing',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=JMUxmLyrhSk',
          noteTitle: 'Qualitative Analysis Prompt Guide',
          quizTitle: 'Assignment 2: Research Summary Brief',
          quizInstructions:
            'Submit a 2-page research summary translating technical findings for decision makers.',
        },
      ],
    },
    {
      title: 'AI Tools Training',
      slug: 'ai-tools-training',
      target_audience: 'Everyone',
      image_url: '/src/assets/images/course_ai_automation_1795604358419.jpg',
      description:
        'Hands-on guided walkthroughs across leading writing, spreadsheet, presentation, image, and meeting-assistant AI applications.',
      modules: [
        {
          title: 'Module 1: Choosing the Right AI Tool for Each Task',
          description: 'Compare leading AI workspaces for writing, research, coding, and document analysis.',
          videoTitle: 'Core AI Toolset Walkthrough & Comparison',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=aircAruvnKk',
          noteTitle: 'NeXORA AI Tools Directory & Matrix',
          quizTitle: 'Assignment 1: Tool Selection Case Study',
          quizInstructions:
            'Match five workplace scenarios to appropriate AI tools and justify your choices in a short PDF or DOCX.',
        },
        {
          title: 'Module 2: Documents, Spreadsheets & Presentations',
          description: 'Transform raw notes into clean slide decks, formulas, and structured documents.',
          videoTitle: 'AI for Docs, Sheets & Slide Decks',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=5sLYAQS9sWQ',
          noteTitle: 'Office & Workspace AI Cheat Sheet',
          quizTitle: 'Assignment 2: Presentation & Data Summary',
          quizInstructions:
            'Download the dataset brief and submit a structured executive slide outline in Word or PDF format.',
        },
      ],
    },
    {
      title: 'Digital Products Creation',
      slug: 'digital-products-creation',
      target_audience: 'Entrepreneurs and Creators',
      image_url: '/src/assets/images/course_ai_creative_1795604358063.jpg',
      description:
        'Turn your expertise into structured ebooks, template packs, toolkits, and mini-courses ready to package and sell online.',
      modules: [
        {
          title: 'Module 1: Validating & Outlining Your Digital Product',
          description: 'Identify audience pain points and structure a clear, high-value digital product.',
          videoTitle: 'Product Validation & Curriculum Structuring',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
          noteTitle: 'Digital Product Launch Blueprint',
          quizTitle: 'Assignment 1: Digital Product Concept Brief',
          quizInstructions:
            'Define your target buyer, problem solved, product format, and table of contents in a Word or PDF submission.',
        },
        {
          title: 'Module 2: Packaging, Pricing & Launch Assets',
          description: 'Create product previews, landing page copy, and delivery workflows.',
          videoTitle: 'Packaging & Positioning Digital Products',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=kCc8FmEb1nY',
          noteTitle: 'Pricing & Launch Checklist',
          quizTitle: 'Assignment 2: Product Launch Kit',
          quizInstructions:
            'Submit your product sales page copy and launch checklist for trainer review.',
        },
      ],
    },
    {
      title: 'AI Website Creation',
      slug: 'ai-website-creation',
      target_audience: 'Beginners and Professionals',
      image_url: '/src/assets/images/course_ai_business_1795604358816.jpg',
      description:
        'Plan, design, write, and launch responsive modern websites and landing pages rapidly with AI-assisted layout and code workflows.',
      modules: [
        {
          title: 'Module 1: Site Architecture, Wireframes & Copy',
          description: 'Structure clear navigation, conversion sections, and persuasive page copy before building.',
          videoTitle: 'Planning Website Structure & Copy with AI',
          sessionType: 'Live Session',
          videoUrl: 'https://www.youtube.com/watch?v=2ePf9rue1Ao',
          noteTitle: 'Website Architecture & Copywriting Notes',
          quizTitle: 'Assignment 1: Website Wireframe & Copy Deck',
          quizInstructions:
            'Submit a complete page-by-page wireframe outline and hero/services copy for a business or portfolio site.',
        },
        {
          title: 'Module 2: Building, Testing & Launching Responsive Pages',
          description: 'Assemble mobile-friendly sections, forms, and visual polish ready for publication.',
          videoTitle: 'Responsive Layout & Launch Readiness Check',
          sessionType: 'Recorded Session',
          videoUrl: 'https://www.youtube.com/watch?v=G2fqAlgmoPo',
          noteTitle: 'Mobile & Launch QA Checklist',
          quizTitle: 'Assignment 2: Launch Readiness Audit',
          quizInstructions:
            'Complete the website QA checklist for your project and upload your final review document.',
        },
      ],
    },
  ];

  const insertCourse = db.prepare(
    'INSERT INTO courses (title, slug, description, target_audience, image_url, is_published, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  const insertModule = db.prepare(
    'INSERT INTO modules (course_id, title, description, order_index) VALUES (?, ?, ?, ?)'
  );
  const insertVideo = db.prepare(
    'INSERT INTO videos (module_id, title, session_type, video_url, description, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertNote = db.prepare(
    'INSERT INTO notes (module_id, title, description, file_url, file_name, file_type, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertQuiz = db.prepare(
    'INSERT INTO quizzes (module_id, title, description, instructions, question_file_url, question_file_name, max_marks, order_index) VALUES (?, ?, ?, ?, ?, ?, 50, ?)'
  );

  starterCourses.forEach((course, cIdx) => {
    const cRes = insertCourse.run(
      course.title,
      course.slug,
      course.description,
      course.target_audience,
      course.image_url,
      cIdx + 1
    );
    const courseId = Number(cRes.lastInsertRowid);

    course.modules.forEach((mod, mIdx) => {
      const mRes = insertModule.run(courseId, mod.title, mod.description, mIdx + 1);
      const moduleId = Number(mRes.lastInsertRowid);

      insertVideo.run(
        moduleId,
        mod.videoTitle,
        mod.sessionType,
        mod.videoUrl,
        `${mod.sessionType} covering ${mod.title}. Watch the full walkthrough and mark completion in your dashboard.`,
        1
      );

      const noteFileName = `${course.slug}-module-${mIdx + 1}-notes.pdf`;
      const noteDiskPath = path.join(UPLOAD_DIRS.notes, noteFileName);
      writeMinimalPdf(noteDiskPath, `${course.title} - ${mod.noteTitle}`, [
        `Programme: ${course.title} (${course.target_audience})`,
        `Module: ${mod.title}`,
        '',
        'Key Learning Summary:',
        '1. Core concepts and structured workflow frameworks.',
        '2. Practical step-by-step templates for daily application.',
        '3. Quality verification checklist before publishing or submitting.',
        '',
        'Prepared by Nexora Digital Skills Academy.',
      ]);

      insertNote.run(
        moduleId,
        mod.noteTitle,
        `Downloadable PDF study guide and practical reference notes for ${mod.title}.`,
        `/api/files/notes/${noteFileName}`,
        noteFileName,
        'PDF',
        1
      );

      const quizFileName = `${course.slug}-module-${mIdx + 1}-assignment.pdf`;
      const quizDiskPath = path.join(UPLOAD_DIRS.quizzes, quizFileName);
      writeMinimalPdf(quizDiskPath, `${course.title} - ${mod.quizTitle}`, [
        `Programme: ${course.title}`,
        `Module: ${mod.title}`,
        '',
        'Assignment Instructions:',
        mod.quizInstructions.slice(0, 85),
        mod.quizInstructions.slice(85, 170),
        '',
        'Submission Format: Upload your completed Word (.doc/.docx) or PDF (.pdf) file.',
        'Your academy trainer will review and set your marks and feedback.',
      ]);

      insertQuiz.run(
        moduleId,
        mod.quizTitle,
        `Practical module assignment for ${mod.title}.`,
        mod.quizInstructions,
        `/api/files/quizzes/${quizFileName}`,
        quizFileName,
        1
      );
    });
  });

  const insertTestimonial = db.prepare(
    'INSERT INTO testimonials (author_name, author_role, organization, quote, is_published) VALUES (?, ?, ?, ?, 1)'
  );
  insertTestimonial.run(
    'Grace Wanjiku',
    'Operations Lead',
    'Savannah Retail Group',
    'Within three weeks of joining AI for Business, I automated our weekly supplier summaries and cut client proposal turnaround from two days to under two hours.'
  );
  insertTestimonial.run(
    'Daniel Ochieng',
    'Digital Creator & Educator',
    'BrightPath Media',
    'The combination of live sessions, clear downloadable notes, and personalized trainer feedback on every assignment made complex AI workflows easy to apply immediately.'
  );
  insertTestimonial.run(
    'Amina Hassan',
    'Research Analyst',
    'East Africa Policy Lab',
    'AI Research Skills gave me a disciplined workflow for literature synthesis and source verification that saved dozens of hours on our quarterly policy brief.'
  );

  const insertFaq = db.prepare(
    'INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)'
  );
  const initialFaqs = [
    [
      'What courses are currently available at Nexora Digital Skills Academy?',
      'We offer 10 structured training programmes: AI Essentials, AI Content Creation, AI for Business, AI for Education, AI Digital Marketing, AI Automation, AI Research Skills, AI Tools Training, Digital Products Creation, and AI Website Creation.',
    ],
    [
      'How do I enrol in a course?',
      'Click Enrol Now anywhere on the website, fill in your full name, WhatsApp/phone number, email address, password, and chosen course, and submit. Your student account is ready immediately so you can sign in and access your dashboard without waiting for an invitation.',
    ],
    [
      'How are lessons delivered and accessed?',
      'Lessons include live sessions, recorded sessions, downloadable notes (PDF, Word, and PowerPoint), and practical assignments. Once signed in, open any enrolled course from your Student Dashboard to access modules in order.',
    ],
    [
      'How do I submit my assignments?',
      'Inside each module, click Attempt Quiz on the assignment item to read instructions, download the assignment question document, complete your work in Word or PDF, and upload your completed file directly for trainer review.',
    ],
    [
      'How are assignment marks awarded?',
      'Every submitted assignment is reviewed individually by an academy trainer—never graded automatically. Your trainer evaluates your uploaded work, sets your marks, and writes personalized feedback visible in your Student Dashboard.',
    ],
    [
      'How can I track my learning progress?',
      'Your Student Dashboard tracks videos watched, notes accessed, assignments submitted, assignments marked, trainer marks received, and overall percentage progress separately for every enrolled course.',
    ],
    [
      'Do you offer certificates upon completion?',
      'Yes. Learners who complete all course modules and submit their practical assignments for trainer review qualify for a Nexora Digital Skills Academy Certificate of Completion.',
    ],
  ];
  initialFaqs.forEach(([q, a], idx) => insertFaq.run(q, a, idx + 1));

  // Seed a sample learner and sample enrolment/submission so Admin overview immediately demonstrates real data
  const sampleStudentPassword = hashPassword('Student2026!');
  const s1 = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run('Faith Muthoni', 'faith.muthoni@example.com', '+254712345678', sampleStudentPassword, 'student');
  const s2 = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run('Brian Kiprop', 'brian.kiprop@example.com', '+254723456789', sampleStudentPassword, 'student');

  db.prepare(
    'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(Number(s1.lastInsertRowid), 1, 'Faith Muthoni', '+254712345678', 'faith.muthoni@example.com', 'Excited to build practical AI fluency.', 'Approved');

  db.prepare(
    'INSERT INTO enrolments (user_id, course_id, full_name, phone, email, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(Number(s2.lastInsertRowid), 3, 'Brian Kiprop', '+254723456789', 'brian.kiprop@example.com', 'Looking forward to business AI automation.', 'Pending');
}
