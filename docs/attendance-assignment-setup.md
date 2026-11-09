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

Assignment attachments and student submissions use a private Cloudflare R2 bucket through short-lived S3-compatible signed URLs. The bucket must not be public.

Configure these server-side environment variables in Vercel for the Production and Preview environments as appropriate:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `UPLOAD_MAX_BYTES` (optional; defaults to 20 MiB)

Never add these credentials to client-side variables or commit real values to Git.

Create an R2 API token scoped to the required bucket with object read/write access only. Keep the bucket private. Configure bucket CORS to allow `PUT` from the production app origin (`https://ngankhongkhru.vercel.app`) and any explicitly approved Preview origin, with the `Content-Type` and `If-None-Match` request headers. Upload signatures bind both headers and use `If-None-Match: *`, preventing a valid upload URL from overwriting an object that has already been created. Ensure the R2 API token can read, write and delete objects; rejected or uncommitted objects are deleted by the server-side completion endpoint. Do not enable public bucket access. Signed upload URLs expire after 5 minutes; signed download URLs expire after 3 minutes.

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
- Missing R2 environment variables cause upload endpoints to return HTTP 503; the rest of the application remains available.
