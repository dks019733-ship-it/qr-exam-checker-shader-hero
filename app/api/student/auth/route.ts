import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signStudentToken, verifyStudentToken } from "@/lib/student-token";
import { matchesStudentLogin, hasRequiredStudentLoginFactors } from "@/lib/student-auth";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 8_192) {
      return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413, headers: noStoreHeaders });
    }
    const body = await request.json().catch(() => null);

    // Accept the current client contract (studentId + studentNo) and the
    // legacy aliases, but always require a student code AND a second factor.
    const rawStudentCode = String(body?.studentId || body?.studentCode || "").trim();
    const rawRollNo = String(body?.studentNo || body?.rollNo || "").trim();
    const grade = String(body?.grade || "").trim();
    const room = String(body?.room || "").trim();
    const explicitClassId = typeof body?.classId === "string" ? body.classId.trim() : "";

    const studentCode = rawStudentCode ||
      (body?.studentNo && body?.rollNoOrPin ? String(body.studentNo).trim() : "");
    const rollNoOrPin = rawStudentCode
      ? rawRollNo || String(body?.rollNoOrPin || "").trim()
      : String(body?.rollNoOrPin || rawRollNo || "").trim();

    if (
      !hasRequiredStudentLoginFactors(studentCode, rollNoOrPin) ||
      studentCode.length > 50 ||
      rollNoOrPin.length > 32 ||
      grade.length > 32 ||
      room.length > 32 ||
      explicitClassId.length > 128
    ) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสประจำตัวนักเรียนและเลขที่ให้ครบถ้วน" },
        { status: 400, headers: noStoreHeaders },
      );
    }

    // Resolve only by the student code. The second factor is verified separately
    // below so a roll number can never be used as the sole account identifier.
    const candidates = await prisma.student.findMany({
      where: {
        isActive: true,
        studentNo: { equals: studentCode, mode: "insensitive" },
        ...(explicitClassId ? { classId: explicitClassId } : {}),
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

    const matchedFlags = await Promise.all(
      candidates.map((candidate) => matchesStudentLogin(candidate, studentCode, rollNoOrPin)),
    );
    let matched = candidates.filter((_, index) => matchedFlags[index]);

    if (matched.length === 0) {
      // Use one response for unknown accounts and incorrect second factors.
      return NextResponse.json(
        { error: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง" },
        { status: 401, headers: noStoreHeaders },
      );
    }

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
        { status: 401, headers: noStoreHeaders }
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
      }, { headers: noStoreHeaders });
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
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[StudentAuth] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("student_token")?.value;
    if (!token) return NextResponse.json({ authenticated: false }, { headers: noStoreHeaders });

    const payload = verifyStudentToken(token);
    if (!payload?.studentId) return NextResponse.json({ authenticated: false }, { headers: noStoreHeaders });

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

    if (!student) return NextResponse.json({ authenticated: false }, { headers: noStoreHeaders });

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
    }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ authenticated: false }, { headers: noStoreHeaders });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("student_token");
  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
