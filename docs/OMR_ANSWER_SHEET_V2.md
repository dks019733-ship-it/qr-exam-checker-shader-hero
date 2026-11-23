# OMR answer sheet format — version 2

## Purpose

OMR FORM V2 is the fixed A4 portrait layout for camera-based answer-bubble recognition. It supersedes V1 for new OMR scans while preserving V1 student QR identification for manual entry.

## Printed layout contract

- Paper: A4 portrait at 100% / actual size. The rendered page is fixed at 794 × 1123 CSS pixels.
- Four solid black 14 × 14 px calibration markers are centered at (39, 39), (755, 39), (755, 1084), and (39, 1084) in page coordinates. Keep all four markers visible; do not crop, cover, write on, or punch through them.
- Newly generated student QR codes use the `QEC2:` prefix. Existing `QEC1:` QR codes remain readable for student identity, but are treated as legacy sheets and cannot start OMR recognition.
- The answer grid has two balanced columns, up to 50 questions per column, 4 or 5 choices, and bubble centers defined in `lib/omr-layout.ts`. For short exams, row spacing expands up to 30 px; the OMR reader uses the same question-count-dependent geometry.
- The school logo/seal remains configurable through the existing PNG, JPEG, or WebP upload control.
- The printed footer identifies this layout as OMR FORM V2.

## Scanning workflow

1. Select the exam and open the camera on the scan page.
2. Scan the student's QEC2 QR code. If the browser does not support native `BarcodeDetector`, select the student manually; camera-based OMR capture remains available.
3. Keep the complete sheet in view, including all four black calibration markers, then select **อ่านคำตอบจากภาพ**.
4. The browser detects the four markers, rectifies perspective to the V2 page coordinate system, and samples the center of each answer bubble.
5. Clearly marked single choices are copied into the editable answer form. Blank bubbles remain blank. Multiple marks and uncertain marks are left empty and listed for teacher review.
6. The teacher must review and correct the answers before saving. Saving creates or updates a result in the existing READY_TO_CONFIRM state; it does not confirm or publish the result.

## Printing and image quality

- Select A4 portrait and 100% / actual size. Disable fit-to-page or shrink-to-fit.
- Print a fresh V2 sheet after this update. Do not use V1 sheets for automatic OMR.
- Keep the page flat, evenly lit, fully visible, and close enough for all four markers to be detected.
- Avoid glare, shadows over the answer grid, motion blur, folds, and handwritten marks near calibration markers.
- Use a dark pencil mark that fills one bubble. Erase changed answers completely.
- The OMR reader is a deterministic image-processing aid, not a guarantee of perfect recognition. Always inspect the displayed answers and issue list before saving.

## Compatibility and limitations

- V1 sheets retain student QR identification and the manual answer-entry workflow. Their older variable answer-grid geometry is not used by the V2 OMR reader.
- The scan page checks the saved answer-sheet template's question count and choice count against the selected exam before enabling OMR.
- QR decoding uses the browser's native `BarcodeDetector` API where available. Browsers without it can still use manual student selection and OMR capture, but the teacher must ensure the sheet is a newly printed V2 form.
- The reader does not infer answers from the answer key, resolve multiple marks, or auto-confirm results.
- No database migration is required. The existing exam-attempt API and teacher confirmation workflow remain the source of truth.
