import { auth } from "@/lib/auth";

export class AIRequestError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export async function requireAIUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AIRequestError("กรุณาเข้าสู่ระบบก่อนใช้งาน", 401);
  return session.user.id;
}

export async function generateWithGemini(contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>, options?: { json?: boolean; temperature?: number }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIRequestError("ยังไม่ได้ตั้งค่า Gemini API Key บน Server", 503);

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "คุณคือผู้ช่วย AI สำหรับครู ตอบเป็นภาษาไทยที่สุภาพ กระชับ และเป็นประโยชน์ต่อการสอน หากสร้างข้อสอบ เอกสาร เฉลย หรือตัวชี้วัด ให้ถือเป็นร่างที่ครูต้องตรวจสอบและอนุมัติก่อนใช้งานจริงเสมอ" }] },
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          ...(options?.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AIRequestError("เชื่อมต่อ Gemini ไม่สำเร็จ กรุณาลองใหม่", 502);
  }

  const payload = await response.json().catch(() => null) as any;
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Gemini ไม่สามารถสร้างคำตอบได้";
    throw new AIRequestError(message.slice(0, 500), response.status === 429 ? 429 : 502);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();
  if (!text) throw new AIRequestError("Gemini ส่งคำตอบกลับมาไม่ครบ กรุณาลองใหม่", 502);
  return text as string;
}

export function aiErrorResponse(error: unknown) {
  const status = error instanceof AIRequestError ? error.status : 500;
  const message = error instanceof AIRequestError ? error.message : "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง";
  return Response.json({ error: message }, { status });
}
