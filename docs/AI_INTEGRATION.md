# AI inside QR Exam Checker

The AI workspace is part of the QR Exam Checker Next.js app and uses the same Google sign-in. Requests go to authenticated Next.js route handlers; they never send the Gemini key to the browser. Chat and generated materials are saved under the current Prisma user.

## Local setup

1. Set `GEMINI_API_KEY` in the app's server-only `.env` file. Optionally set `GEMINI_MODEL` (default: `gemini-3.5-flash-lite`). Do not use a `NEXT_PUBLIC_` prefix.
2. Install packages and generate Prisma Client: `npm install`.
3. Add the new AI tables to the configured PostgreSQL database: `npx prisma db push`.
4. Start the app with `npm run dev`, sign in, then open `/dashboard/ai`.

## Existing deployment

Before using the feature against a production database, apply the Prisma schema change to that database with `npx prisma db push` using its production `DATABASE_URL`. Add `GEMINI_API_KEY` and optional `GEMINI_MODEL` to the Vercel project's server environment and redeploy. Never commit `.env` files or API keys.

AI generated exams and documents always start in `pending_review`. Only their owner can read or edit them. Approval locks the draft, and the server rejects Word exports until the status is `approved`. PDF output uses the browser print dialog after approval.
