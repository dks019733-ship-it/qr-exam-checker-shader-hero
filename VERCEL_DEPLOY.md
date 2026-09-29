# QR Exam Checker — Deploy to Vercel

## ทำตามนี้เมื่อถึงขั้น Deploy

1. สร้าง PostgreSQL production database (เช่น Neon หรือ Prisma Postgres) และคัดลอก `DATABASE_URL`
2. สร้าง Google OAuth Client ใน Google Cloud
3. ตั้ง Authorized redirect URI เป็น:
   `https://YOUR-DOMAIN/api/auth/callback/google`
4. สร้างโปรเจกต์บน Vercel และเชื่อม GitHub repository
5. เพิ่ม Environment Variables ตาม `.env.example`
   - เพิ่ม `GEMINI_API_KEY` และ `GEMINI_MODEL=gemini-3.5-flash-lite` สำหรับผู้ช่วย AI
   - ถ้าใช้ Supabase ให้ตั้ง `DATABASE_URL` เป็น Transaction pooler และ `DIRECT_URL` เป็น Session pooler
6. เพิ่มตารางตาม `prisma/schema.prisma` ในฐานข้อมูล production โดยใช้ `npx prisma db push` กับ production `DATABASE_URL` หนึ่งครั้งก่อนเปิดใช้งาน AI
7. Deploy
8. เปิด `/api/health` เพื่อตรวจว่า server ตอบ `{ "ok": true }`
9. ทดสอบ Google Login
10. ทดสอบสร้างห้องเรียน/นักเรียน และบันทึกกระดาษคำตอบ

## ห้ามทำ

- ห้ามใส่ `AUTH_SECRET`, Google Client Secret หรือ database password ลง GitHub
- ห้ามใช้ฐานข้อมูล local เป็น production
- ห้ามถือว่า OMR/Google Drive/Export/Backup เสร็จเพียงเพราะหน้า UI มีอยู่

## สิ่งที่ยังต้องพัฒนาก่อนถือว่า Production Complete

- Google Drive: สร้างโฟลเดอร์และอัปโหลด/จัดระเบียบไฟล์จริง
- AI: ตั้ง Gemini key และเพิ่ม AI tables ใน production database ก่อนเปิดใช้งาน
- OMR: อ่านคำตอบจากภาพจริง พร้อม confidence/จุดที่อ่านไม่ได้
- Manual Review และการยืนยันคะแนน
- Excel/PDF report export
- Backup และ recovery workflow
- Security hardening และ production test suite
