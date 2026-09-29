import { prisma } from "@/lib/prisma";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export async function getGoogleFormsAccessToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { provider: true, providerAccountId: true, access_token: true, refresh_token: true, expires_at: true, scope: true },
  });
  if (!account) throw new Error("ไม่พบบัญชี Google ที่เชื่อมไว้ กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google อีกครั้ง");
  if (!account.scope?.split(/\s+/).includes(DRIVE_FILE_SCOPE)) {
    throw new Error("บัญชี Google ยังไม่ได้อนุญาตจัดการไฟล์ที่สร้างในแอป กรุณาออกจากระบบแล้วเข้าสู่ระบบ Google อีกครั้งเพื่อยืนยันสิทธิ์");
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
    const message = response.status === 403
      ? "Google ปฏิเสธการเข้าถึง Google Forms ตรวจว่าเปิด Google Forms API แล้ว และบัญชีนี้เป็นเจ้าของฟอร์มหรือมีสิทธิ์เข้าถึง จากนั้นออกจากระบบและเข้าสู่ระบบใหม่เพื่อยืนยันสิทธิ์"
      : response.status === 429
        ? "ใช้งาน Google Forms API ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
        : `Google Forms สร้างแบบทดสอบไม่สำเร็จ (${response.status})`;
    throw new GoogleFormsAPIError(response.status, message);
  }
  return body as T;
}
