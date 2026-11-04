import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

test("the patched XLSX package retains workbook import and export behavior", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"],
    [1, "M401001", "นักเรียนทดสอบ"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "รายชื่อ");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const imported = XLSX.read(bytes, { type: "buffer", raw: false });
  const rows = XLSX.utils.sheet_to_json(imported.Sheets["รายชื่อ"], {
    header: 1,
    defval: "",
    raw: false,
  });

  assert.deepEqual(rows, [
    ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"],
    ["1", "M401001", "นักเรียนทดสอบ"],
  ]);
});
