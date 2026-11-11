# QR Exam Checker — Deploy to Vercel

## ทำตามนี้เมื่อถึงขั้น Deploy

1. สร้าง PostgreSQL production database (เช่น Neon หรือ Prisma Postgres) และคัดลอก `DATABASE_URL`
2. สร้าง Google OAuth Client ใน Google Cloud
3. ตั้ง Authorized redirect URI เป็น:
   `https://YOUR-DOMAIN/api/auth/callback/google`
4. สร้างโปรเจกต์บน Vercel และเชื่อม GitHub repository
5. เพิ่ม Environment Variables ตาม `.env.example`
   - เพิ่ม `GEMINI_API_KEY` และ `GEMINI_MODEL=gemini-3.5-flash-lite` สำหรับผู้ช่วย AI
   - ถ้าใช้ Supabase ให้ตั้ง `DATABASE_URL` เป็น Transaction pooler (port 6543, `pgbouncer=true`, `connection_limit=1`) และ `DIRECT_URL` เป็น Session pooler (port 5432)
   - ตั้ง `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Sensitive/Secret) และ `SUPABASE_STORAGE_BUCKET=assignment-files` สำหรับไฟล์แนบ/ไฟล์ส่งงาน โดยใช้ private bucket ที่มีอยู่แล้ว
6. ใช้ SQL migration ที่ผ่านการ review ผ่าน Supabase migration workflow เท่านั้น โดยตรวจ schema และผลกระทบก่อนทุกครั้ง
7. ฐานข้อมูลนี้ไม่มี Prisma `_prisma_migrations` history table จึงห้ามใช้ `npx prisma migrate deploy` และห้ามใช้ `prisma db push` แทน migration
8. ตรวจสอบ columns, indexes, foreign keys และจำนวนแถวที่ backfill ด้วย read-only SQL หลัง migration ก่อนปล่อยโค้ด
9. Deploy หลังจากฐานข้อมูลพร้อมแล้วเท่านั้น ระบบจะไม่รัน DDL/แก้ Schema อัตโนมัติบน Request ของ Production เพื่อป้องกัน Cold-start connection spikes และ lock contention
10. เปิด `/api/health` เพื่อตรวจว่า server ตอบ `{ "ok": true }`
11. ทดสอบ Google Login
12. ทดสอบสร้างห้องเรียน/นักเรียน, บันทึกกระดาษคำตอบ และทดสอบอัปโหลดไฟล์จริง

## ห้ามทำ

- ห้ามใส่ `AUTH_SECRET`, Google Client Secret หรือ database password ลง GitHub
- ห้ามใช้ฐานข้อมูล local เป็น production
- ห้ามถือว่า OMR/Google Drive/Export/Backup เสร็จเพียงเพราะหน้า UI มีอยู่

## สิ่งที่ยังต้องพัฒนาก่อนถือว่า Production Complete

- Google Drive: สร้างโฟลเดอร์และอัปโหลด/จัดระเบียบไฟล์จริง
- AI: ตั้ง Gemini key และ sync schema ล่าสุดกับ production database ก่อนเปิดใช้งานแชท ความจำครู หรือสร้างภาพด้วย Gemini
- OMR: อ่านคำตอบจากภาพจริง พร้อม confidence/จุดที่อ่านไม่ได้
- Manual Review และการยืนยันคะแนน
- Excel/PDF report export
- Backup และ recovery workflow
- End-to-end production test suite สำหรับครู/นักเรียน, upload, Google Forms และ recovery
