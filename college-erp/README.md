# 🎓 College Management ERP

A **premium, production-ready College Management ERP** built as a single-folder monolith with three distinct role-based portals — **Admin**, **Teacher**, and **Student** — all served from one unified codebase with a single login page.

> Built with Node.js + Express + SQLite + EJS. No build step, no external databases to provision — deploy to Render (or any Node host) in minutes.

---

## ✨ Highlights

- **One login page, three portals** — username/password is checked against the database, and the user is routed to their role's portal automatically.
- **Role-based access control** — every route and API endpoint is guarded by middleware; a student can never reach admin endpoints (returns 403).
- **Premium UI/UX** — custom design system with gradients, animations, glassmorphism, hand-drawn charts (line, bar, donut, progress rings, sparklines), responsive layout from mobile to desktop.
- **Real working features** — not a prototype. Forms validate, buttons work, charts reflect real DB data, notifications fire on real events.
- **15+ feature areas** — students, teachers, classes, courses, subjects, departments, timetable, attendance, examinations, results, fees, payments, notices, study materials, assignments, leave requests, activity log, analytics, settings.
- **Push-style notifications** — in-app notification center fires on announcements, attendance marks, exam results published, fee invoices generated, payments received.
- **Production-ready** — secure sessions, Helmet headers, rate limiting, bcrypt password hashing, audit logging, env-based config, Render Blueprint.

---

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18+ |
| Server | Express 4 |
| Database | SQLite via `better-sqlite3` (synchronous, fast, file-based) |
| Templating | EJS |
| Auth | Session-based with `bcryptjs` password hashing |
| Security | Helmet, express-rate-limit, httpOnly cookies, CSRF-safe same-site cookies |
| Charts | Custom vanilla-JS canvas/SVG library (no external CDN) |
| Styling | Hand-crafted CSS design system (no framework) |
| Deployment | Render Blueprint (`render.yaml`) |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18 or newer
- npm 8+

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and adjust if needed
cp .env.example .env

# 3. (Optional) Reset & seed the database with demo data
npm run db:reset

