# REST API

Base URL `/api`. JSON in/out. Authenticated calls send `Authorization: Bearer <accessToken>`.
Errors always look like `{ "error": { "code": "SESSION_LOCKED", "message": "...", "details": [...] } }`
(`422 VALIDATION_ERROR` lists `{path, message}` per field). Lists return `{ items, page, pageSize, total, totalPages }`
and accept `page`, `pageSize` (≤100), `q`, `sort`, `order`.
Roles: **A** admin · **M** monitor (own class only) · **S** student (own data only) · **\*** any signed-in user.

## Auth
| Method & path | Role | Notes |
|---|---|---|
| `POST /auth/login` | public | `{email,password}` → `{accessToken,user}` + refresh cookie. Rate limited. |
| `POST /auth/refresh` | cookie | rotates refresh token, returns new access token |
| `POST /auth/logout` | \* | revokes refresh token |
| `GET /auth/me` · `PATCH /auth/me` | \* | profile; patch `fullName`, `language` (`en`/`kh`), `theme` |
| `POST /auth/change-password` | \* | `{currentPassword,newPassword}`; signs the user out everywhere |
| `POST /auth/forgot-password` | public | always 200; link logged in dev (no SMTP bundled) |
| `POST /auth/reset-password` | public | `{token,newPassword}` |

## Students
| | Role | |
|---|---|---|
| `GET /students` | A, M | filters `q`, `classId`, `active`; monitors are scoped to their class |
| `GET /students/export?format=csv\|xlsx\|pdf` | A | same filters |
| `GET /students/:id` | A, M(own class), S(own id) | profile + statistics + recent records |
| `POST /students` | A | creates user + student (+ optional `classId`); returns `temporaryPassword` once if none supplied |
| `PUT /students/:id` | A | |
| `DELETE /students/:id[?permanent=true]` | A | deactivates; permanent only without attendance |
| `POST /students/import` | A | multipart `file` (.csv/.xlsx): `studentCode,fullName,email,gender,phone,classCode` → `{created,failed,errors,credentials}` |

## Classes, schedule, monitors
`GET /classes` (A all, M own) · `POST /classes` (A) · `GET /classes/:id` (A, M own) · `PUT /classes/:id` (A) · `DELETE /classes/:id[?permanent=true]` (A, archives by default)
`POST /classes/:id/students {studentIds[]}` · `DELETE /classes/:id/students/:studentId` (A)
`GET /classes/:id/schedule` (A, M own) · `POST /classes/:id/schedule` · `DELETE /classes/:id/schedule/:slotId` (A)
`GET|POST /monitors` · `PUT|DELETE /monitors/:id` (A) – body includes `classId` and permission flags `canPublishAnnouncements`, `canExportReports`, `canRequestCorrections`.

## Attendance
| Method & path | Role | Notes |
|---|---|---|
| `POST /attendance/sessions` | A, M | `{classId?,date,sessionNo,subject?,startTime?}`; monitors' `classId` is ignored (forced). `409 DUPLICATE_SESSION`, `400 DATE_IN_FUTURE` |
| `GET /attendance/sessions` | A, M | filters `classId,from,to,status`; includes status counts |
| `GET /attendance/sessions/:id` | A, M(own) | session + every class student with their record (or `null`) |
| `POST /attendance/sessions/:id/records` | A, M(own) | `{records:[{studentId,status,checkInTime?,remarks?}]}` bulk upsert while OPEN; `423 SESSION_LOCKED` after submit |
| `POST /attendance/sessions/:id/submit` | A, M(own) | marks unrecorded students ABSENT, locks session, notifies |
| `PUT /attendance/records/:id` | A, M(open sessions) | locked session: monitor → `423`, admin needs `reason` (audited, student notified) |
| `POST /attendance/corrections` | M, S | `{recordId,requestedStatus,reason}`; only for submitted sessions and own records |
| `GET /attendance/corrections` | \* | admin all · monitor own class · student own requests |
| `POST /attendance/corrections/:id/review` | A, M | `{decision:APPROVED\|REJECTED,note?}`; monitors may only review **students'** requests of their class |
| `GET /attendance/reports` | A, M | filters `from,to,classId,studentId,status,academicYearId,semesterId,period(day\|week\|month)` → summary, trend, per-student, per-class |
| `GET /attendance/reports/export?format=csv\|xlsx\|pdf` | A, M (`canExportReports`) | same filters |

Statuses: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`.

## Student portal (role S)
`GET /student/me` · `PATCH /student/me {phone,address}` · `GET /student/me/attendance` (`from,to,status`) · `GET /student/me/statistics` ·
`GET /student/me/calendar?month=YYYY-MM` · `GET /student/me/schedule`

## Admin & shared
`GET /admin/dashboard` · `GET /admin/analytics` · `GET /monitor/dashboard` (M)
`GET|POST /admin/users` · `PATCH /admin/users/:id {isActive}` · `PUT /admin/users/:id/role` · `POST /admin/users/:id/reset-password` · `GET /admin/audit-logs` (`action,entity,userId,from,to`; use `action=LOGIN` for login activity)
`GET /settings` (\*) · `PUT /settings` (A) · `GET /academic-years` (\*) · `POST|PUT|DELETE /academic-years[/:id]`, `POST|PUT|DELETE /academic-years/semesters[/:id]` (A)
`GET|POST|DELETE /announcements` (A all; M with permission, own class only) · `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all`
`GET /health`
