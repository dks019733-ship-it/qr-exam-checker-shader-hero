# Attendance and assignment workflow setup

## Database deployment

The feature adds these tables and enums:
- AttendanceSession / AttendanceRecord
- Assignment / AssignmentFile
- Submission / SubmissionFile
- FeatureAvailability / FeatureAvailabilityStatus

After the pull request is approved, apply the migration to the production PostgreSQL database using the project's production database environment:

```bash
npx prisma migrate deploy
```

Do not run `prisma db push` against production as a substitute for the reviewed migration.

Feature availability controls are managed by the LINE owner account. See [LINE feature availability commands](./feature-availability-line-commands.md). The answer-sheet feature is seeded as unavailable until it is explicitly enabled.

## Private file storage

Assignment attachments and student submissions use a private Supabase Storage bucket. The application accesses Storage only from authenticated server routes using a server-side service-role key. The bucket must remain private; never expose the service-role key to the browser or commit it to Git.

Create a bucket in the existing Supabase project:
1. Open **Storage** in the Supabase Dashboard and create a bucket named `assignment-files`.
2. Keep **Public bucket** disabled.
3. Set the bucket file-size limit to 20 MiB (20,971,520 bytes).
4. Restrict allowed MIME types to PDF, JPEG, PNG, WebP, DOC and DOCX.

Configure these server-only environment variables in Vercel for Production and Preview as appropriate:

- `SUPABASE_URL` — the project's API URL (for this project: `https://ihdlafuxdhynxrhlxplg.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — the project's service-role secret from Supabase Project Settings → API Keys
- `SUPABASE_STORAGE_BUCKET` — `assignment-files`
- `UPLOAD_MAX_BYTES` (optional; defaults to 20 MiB)

Never prefix these variables with `NEXT_PUBLIC_`. The service-role key bypasses Storage RLS and must remain server-side. All upload, completion, and download routes must continue to enforce application-level teacher/student authorization before using it. The browser receives only a one-object signed upload URL; it never receives the service-role key. Signed upload URLs are valid for 2 hours per Supabase Storage's API. Signed download URLs expire after 3 minutes.

The Free plan currently includes 1 GB of Storage, 5 GB of egress and 5 GB of cached egress at no monthly subscription cost. These quotas are shared at the organization level. Free-plan quotas are limits, not unlimited storage; monitor usage and remove unneeded files through the application when appropriate. Do not upgrade the organization or enable paid add-ons under this project's no-cost requirement.

## Accepted files and optimization

Accepted formats: PDF, JPEG, PNG, WebP, DOC and DOCX. The default maximum is 20 MiB per file and can be adjusted with `UPLOAD_MAX_BYTES`.

Images are resized to a maximum edge of 2200 px and encoded as WebP at balanced quality when the result is smaller. The original file is retained when compression fails or would increase file size. PDF and Office documents are uploaded unchanged to avoid corrupting or altering source documents.

The server checks declared MIME type, file extension, actual object size, stored content type and file signature before it records a submission. Because browser uploads use direct presigned PUT URLs, the size limit is enforced after transfer; oversized or invalid objects are immediately deleted during completion. This prevents rejected objects from remaining in the bucket, but does not prevent the transfer itself.

## Operational notes

- The database stores object keys and file metadata, not file contents.
- Students can upload only to published SYSTEM_UPLOAD assignments in their authenticated classroom.
- TEACHER_CHECK assignments may include optional teacher attachments; active students in the published assignment's classroom can download them through the authenticated file-download endpoint.
- Teachers can download submissions only when they own the assignment.
- Students can download only published assignment attachments and their own submissions.
- A successful student upload records the actual server timestamp. Additional files can be uploaded after a partial failure without resetting that timestamp. A RETURNED submission can be resubmitted; a REVIEWED submission is locked against further uploads. Late status is derived from the server timestamp and assignment deadline; it is never backdated.
- Teachers can return a submission for revision only with feedback. Students see the returned status and feedback. SYSTEM_UPLOAD students can upload corrected files; TEACHER_CHECK students bring corrected physical work back to the teacher. The next successful resubmission/receipt returns the state to SUBMITTED and clears the previous score and review feedback.
- Automatic attendance is supported only for SYSTEM_UPLOAD assignments because the server can verify successful file completion. The UI hides this option for TEACHER_CHECK and Google Forms, and the API rejects unsupported modes.
- If automatic attendance is enabled and the attendance feature is available, successful submission creates a PRESENT record only when no record exists for the linked session. Existing teacher decisions (PRESENT, ABSENT, LATE or LEAVE) are preserved.
- Missing Supabase Storage environment variables cause upload endpoints to return HTTP 503; a missing bucket or invalid service-role key is reported as a generic upload error and must be corrected in the Supabase setup. The rest of the application remains available.
