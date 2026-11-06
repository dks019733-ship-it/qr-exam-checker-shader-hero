# Subject-based access control (implementation in progress)

## Agreed product rules

- A teacher may create multiple subject codes.
- A subject may be assigned to multiple classrooms for the same teacher.
- A teacher manages only their own subject/class assignments, rosters, exams, and scores.
- Two teachers may teach different subjects in the same classroom without seeing each other's teacher workspace data.
- Students must eventually have one school-scoped identity and see their own results across every participating subject.
- Teacher-owned roster rows remain isolated. Shared student identity is a matching layer, not a shared editable roster.

## Data model added on this branch

- Subject: a teacher-owned subject code and display name.
- TeachingAssignment: joins one teacher, one subject, and one classroom.
- CourseEnrollment: joins the assignment to the teacher-owned student roster rows.
- StudentIdentity: shared identity keyed by school, class label, and student number.
- Student.identityId: optional link from the existing teacher-owned student row to the shared identity.
- Exam.teachingAssignmentId and GradeColumn.teachingAssignmentId: optional links for gradual migration.

The existing Class, Student, Exam, and GradeColumn ownership model is retained for compatibility. Existing records are not automatically reassigned to a subject by this migration.

## Implemented in this first slice

- Additive Prisma schema and SQL migration.
- Authenticated GET/POST /api/teaching-assignments.
- Teacher page at /dashboard/subjects for creating a subject code and assigning it to a classroom.
- New roster imports link imported students to a school-scoped identity and enroll them into the teacher's existing assignments for that classroom.

## Not yet complete; do not deploy as a finished Student Portal

- Student PIN enrollment, hashing, rate limiting, and student authentication.
- Student Portal APIs and UI.
- Filtering every exam, gradebook, review, import, sync, report, and answer-sheet API by TeachingAssignment.
- Assigning existing exams and grade columns to the correct assignment.
- Safe migration/backfill of existing student identities and enrollments.
- Integration tests for cross-teacher and cross-subject authorization.
- Production database migration review, backup, deploy, and rollback rehearsal.

## Security invariants for the next implementation slice

1. Derive ownerId only from the authenticated teacher session.
2. Resolve a TeachingAssignment with both id and ownerId; never trust client-supplied owner IDs.
3. Validate that a student roster row belongs to the assignment's classroom before reading or writing a score.
4. Student authentication must verify a per-student PIN hash with throttling and generic failure responses.
5. Student result queries must resolve the authenticated StudentIdentity and return only rows linked to that identity.
6. A student must never receive another student's identity, roster, PIN hash, or scores.
7. Never apply production schema changes with an unreviewed db push; use the checked-in migration after backup and review.
