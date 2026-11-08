# LINE feature availability controls

Only the LINE user configured as `LINE_OWNER_USER_ID` can change feature status. The webhook signature must also validate.

Send these text commands to the LINE Official Account:

- `สถานะฟีเจอร์` — list the current state of each feature.
- `ปิดปรับปรุง กระดาษคำตอบ 2 ชม. กำลังปรับรูปแบบกระดาษ` — set maintenance for two hours.
- `ไม่พร้อมใช้งาน กระดาษคำตอบ อยู่ระหว่างพัฒนา` — mark as not yet available with no automatic reopen time.
- `ไม่พร้อมใช้งาน เช็กชื่อ 30 นาที กำลังตรวจสอบปัญหา` — mark unavailable for 30 minutes.
- `เปิดใช้งาน กระดาษคำตอบ` — immediately enable the feature and clear its reason/expiry.

Supported feature names:
- `กระดาษคำตอบ`
- `เช็กชื่อ`
- `มอบหมายงาน`
- `ข้อสอบ`
- `คะแนน`
- `ผู้ช่วย AI`

Duration units: `นาที`, `ชม.` / `ชั่วโมง`, `วัน`, `สัปดาห์`; maximum 30 days. If no duration is provided, the status remains until an owner explicitly enables it.

The website homepage, feature pages, and guarded APIs use the same database state. When a timed status expires, the feature becomes available automatically on its next request; no scheduled job is required. Status is not a substitute for actual service health checks. Do not mark a feature available until its underlying dependencies are ready.

The answer-sheet feature defaults to `UNAVAILABLE` with the reason “อยู่ระหว่างเตรียมพัฒนา” until explicitly enabled.
