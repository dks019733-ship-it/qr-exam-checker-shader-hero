# QR Exam Checker

Starter architecture for a production-oriented exam checking platform.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui structure
- Framer Motion + lucide-react
- NextAuth Google OAuth
- Prisma + PostgreSQL
- Google Drive OAuth scope (`drive.file`)

## Run

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

## Google OAuth

Create an OAuth 2.0 Web application in Google Cloud Console. Add the callback:

`http://localhost:3000/api/auth/callback/google`

Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET`.

## AI exam to Google Forms

Teachers can review and approve an AI-generated exam, then create a published Google Forms quiz with answer keys and points. The form also asks for the student's student number. Enable **Google Forms API** in the same Google Cloud project used by the OAuth client. Creating forms requires the `forms.body` OAuth scope; syncing responses separately requires the read-only `forms.responses.readonly` scope. After changing OAuth scopes, teachers must sign out and sign in again to grant them.

After pulling a version that adds the `GoogleForm` Prisma model, run `npx prisma db push` and `npx prisma generate` against the intended database. Then restart the app. In AI materials, open an exam, review and approve it, and use **สร้าง Google Form ให้นักเรียนทำ**. The teacher can open the edit link or share the responder link shown on that page.

## AI features

The teacher AI workspace lives inside the authenticated QR Exam Checker dashboard. It uses the existing Google login and PostgreSQL/Prisma account, so teachers do not need a second sign-in. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in the server environment. Keep the Gemini key server-side; never use a `NEXT_PUBLIC_` variable for it.

After pulling a version that changes `prisma/schema.prisma`, run `npx prisma db push` once against the intended database before using AI chat or materials. AI-generated exams and documents are saved as drafts. Teachers must review and approve each draft before Word/PDF export is available.

The app requests `drive.file`, which is intentionally narrower than full Drive access. Drive integration should create and manage only files/folders created or opened by this app.

## Security rules
1. Every server-side query must scope by authenticated `user.id`.
2. Never trust `ownerId`, `classId`, `examId`, or `studentId` from the client without re-checking ownership.
3. Store Google refresh tokens server-side only; never expose them to browser code.
4. Do not auto-confirm ambiguous OCR/OMR results.
5. Keep audit history for score edits/confirmation before enabling destructive deletion.
6. Prefer archive/soft-delete workflows for exam data.

## 21st.dev component
`components/ui/prisma-hero.tsx` is adapted from the supplied 21st.dev Prisma Hero component. The visual language was changed to match QR Exam Checker while retaining the component's animation approach.


## Answer sheet editor

`/dashboard/answer-sheet` adds the first production-oriented answer-sheet workflow:
- Edit school name and school logo.
- Edit exam title, subject, class, and question count.
- Import student number + name in CSV/TSV-style rows.
- Preview an individual student's sheet and print/save it as PDF.
- All API queries are scoped to the authenticated owner.

The logo is validated as PNG/JPEG/WebP and limited to 500 KB. It is stored with the owner-scoped answer-sheet template so it does not depend on a public upload directory.


## Merged UX + Shader build
This package combines the UX-complete branch with the Shader Hero branch.
- The Shader Hero remains the visual landing-page direction.
- The UX-complete dashboard and answer-sheet editor are retained.
- Student, classroom, answer-sheet template, ownership checks, and API routes are retained.
- The answer-sheet editor supports school logo/name, exam title, subject, class, question count, student name/ID, and QR token preview.
- The OMR scanner, Google Drive file operations, exports, backup/recovery, and production hardening remain planned implementation work rather than mocked as complete.


## Vercel deployment readiness

The project is prepared for a Vercel + PostgreSQL deployment. Vercel should use the `build` script, which runs `prisma generate` before `next build`. The `postinstall` script also generates the Prisma client after dependencies are installed.

### Environment variables required on Vercel

- `DATABASE_URL` — production PostgreSQL connection string
- `AUTH_SECRET` — long random secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `NEXT_PUBLIC_APP_URL` — deployed HTTPS URL
- `GOOGLE_DRIVE_APP_FOLDER_NAME` — optional folder name

### Google OAuth redirect URI

For a deployed domain, configure the Google OAuth client with:
`https://YOUR-DOMAIN/api/auth/callback/google`

### Current status

Deployment scaffolding is ready, but production Google credentials and a production PostgreSQL database must be supplied outside source control. The OMR scanner, real Google Drive file workflow, review/confirmation workflow, exports, and backup/recovery are not yet complete and should not be represented as production-ready.


## System Guardian and LINE task queue

System Guardian is an owner-only operational monitor. It currently supports:
- Database readiness checks and incident history.
- A persistent task queue for the allowlisted `SYSTEM_HEALTH_CHECK` operation only.
- Task states `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, and `CANCELLED`, with a persisted event timeline.
- Owner-only web controls to enqueue a health check and cancel a task only while it remains queued.
- LINE one-to-one commands from the configured owner account: `ช่วยเหลือ`, `ตรวจสอบระบบ`, `สถานะระบบ`, `สถานะการซ่อม`, `วิเคราะห์ปัญหาล่าสุด`, `ลองงานที่ล้มเหลวใหม่`, and `หยุดงาน`.
- A cron worker that atomically claims and processes at most one queued health-check task per invocation. Stale running tasks are marked failed after 10 minutes.

### Required server environment variables

Set these in the hosting provider's server-side environment settings. Never commit actual values:
- `SYSTEM_OWNER_EMAIL`
- `CRON_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `LINE_OWNER_USER_ID`

### Database and scheduled worker activation

The Guardian incident, audit, LINE event, task, and task-event models are additive Prisma schema changes. Review `prisma/migrations/20261103_z_add_system_guardian/migration.sql` against the target database, take/verify a backup, then apply it with `npx prisma migrate deploy` during an approved maintenance window. Do not use `prisma db push` as an unreviewed production shortcut. This branch does not run schema changes automatically at application startup.

The worker endpoint is `GET /api/guardian/cron` and requires `Authorization: Bearer <CRON_SECRET>`. Configure a scheduler compatible with the deployed Vercel plan to call this endpoint regularly. Without a scheduler, tasks remain queued; do not describe the queue as active until a scheduled invocation has been verified.

After deployment, configure the LINE webhook URL as `https://YOUR-DOMAIN/api/line/webhook` in LINE Developers and verify it there. A successful Vercel deployment alone does not prove that LINE webhook delivery works.

### Safety boundary

Guardian does not execute arbitrary shell commands, SQL, JavaScript, generated code, migrations, deployment actions, or student/exam/grade mutations. The only worker operation currently implemented is a database health check. Code changes, data correction, schema changes, and deployments still require a reviewed pull request and explicit human approval.
