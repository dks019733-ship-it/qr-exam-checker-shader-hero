export type StudentLoginCandidate = {
  studentNo: string;
  rollNo: string;
  identity?: { pinHash: string | null } | null;
};

export function hasRequiredStudentLoginFactors(studentCode: string, secondFactor: string) {
  return Boolean(studentCode.trim() && secondFactor.trim());
}

function normalizeRollNumber(value: string) {
  return value.trim().replace(/^0+(?=\d)/, "");
}

export function matchesStudentCode(candidate: StudentLoginCandidate, studentCode: string) {
  return Boolean(
    studentCode.trim() &&
    candidate.studentNo.toLocaleLowerCase("en") === studentCode.trim().toLocaleLowerCase("en"),
  );
}

/**
 * A student must prove both their student code and either their class roll number
 * or a configured PIN. Supplying only one identifier must never authenticate.
 */
export function matchesStudentLogin(
  candidate: StudentLoginCandidate,
  studentCode: string,
  secondFactor: string,
  pinMatches = false,
): boolean {
  if (!hasRequiredStudentLoginFactors(studentCode, secondFactor)) return false;

  if (!matchesStudentCode(candidate, studentCode)) return false;

  const rollMatches =
    candidate.rollNo === secondFactor.trim() ||
    normalizeRollNumber(candidate.rollNo) === normalizeRollNumber(secondFactor);

  return rollMatches || pinMatches;
}
