# Student submission files in Google Drive

## Storage ownership

New files submitted through an assignment using `SYSTEM_UPLOAD` are stored in the Google Drive account connected to the teacher who owns that assignment. The student does not choose the destination account.

Teacher-provided assignment attachments remain in the existing private Supabase Storage bucket.

## Folder layout

The application creates and reuses this folder path in the teacher's Drive:

```text
งานของครู/
  <subject code>/
    <grade level>/
      <classroom>/
        เลขที่ <roll number>/
          <original file name>
```

Folder labels are derived from the assignment's TeachingAssignment/Subject, Class.name, and Student.rollNo database fields. If the student's roll number or subject code is missing, the upload is rejected with a message asking the teacher to correct the class data.

## Upload and download flow

1. The student browser asks the application to create a Google Drive resumable upload session.
2. The application authenticates as the assignment owner using that teacher's stored Google OAuth account and the narrow `drive.file` scope.
3. The browser uploads file bytes directly to the Google Drive resumable session. File bytes do not pass through a Vercel Function request body.
4. The application verifies the uploaded Drive file ID, exact parent folder, filename, MIME type, size, and file signature before creating the SubmissionFile record.
5. Downloads are streamed through an application endpoint that checks teacher ownership or the student's own submission access. Drive files are not made public.

The configured upload policy remains capped at 10 MiB and uses the same supported PDF, JPEG, PNG, WebP, DOC, and DOCX formats.

## Existing files and rollout

- Existing SubmissionFile rows with Supabase `objectKey` values remain unchanged and downloadable.
- No bulk migration, copy, or deletion of existing Supabase objects is performed.
- New Google Drive rows use `driveFileId`; the database check constraint requires exactly one storage locator.
- Apply `prisma/migrations/20261111100000_submission_files_google_drive/migration.sql` through the project's reviewed Supabase migration workflow before deploying code that uses the new column.
- Do not use `prisma migrate deploy` or `prisma db push` against Production.
- Teachers whose Google account has not granted the `drive.file` scope must sign out and sign in with Google again to grant consent. Never request Google passwords or tokens in chat.
- A successful CI build does not replace an authenticated teacher/student upload-and-download roundtrip test.
