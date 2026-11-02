import { prisma } from "@/lib/prisma";

const FORMS_BODY_SCOPE = "https://www.googleapis.com/auth/forms.body";
const FORMS_RESPONSES_SCOPE = "https://www.googleapis.com/auth/forms.responses.readonly";

export class GoogleFormsAccessError extends Error {}

export async function getGoogleFormsAccessToken(userId: string, purpose: "create" | "responses") {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { provider: true, providerAccountId: true, access_token: true, refresh_token: true, expires_at: true, scope: true },
  });
  if (!account) throw new Error("ไม่พบบัญชี Google ที่เชื่อมไว้ กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google อีกครั้ง");
  const requiredScope = purpose === "create" ? FORMS_BODY_SCOPE : FORMS_RESPONSES_SCOPE;
  if (!account.scope?.split(/\s+/).includes(requiredScope)) {
    const permission = purpose === "create" ? "สร้างและแก้ไข Google Forms" : "อ่านคำตอบ Google Forms";
    throw new GoogleFormsAccessError(`บัญชี Google ยังไม่ได้อนุญาต${permission} กรุณายืนยันสิทธิ์ Google ใหม่`);
  }
  if (account.access_token && account.expires_at && account.expires_at * 1000 > Date.now() + 60_000) return account.access_token;
  if (!account.refresh_token) throw new Error("ไม่พบสิทธิ์ต่ออายุบัญชี Google กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google อีกครั้ง");

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("ยังไม่ได้ตั้งค่า Google OAuth ในระบบ");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: account.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || typeof refreshed.access_token !== "string") throw new Error("ต่ออายุการเชื่อมต่อ Google ไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่");
  await prisma.account.update({
    where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
    data: { access_token: refreshed.access_token, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600), scope: refreshed.scope || account.scope },
  });
  return refreshed.access_token as string;
}

export class GoogleFormsAPIError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function googleFormsRequest<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://forms.googleapis.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    const apiMessage = typeof body?.error?.message === "string" ? body.error.message : "";
    const message = response.status === 403 && (reason === "SERVICE_DISABLED" || /has not been used|disabled/i.test(apiMessage))
      ? "ยังไม่ได้เปิด Google Forms API ใน Google Cloud project ที่ใช้กับ OAuth กรุณาเปิด API แล้วลองใหม่"
      : response.status === 403 && (reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || /insufficient.*scope|insufficient authentication scopes/i.test(apiMessage))
        ? "บัญชี Google ยังไม่ได้อนุญาตสิทธิ์ที่จำเป็น กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อยืนยันสิทธิ์"
          : response.status === 403
          ? "Google ปฏิเสธการเข้าถึง Google Forms ตรวจว่าเปิด Google Forms API แล้ว และบัญชีนี้มีสิทธิ์เข้าถึง จากนั้นออกจากระบบและเข้าสู่ระบบใหม่เพื่อยืนยันสิทธิ์"
            : response.status === 429
              ? "ใช้งาน Google Forms API ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
              : `Google Forms สร้างแบบทดสอบไม่สำเร็จ (${response.status})`;
    throw new GoogleFormsAPIError(response.status, message);
  }
  return body as T;
}
