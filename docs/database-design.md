# Database design (PostgreSQL via Prisma – `backend/prisma/schema.prisma`)

All tables have `createdAt`/`updatedAt` (except the pure log tables, which only have `createdAt`). IDs are `cuid` strings (roles: serial int).

| Table | Purpose | Key constraints / indexes |
|---|---|---|
| `roles` | ADMIN / MONITOR / STUDENT | unique `name` |
| `users` | accounts (all roles), password hash, language/theme, refresh & reset token hashes | unique `email`; FK `roleId`; idx `roleId` |
| `students` | student profile (1:1 user) | unique `userId`, unique `studentCode` |
| `class_monitors` | monitor profile (1:1 user) + class assignment + permission flags | unique `userId`; FK `classId`; idx `classId` |
| `academic_years` | school years | unique `name` |
| `semesters` | semesters of a year | unique `(academicYearId, name)` |
| `classes` | classes (archivable) | unique `code`; FK year, semester |
| `class_students` | enrolment (N:M) | unique `(classId, studentId)`; idx `studentId` |
| `class_sessions` | weekly timetable slots (the schedule) | unique `(classId, dayOfWeek, sessionNo)` |
| `attendance_sessions` | one taking-of-attendance event | **unique `(classId, date, sessionNo)`**; idx `date`, `status` |
| `attendance_records` | one student's status in a session | **unique `(sessionId, studentId)`**; idx `studentId`, `status`; FK `recordedById` |
| `attendance_correction_requests` | requests to change a submitted record | idx `recordId`, `status` |
| `announcements` | school-wide (`classId` null) or per-class | idx `classId` |
| `notifications` | per-user, `type` + JSON `params`, read flag | idx `(userId, isRead)` |
| `audit_logs` | who/what/when with before/after JSON and IP | idx `(entity, entityId)`, `action`, `createdAt` |
| `system_settings` | key → JSON (school name, timezone, attendance rules) | PK `key` |

Relationships: `User 1─1 Student`, `User 1─1 ClassMonitor ─N:1─ Class`, `Class N:M Student` (via `class_students`),
`Class 1─N AttendanceSession 1─N AttendanceRecord N:1 Student`, `AttendanceRecord 1─N CorrectionRequest`.
Deleting a user cascades to its profile; attendance history blocks hard deletion (students are deactivated instead).

Dates (`date`, `startDate`, …) use `DATE`; the school timezone is applied when deciding what "today" is. Check-in/start times are `HH:mm` strings in school time.

Seed script: `npm run seed` (deterministic pseudo-random data, safe to re-run – it wipes first).
