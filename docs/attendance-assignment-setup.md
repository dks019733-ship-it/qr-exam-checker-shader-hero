# Attendance and assignment workflow setup

## Database deployment

The feature adds these tables and enums:
- AttendanceSession / AttendanceRecord
- Assignment / AssignmentFile
- Submission / SubmissionFile
- FeatureAvailability / FeatureAvailabilityStatus

After the pull request is approved, apply the reviewed SQL migration files through the connected Supabase migration workflow. This project does not use Prisma's `_prisma_migrations` history table, so do not run `npx prisma migrate deploy` against Production. Apply schema changes before deploying the application code, then verify the resulting columns, indexes and backfilled rows with read-only SQL queries.

Feature availability controls are managed by the LINE owner account. See [LINE feature availability commands](./feature-availability-line-commands.md). The answer-sheet feature is seeded as unavailable until it is explicitly enabled.

## Private file storage

Assignment attachments and student submissions use the existing private Supabase Storage bucket named `assignment-files`. The application creates short-lived signed upload URLs and signed download URLs on the server. The service-role key is never sent to the browser; all teacher/student authorization checks remain in the application API.

Configure these server-side Vercel environment variables for Preview and Production:

- `SUPABASE_URL` — the regular project API URL, e.g. `https://<project-ref>.supabase.co` (not the dedicated `https://<project-ref>.storage.supabase.co` S3 hostname)
- `SUPABASE_SERVICE_ROLE_KEY` (sensitive/secret; server-only)
- `SUPABASE_STORAGE_BUCKET=assignment-files`
- `UPLOAD_MAX_BYTES=10485760` (10 MiB; must not exceed the bucket's configured limit)

The bucket must remain private. `SUPABASE_URL` is used for the REST Storage API and must point to the regular project API host; the dedicated `*.storage.supabase.co` hostname is for the S3-compatible API and is not interchangeable. The application normalizes that known Storage hostname to the project API hostname as a compatibility safeguard. Do not expose the service-role key through a `NEXT_PUBLIC_` variable, client code, logs, or API responses. Upload URLs are issued for a unique object path and are valid for up to two hours; download URLs expire after three minutes. The server verifies object size, content type and file signature before writing file metadata to PostgreSQL. Rejected or uncommitted objects are deleted server-side.

## Accepted files and optimization

Accepted formats: PDF, JPEG, PNG, WebP, DOC and DOCX. The maximum is 10 MiB per file, matching the existing bucket limit. `UPLOAD_MAX_BYTES` may lower this limit but cannot raise it above 10 MiB.

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
- Missing Supabase Storage environment variables cause upload endpoints to return HTTP 503; the rest of the application remains available.
