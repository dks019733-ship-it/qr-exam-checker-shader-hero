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
   - ตั้งค่า Cloudflare R2 ให้ครบ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` หากต้องการเปิดใช้งานไฟล์แนบ/ไฟล์ส่งงาน
6. ก่อน Deploy ให้ตรวจ Schema diff แล้วใช้ `npx prisma db push` กับฐานข้อมูล production ผ่าน `DIRECT_URL` เพื่อให้ Schema ตรงกับ `prisma/schema.prisma` (ห้ามใช้ `--accept-data-loss` โดยไม่ตรวจสอบผลกระทบก่อน)
7. SQL hardening migrations ใน `prisma/migrations` ต้อง Apply ผ่าน Supabase migration workflow แยกจาก `prisma db push` เพราะ `db push` ไม่ได้รันไฟล์ migration SQL
8. ฐานข้อมูลปัจจุบันยังไม่มี Prisma migration history table (`_prisma_migrations`) จึงห้ามสั่ง `prisma migrate deploy` จนกว่าจะทำ baseline migration history อย่างถูกต้อง
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
