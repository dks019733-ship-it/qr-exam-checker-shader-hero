# OMR answer sheet format — version 1

## Purpose

OMR FORM V1 is a fixed A4 portrait answer sheet for camera-based student identification and optical mark recognition.

## Printed layout contract

- Paper: A4 portrait at 100% / actual size. The rendered page is fixed at 794 × 1123 CSS pixels.
- Four solid black 14 × 14 px calibration markers are centered at (39, 39), (755, 39), (755, 1084), and (39, 1084) in page coordinates. Keep all four markers visible; do not crop, cover, write on, or punch through them.
- The QR code identifies the student only. It is not an answer key and does not indicate correctness.
- The answer grid has two columns, up to 50 questions per column, 4 or 5 choices, and fixed bubble centers defined in `lib/omr-layout.ts`.
- The school logo/seal remains configurable through the existing PNG, JPEG, or WebP upload control.
- The printed footer identifies this layout as OMR FORM V1.

## Scanning workflow

1. Select the exam and open the camera on the scan page.
2. Scan the QR code to select the student. If the browser does not support native `BarcodeDetector`, select the student manually; OMR camera capture remains available.
3. Keep the complete sheet in view, including all four black calibration markers, then select **อ่านคำตอบจากภาพ**.
4. The browser detects the four markers, rectifies perspective to the V1 page coordinate system, and samples the center of each answer bubble.
5. Clearly marked single choices are copied into the editable answer form. Blank bubbles remain blank. Multiple marks and uncertain marks are excluded from automatic entry and listed for teacher review.
6. The teacher must review and correct the answers before saving. Saving creates or updates a result in the existing READY_TO_CONFIRM state; it does not confirm or publish the result.

## Printing and image quality

- Select A4 portrait and 100% / actual size. Disable fit-to-page or shrink-to-fit.
- Keep the page flat, evenly lit, fully visible, and close enough for all four markers to be detected.
- Avoid glare, shadows over the answer grid, motion blur, folds, and handwritten marks near calibration markers.
- Use a dark pencil mark that fills one bubble. Erase changed answers completely.
- The OMR reader is a deterministic image-processing aid, not a guarantee of perfect recognition. Always inspect the displayed answers and issue list before saving.

## Compatibility and limitations

- OMR V1 applies to sheets printed from the current fixed-layout template. Previously printed sheets with the older variable layout are not guaranteed to align with V1 sampling coordinates and must use manual entry.
- QR decoding uses the browser's native `BarcodeDetector` API where available. Browsers without it can still use manual student selection and OMR capture.
- The reader does not infer answers from the answer key, resolve multiple marks, or auto-confirm results.
- No database migration is required. The existing exam-attempt API and teacher confirmation workflow remain the source of truth.