# 4. Start the server
npm start
```

Open **http://localhost:3000/login** in your browser.

### 🔑 Demo Credentials

| Role | Username | Password |
| --- | --- | --- |
| 👑 Admin | `admin` | `admin123` |
| 👨‍🏫 Teacher | `prof.sharma` | `teacher123` |
| 🎓 Student | `aarav.sharma1` | `student123` |

The seed creates **5 departments, 6 courses, 26 subjects, 6 teachers, 40 students**, plus realistic attendance, examinations, results, fee invoices, payments, timetables, notices, study materials and assignments.

---

## 🗂 Project Structure (Monolith)

```
college-erp/
├── src/
│   ├── server.js                 # Express app entry point
│   ├── db/
│   │   ├── connection.js         # SQLite connection management
│   │   ├── schema.js             # Full database schema (CREATE TABLE)
│   │   ├── seed.js                # Realistic demo data seeder
│   │   ├── migrate.js             # Run migrations only
│   │   ├── reset.js               # Drop + recreate + seed
│   │   └── seed-runner.js         # npm run db:seed entry
│   ├── middleware/
│   │   └── auth.js                # requireAuth + requireRole RBAC
│   ├── routes/
│   │   ├── pages/                 # EJS page routes (admin/teacher/student/auth/profile)
│   │   └── api/                   # JSON API routes (admin/teacher/student/auth/notifications)
│   └── utils/
│       ├── helpers.js             # Formatting, grading, audit log, notify
│       └── queries.js             # Reusable dashboard query layer
├── views/
│   ├── auth/login.ejs             # The single login page
│   ├── partials/                  # layout-top, layout-bottom, sidebar, topbar
│   ├── admin/                     # 17 admin views
│   ├── teacher/                   # 13 teacher views
│   ├── student/                   # 10 student views
│   ├── profile.ejs
│   └── errors/                    # 404, 403, 500
├── public/
│   ├── css/main.css               # Premium design system (~1000 lines)
│   └── js/app.js                  # Toasts, modals, charts, API helper
├── data/                          # SQLite database lives here (gitignored)
├── package.json
├── .env.example
├── .gitignore
├── render.yaml                    # Render Blueprint
└── README.md
```

---

## 🔐 Authentication & Role-Based Access

The auth flow is intentionally simple and secure:

1. **Single login page** at `/login` accepts a username (or email) + password.
2. The password is verified against the `users.password_hash` column using **bcrypt**.
3. On success, a session is created storing `userId`, `username`, `role`, `fullName`, `avatarColor`.
4. The user is redirected to `/admin`, `/teacher`, or `/student` based on their role.
5. Every portal route is wrapped in `requireRole('admin'|'teacher'|'student')` middleware — a student hitting `/admin/*` gets a 403.

### Security practices implemented
- **bcrypt** password hashing (salt rounds = 10)
- **httpOnly + same-site=lax** session cookies
- **Helmet** security headers
- **Rate limiting**: 300 req / 15 min globally, 20 attempts / 15 min on login
- **Audit log**: every meaningful action is recorded in `activity_log`
- **CSRF-safe**: state-changing operations use POST/PUT/DELETE with same-origin cookies
- **Input validation** on every API endpoint

---

## 📊 Feature Tour by Portal

### 👑 Admin Portal
- **Dashboard** — hero banner, 4 stat cards with sparklines, fee collection trend line chart, department distribution donut, student growth bar chart, fee-status progress ring, recent activity feed, latest notices, recently added students table.
- **Analytics** — 7 charts: department distribution, fee collection, student growth, attendance breakdown, grade distribution, gender distribution, course enrollment, plus top-students leaderboard.
- **Students** — searchable/filterable directory, add/edit/delete, per-student detail page with attendance ring, results, fees, classes.
- **Teachers** — directory with stats, add/edit/delete.
- **Classes** — card grid with capacity bars, class detail with student roster + subjects.
- **Courses, Subjects, Departments** — full CRUD.
- **Timetable** — weekly grid editor per class.
- **Examinations & Results** — exam catalog, ranked results per exam with grade distribution donut.
- **Fees** — invoice management, status filter pills, record payment modal, create invoice modal.
- **Payments** — transaction history with 6-month trend chart.
- **Notices** — post/edit/delete with priority, audience targeting, pinning.
- **Leave Requests** — approve/reject faculty & student leaves.
- **Activity Log** — full audit trail.
- **Settings** — institution name, academic year, currency.

### 👨‍🏫 Teacher Portal
- **Dashboard** — greeting, stat cards, today's timetable, pending submissions to grade, recent attendance sessions, notices.
- **My Classes** — assigned classes with student rosters and per-student attendance rings.
- **Timetable** — weekly grid highlighting today.
- **Attendance** — class + subject + date selector, radio buttons for present/absent/late/excused, bulk save, recent sessions list.
- **Examinations** — create exams, enter marks per student with auto-grade computation, publish results (fires notifications to students).
- **Assignments** — create assignments, view submissions, grade with feedback.
- **Study Materials** — upload materials (document/video/link/assignment), notify class students.
- **Students** — your students across classes with attendance %.
- **Notices, Leave Requests**.

### 🎓 Student Portal
- **Dashboard** — hero with course/sem/section, attendance ring, average marks, results count, fees due, today's timetable, recent results, upcoming assignments, notices, fee summary.
- **Timetable** — weekly grid.
- **Attendance** — big progress ring, monthly trend line chart, per-subject breakdown, recent records.
- **Results** — GPA + average, grade distribution donut, results table with color-coded grade badges.
- **Assignments** — tabs (Pending/Submitted/Graded), submit modal.
- **Study Materials** — browse by subject, type icons.
- **Fees** — collection progress ring, invoices table with Pay Now modal, payment history.
- **Notices, Leave Requests, Notifications**.

---

## 🔔 Notification System

Notifications fire automatically on real events:

| Event | Recipients |
| --- | --- |
| Notice posted | All users in target audience |
| Attendance marked absent | The absent student |
| Exam results published | Each student in the exam |
| Fee invoice created | The student |
| Payment received | The student + all admins |
| New study material uploaded | All students in the class |
| New assignment created | All students in the class |
| Assignment submitted | The teacher |
| Leave request submitted | All admins |

Each user has a notification dropdown in the topbar with unread badge count, and a dedicated notifications page.

---

## 🗄 Database Schema

23 tables covering the full domain. Key tables:

- `users` — single auth table for all roles (admin/teacher/student)
- `teachers`, `students` — profile extensions of `users`
- `departments`, `courses`, `subjects`, `classes`, `class_subjects`, `class_students`
- `attendance`, `examinations`, `results`
- `fee_structures`, `fee_invoices`, `payments`
- `timetable`, `notices`, `notifications`, `study_materials`, `assignments`, `assignment_submissions`
- `leave_requests`, `activity_log`, `settings`

Run `node src/db/migrate.js` to create all tables, or `node src/db/reset.js` for a clean rebuild with seed data. The full schema with all constraints, indexes and foreign keys is in `src/db/schema.js`.

---

## ☁️ Deployment on Render

This repo includes a `render.yaml` Blueprint for one-click deployment.

### Option A — Blueprint deploy (recommended)

1. Push this folder to a GitHub repo.
2. In Render dashboard → **New** → **Blueprint** → select your repo.
3. Render detects `render.yaml` and creates the web service automatically.
4. Set `SESSION_SECRET` to a long random string (or use `generateValue: true`).
5. The app auto-migrates and seeds on first boot.

### Option B — Manual web service

1. **New** → **Web Service** → connect your repo.
2. **Build Command**: `npm install`
3. **Start Command**: `node src/server.js`
4. **Environment variables** (see `.env.example`):
   - `NODE_ENV=production`
   - `SESSION_SECRET=<long random string>`
   - `DATABASE_PATH=/opt/data/college_erp.sqlite`
   - `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=admin123` (change in production!)
5. Attach a **Persistent Disk** (mount path `/opt/data`, 1GB) so the SQLite file survives redeploys.

### ⚠️ Persistence note

On Render's **free tier**, the filesystem is ephemeral — the SQLite database resets on every deploy/reboot. For real data persistence:
- Upgrade to a **paid plan** (Starter or higher)
- Attach a **Persistent Disk** at `/opt/data`
- Set `DATABASE_PATH=/opt/data/college_erp.sqlite`

The app auto-seeds demo data on first boot when no admin user is found, so it always starts in a usable state.

---

## 🔧 Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables secure cookies |
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | dev-only | **Set to a long random string in production** |
| `DATABASE_PATH` | `./data/college_erp.sqlite` | SQLite file path |
| `ADMIN_USERNAME` | `admin` | Default admin username (seeded on first boot) |
| `ADMIN_PASSWORD` | `admin123` | Default admin password (seeded on first boot) |
| `ADMIN_EMAIL` | `admin@college.edu` | Default admin email |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `300` | Max requests per window |

---

## 📜 npm Scripts

| Script | Action |
| --- | --- |
| `npm start` | Start the production server |
| `npm run db:migrate` | Create database tables only |
| `npm run db:seed` | Seed demo data (idempotent for users) |
| `npm run db:reset` | Drop DB file + recreate + seed |

---

## 🧪 Testing the App

The app was tested end-to-end:

✅ All 16 admin pages return 200
✅ All 13 teacher pages return 200
✅ All 10 student pages return 200
✅ Role isolation: student → `/admin` returns 403
✅ Login works for all three roles
✅ Admin can create students, teachers, notices, invoices, record payments
✅ Teacher can mark attendance, create exams, publish results, upload materials
✅ Student can pay fees, submit assignments, apply for leave
✅ Notifications fire on real events
✅ Invalid login is rejected
✅ CSS and JS assets serve correctly
✅ Charts and progress rings render with real data

To run your own smoke test:

```bash
# Start the server
npm start

# In another terminal, run a health check
curl http://localhost:3000/health
# → {"status":"ok","time":"..."}

# Then open http://localhost:3000/login and log in with the demo credentials.
```

---

## 📄 License

MIT — free to use, modify and deploy.

---

Built with ❤️ as a premium, production-ready College Management ERP.
