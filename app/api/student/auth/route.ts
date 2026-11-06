import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signStudentToken, verifyStudentToken, verifyStudentPin } from "@/lib/student-token";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    // Support both naming conventions:
    // 1. studentId / studentCode = รหัสประจำตัว (e.g. 50123 หรือ M50123)
    // 2. studentNo / rollNo = เลขที่ (e.g. 12)
    // 3. grade + room = ชั้น/ห้อง (e.g. ม.5 / 1)
    const rawStudentCode = String(body?.studentId || body?.studentCode || "").trim();
    const rawRollNo = String(body?.studentNo || body?.rollNo || "").trim();
    const grade = String(body?.grade || "").trim();
    const room = String(body?.room || "").trim();
    const explicitClassId = typeof body?.classId === "string" ? body.classId.trim() : "";

    // Fallback if client sent studentNo as the student ID and rollNoOrPin as the roll
    const studentCode = rawStudentCode || String(body?.studentNo && body?.rollNoOrPin ? body.studentNo : "").trim();
    const rollNoOrPin = rawRollNo || String(body?.rollNoOrPin || "").trim();

    if (!studentCode && !rollNoOrPin) {
      return NextResponse.json({ error: "กรุณากรอกรหัสประจำตัวนักเรียนและเลขที่" }, { status: 400 });
    }

    // Normalizer for roll numbers ("05" -> "5")
    const normalizeRoll = (val: string) => val.trim().replace(/^0+/, "");

    // Query active students matching studentCode OR matching rollNo
    const candidates = await prisma.student.findMany({
      where: {
        isActive: true,
        ...(explicitClassId ? { classId: explicitClassId } : {}),
        OR: [
          ...(studentCode ? [{ studentNo: studentCode }] : []),
          ...(studentCode ? [{ studentNo: { equals: studentCode, mode: "insensitive" as const } }] : []),
          ...(rollNoOrPin ? [{ rollNo: rollNoOrPin }] : []),
        ],
      },
      include: {
        class: {
          select: { id: true, name: true, owner: { select: { name: true, defaultLearningArea: true } } },
        },
        identity: {
          select: { id: true, pinHash: true },
        },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลนักเรียน กรุณาตรวจสอบรหัสประจำตัว" }, { status: 404 });
    }

    // Filter candidates matching both student code and rollNo (or PIN)
    let matched = candidates.filter((candidate) => {
      const codeMatches =
        !studentCode ||
        candidate.studentNo.toLowerCase() === studentCode.toLowerCase();

      const rollMatches =
        !rollNoOrPin ||
        candidate.rollNo === rollNoOrPin ||
        normalizeRoll(candidate.rollNo) === normalizeRoll(rollNoOrPin);

      const pinMatches =
        candidate.identity?.pinHash &&
        rollNoOrPin &&
        verifyStudentPin(rollNoOrPin, candidate.identity.pinHash);

      return codeMatches && (rollMatches || pinMatches);
    });

    // If grade and room were provided, further prioritize or filter matching classroom
    if (matched.length > 1 && (grade || room)) {
      const classPattern = `${grade}/${room}`;
      const shortPattern = `${grade.replace("ม.", "")}/${room}`;
      const filteredByClass = matched.filter(
        (c) =>
          c.class.name.includes(classPattern) ||
          c.class.name.includes(shortPattern) ||
          (c.class.name.includes(grade) && c.class.name.includes(room))
      );
      if (filteredByClass.length > 0) {
        matched = filteredByClass;
      }
    }

    if (matched.length === 0) {
      return NextResponse.json(
        { error: "เลขที่ หรือ รหัสประจำตัวไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง" },
        { status: 401 }
      );
    }

    // If multiple candidates still match across different classes
    if (matched.length > 1 && !explicitClassId) {
      return NextResponse.json({
        requiresClassSelection: true,
        classes: matched.map((c) => ({
          studentId: c.id,
          classId: c.class.id,
          className: c.class.name,
          studentName: c.name,
        })),
      });
    }

    const student = matched[0];
    const token = signStudentToken({
      studentId: student.id,
      studentNo: student.studentNo,
      classId: student.classId,
    });

    const cookieStore = await cookies();
    cookieStore.set("student_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 14 * 24 * 60 * 60, // 14 days
    });

    return NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        name: student.name,
        studentNo: student.studentNo,
        rollNo: student.rollNo,
        classId: student.class.id,
        className: student.class.name,
        school: student.class.owner?.defaultLearningArea || "โรงเรียน",
      },
    });
  } catch (error) {
    console.error("[StudentAuth] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("student_token")?.value;
    if (!token) return NextResponse.json({ authenticated: false });

    const payload = verifyStudentToken(token);
    if (!payload?.studentId) return NextResponse.json({ authenticated: false });

    const student = await prisma.student.findUnique({
      where: { id: payload.studentId, isActive: true },
      select: {
        id: true,
        name: true,
        studentNo: true,
        rollNo: true,
        class: {
          select: {
            id: true,
            name: true,
            owner: { select: { name: true, defaultLearningArea: true } },
          },
        },
      },
    });

    if (!student) return NextResponse.json({ authenticated: false });

    return NextResponse.json({
      authenticated: true,
      student: {
        id: student.id,
        name: student.name,
        studentNo: student.studentNo,
        rollNo: student.rollNo,
        classId: student.class.id,
        className: student.class.name,
        school: student.class.owner?.defaultLearningArea || "โรงเรียน",
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("student_token");
  return NextResponse.json({ ok: true });
}
