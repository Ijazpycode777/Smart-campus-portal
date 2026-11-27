// Database schema — creates all tables for the College Management ERP.
// Run with: node src/db/migrate.js
const { getDb } = require('./connection');

const SCHEMA_SQL = `
-- ============================================================
-- USERS — single auth table for all three roles
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hod_name TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- COURSES (programs) — e.g. B.Tech Computer Science
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department_id INTEGER,
  duration_years INTEGER DEFAULT 4,
  total_semesters INTEGER DEFAULT 8,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department_id INTEGER,
  credits INTEGER DEFAULT 3,
  semester INTEGER,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================================
-- TEACHERS — extension of users (role=teacher)
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  employee_id TEXT NOT NULL UNIQUE,
  department_id INTEGER,
  designation TEXT,
  qualification TEXT,
  specialization TEXT,
  join_date TEXT,
  salary REAL,
  experience_years INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE INDEX IF NOT EXISTS idx_teachers_dept ON teachers(department_id);

-- ============================================================
-- STUDENTS — extension of users (role=student)
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  roll_number TEXT NOT NULL UNIQUE,
  course_id INTEGER,
  department_id INTEGER,
  current_semester INTEGER DEFAULT 1,
  current_section TEXT,
  admission_date TEXT,
  batch_year INTEGER,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  blood_group TEXT,
  gender TEXT,
  dob TEXT,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_dept ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);

-- ============================================================
-- CLASSES / SECTIONS — a class is a section of a course in a semester
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  course_id INTEGER,
  semester INTEGER,
  section TEXT,
  class_teacher_id INTEGER,
  room TEXT,
  academic_year TEXT,
  capacity INTEGER DEFAULT 60,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (class_teacher_id) REFERENCES teachers(id)
);
CREATE INDEX IF NOT EXISTS idx_classes_course ON classes(course_id);

-- ============================================================
-- CLASS SUBJECTS — which subjects are taught in which class, by whom
-- ============================================================
CREATE TABLE IF NOT EXISTS class_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  teacher_id INTEGER,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- ============================================================
-- CLASS STUDENTS — enrollment
-- ============================================================
CREATE TABLE IF NOT EXISTS class_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  enrolled_on TEXT DEFAULT (datetime('now')),
  UNIQUE(class_id, student_id),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================
-- ATTENDANCE — one record per student per class per date
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
  marked_by INTEGER,
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(class_id, subject_id, student_id, date),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id, date);

-- ============================================================
-- EXAMINATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS examinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK(exam_type IN ('midterm','final','quiz','assignment','practical')),
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  total_marks REAL DEFAULT 100,
  passing_marks REAL DEFAULT 40,
  exam_date TEXT,
  academic_year TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================================
-- RESULTS — per student per exam
-- ============================================================
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  examination_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  marks_obtained REAL NOT NULL,
  grade TEXT,
  remarks TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(examination_id, student_id),
  FOREIGN KEY (examination_id) REFERENCES examinations(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);

-- ============================================================
-- FEE STRUCTURE — per course per semester
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  tuition_fee REAL DEFAULT 0,
  library_fee REAL DEFAULT 0,
  lab_fee REAL DEFAULT 0,
  examination_fee REAL DEFAULT 0,
  other_fee REAL DEFAULT 0,
  academic_year TEXT,
  UNIQUE(course_id, semester, academic_year),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============================================================
-- FEE INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  student_id INTEGER NOT NULL,
  semester INTEGER,
  academic_year TEXT,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  due_date TEXT,
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','partially_paid','paid','overdue')),
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON fee_invoices(status);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  transaction_id TEXT,
  payment_date TEXT DEFAULT (datetime('now')),
  recorded_by INTEGER,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

-- ============================================================
-- TIMETABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER,
  day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable(teacher_id);

-- ============================================================
-- NOTICES / ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK(category IN ('general','exam','event','holiday','fee','attendance','urgent')),
  target_audience TEXT DEFAULT 'all' CHECK(target_audience IN ('all','admin','teacher','student')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  posted_by INTEGER,
  is_pinned INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (posted_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notices_audience ON notices(target_audience, created_at);

-- ============================================================
-- NOTIFICATIONS — per-user inbox
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK(type IN ('info','success','warning','error','announcement')),
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at);

-- ============================================================
-- STUDY MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS study_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  subject_id INTEGER,
  class_id INTEGER,
  uploaded_by INTEGER,
  material_type TEXT DEFAULT 'document' CHECK(material_type IN ('document','video','link','assignment')),
  file_url TEXT,
  file_size INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_materials_class ON study_materials(class_id);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON study_materials(subject_id);

-- ============================================================
-- ASSIGNMENTS + SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  teacher_id INTEGER,
  due_date TEXT,
  total_marks REAL DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  submission_text TEXT,
  file_url TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  marks_obtained REAL,
  feedback TEXT,
  graded_by INTEGER,
  graded_at TEXT,
  UNIQUE(assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id)
);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  leave_type TEXT,
  start_date TEXT,
  end_date TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- ============================================================
-- ACTIVITY LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

function migrate() {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  // seed default settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  insertSetting.run('college_name', 'Northgate Institute of Technology');
  insertSetting.run('college_short_name', 'NIT');
  insertSetting.run('college_tagline', 'Excellence in Higher Education');
  insertSetting.run('academic_year', '2026-2027');
  insertSetting.run('currency_symbol', '₹');
  console.log('✓ Database schema created successfully.');
}

module.exports = { migrate, SCHEMA_SQL };
