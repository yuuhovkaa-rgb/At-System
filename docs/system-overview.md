# System overview

## Architecture
Browser (React SPA) → `/api` (Express) → Prisma → PostgreSQL. In Docker, nginx serves the SPA and proxies `/api` to the backend, so the
refresh cookie is same-origin. In development Vite proxies `/api` to `localhost:4000`.

## Roles and what the server enforces
Permissions are checked **on the server for every request** (`middleware/auth.ts`, `services/access.ts`); the frontend guards only
improve usability. The access token is verified, then the user is re-loaded from the database, so deactivation and role changes apply
immediately.

| Rule | Where |
|---|---|
| Student endpoints (`/api/student/*`) contain no id parameter – they always use the caller's own student row | `controllers/student.controller.ts` |
| `GET /api/students/:id` for a student only works for their own id; monitors only for students in their class | `assertStudentAccess` |
| Monitors are forced to their own class when creating sessions, listing sessions, reports and corrections | `assertClassAccess`, `visibleClassIds` |
| Admin-only: classes, monitors, users, settings, audit logs, imports, student CRUD | `requireRole('ADMIN')` |
| Submitted sessions are locked; monitors need a correction request, admins edit with a mandatory reason | `attendance.controller.ts` |
| Every attendance create/update/submit/correction writes an `audit_logs` row with before/after | `utils/audit.ts` |

## Attendance rules
- A session is unique per `(class, date, session number)`; a record is unique per `(session, student)` → duplicates are impossible
  (database constraints + 409 responses).
- Monitors save drafts; unmarked students stay **unrecorded**. On **submit**, students without a record become `ABSENT`
  ("Auto-marked absent on submit") and the session is locked. Only submitted sessions appear to students and in statistics/reports.
- Late-arrival rule (admin-configurable): if status is PRESENT and check-in is later than *session start + N minutes* it is stored as LATE.
- "Today" and date validation use the configured school timezone (default `Asia/Phnom_Penh`). Monitors cannot create future sessions.
- Percentage = `numerator / eligible × 100` where eligible = present + absent + late. Configurable (Settings page):
  - `excusedPolicy`: `EXCLUDE` (default, excused ignored) · `COUNT_AS_PRESENT` · `COUNT_AS_ABSENT`
  - `lateCountsAsPresent` (default true)
  - 0 eligible sessions → 0 %.

## Security measures
Argon2id password hashing · short-lived JWT access token (memory only) + rotating refresh token (httpOnly, SameSite=Strict, path `/api/auth`,
stored hashed) · login/forgot/reset rate limiting + global rate limit · Helmet headers · CORS allow-list · Zod validation on every body and
query · Prisma parameterised queries (no raw SQL) · generic login errors and constant-time-ish unknown-user path · password-reset tokens hashed,
1 h expiry, single use · spreadsheet formula-injection neutralised in exports · React escapes output (no `dangerouslySetInnerHTML`) ·
CSRF: no cookie-authenticated state-changing endpoint except `refresh`/`logout`, which are SameSite=Strict and JSON-only; all other calls need
the Bearer header.

## Internationalisation and theming
`frontend/src/i18n/{en,km}.json` is the single dictionary (350 keys). Backend notifications are stored as `type + params` and translated in
the browser, so they follow the current language. Language and theme are saved in `localStorage` and in the user's profile. Fonts: Inter +
Noto Sans Khmer (bundled through `@fontsource`, no external requests).

## Known limitations
1. **Not executed end-to-end by the author** – see the status note in the README. Expect to fix small type/runtime issues on first run.
2. **No migrations folder is included** (Prisma needs a database and its engines to generate it). Run `npx prisma migrate dev --name init` once and commit it.
3. **Password-reset e-mail is not sent** – no SMTP is bundled. In non-production the reset link is printed in the backend log. Wire `nodemailer`
   (or your provider) into `auth.controller.ts → forgot-password`.
4. **PDF export is Latin-only** (built-in PDF fonts cannot draw Khmer). Khmer text is exported correctly in CSV and Excel. Embed a Khmer TTF in `utils/export.ts` to fix.
5. Khmer translations were written without native-speaker review; have a Khmer speaker proofread `km.json` (especially long sentences).
6. shadcn/ui's CLI cannot run offline, so `components/ui` is a small hand-written set of shadcn-style primitives (same Tailwind approach).
7. Reports aggregate in memory (capped at 50 000 records per request) – fine for a school, use SQL aggregation for very large deployments.
8. One class per monitor; one active browser session per user (a new login replaces the stored refresh token).
9. No automated browser (E2E) or visual-regression tests; responsive/dark-mode checks are manual (checklist in the README).
10. Real-time updates are polling-based (notifications every 30 s).
