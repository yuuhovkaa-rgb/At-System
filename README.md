# AT System – Attendance Tracking System

Full-stack attendance platform for schools and universities with three roles (**Admin**, **Class Monitor**, **Student**),
English / Khmer interface and Light / Dark themes.

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form + Zod, i18next, Recharts, Lucide |
| Backend | Node.js 22, Express 4, TypeScript, Zod, Argon2, JWT (access token + rotating httpOnly refresh cookie) |
| Database | PostgreSQL 16 + Prisma ORM |
| Ops | Docker Compose, nginx |

> **Honest status – read this first.** The code in this repository was written in an offline sandbox that could not install npm
> packages or run PostgreSQL. What *was* verified there: TypeScript syntax of every file, the attendance-percentage / late-rule unit
> tests (executed), and English↔Khmer translation parity plus "every key used in code exists" (executed). What was **not** run:
> `npm install`, the TypeScript type-check, Prisma migrations, the API integration tests, the frontend build, and manual browser/mobile
> checks. Treat the first run on your machine as the real test: follow "Verify the installation" below and fix anything it reveals
> (see [docs/system-overview.md](docs/system-overview.md#known-limitations) for the full list of limitations).

## Required software

- Node.js ≥ 20 (22 recommended) and npm
- Docker Desktop (or Docker Engine) with Compose v2 – easiest way to run PostgreSQL
- (Optional) PostgreSQL 16 if you do not use Docker

## Option A – everything in Docker (quickest)

```bash
cp .env.example .env
# put two random 48-byte secrets into JWT_ACCESS_SECRET / JWT_REFRESH_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d --build
```

Open <http://localhost:8080>. On first start the demo school is seeded (`SEED_DEMO_DATA=true`). Set it to `false` for real use.

## Option B – local development

```bash
# 1. database (also creates a second DB "atsystem_test" for the tests)
docker compose up -d db

# 2. backend
cd backend
cp .env.example .env              # then edit the two JWT secrets
npm install
npx prisma generate
npx prisma migrate dev --name init   # creates prisma/migrations/ the first time – commit that folder
npm run seed                      # demo data (WIPES existing data)
npm run dev                       # API on http://localhost:4000

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173 (proxies /api to :4000)
```

If you prefer not to create migrations yet: `npx prisma db push` creates the tables directly from `schema.prisma`.

## Demo accounts (created by the seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@atsystem.test` | `Admin@12345` |
| Class Monitor | `monitor1@atsystem.test` (also `monitor2`, `monitor3`) | `Monitor@12345` |
| Student | `student1@atsystem.test` … `student36@…` | `Student@12345` |

The seed creates 3 classes, 36 students (some with Khmer names), ~4 weeks of attendance history, two at-risk students per class and an
**open session for today** so a monitor can immediately practise taking attendance. **Change or delete these accounts before going live.**

## Verify the installation (testing instructions)

```bash
cd backend
npm run typecheck                 # TypeScript type-check (not possible in the authoring sandbox)
npm run test:unit                 # pure logic tests – no database needed
npm run test:setup                # (re)creates the schema in TEST_DATABASE_URL
npm test                          # unit + API integration tests (auth, RBAC, privacy, attendance, corrections, reports, import/export)

cd ../frontend
npm run typecheck
npm test                          # translation parity + key coverage
npm run build
```

⚠️ The backend tests **delete all rows** of the database in `TEST_DATABASE_URL`. The test setup refuses to run unless the database
name contains `test`.

Manual checklist (not automatable here): sign in as each role and open every sidebar page; switch EN/KH (no reload, Khmer text renders);
toggle Light/Dark and reload (preference is remembered); resize to phone width (sidebar becomes a drawer, tables scroll horizontally);
take attendance → submit → check the student's view; request and approve a correction; export CSV/Excel/PDF.

## Production build

```bash
cd backend && npm run build && npm run prisma:deploy && npm start   # serves the API (NODE_ENV=production)
cd frontend && npm run build                                         # static files in frontend/dist (serve with nginx, see frontend/nginx.conf)
```

Production checklist: strong unique JWT secrets · HTTPS in front (cookie `secure` is automatic when `NODE_ENV=production`) ·
`CORS_ORIGIN` = your real origin · `SEED_DEMO_DATA=false` · committed Prisma migrations · regular database backups · an SMTP service
if you want password-reset e-mails (see limitations).

## Project structure

```
at-system/
├── backend/   src/{config,controllers,services,routes,middleware,validators,utils}  prisma/{schema.prisma,seed.ts}  tests/
├── frontend/  src/{components,layouts,pages,hooks,services,i18n,contexts,types,utils}  tests/
├── docs/      system-overview.md · database-design.md · api-documentation.md · user-guide.md
├── docker-compose.yml  .env.example  README.md
```

(`controllers/` hold the Express route handlers grouped per feature; `routes/index.ts` mounts them under `/api`.)
