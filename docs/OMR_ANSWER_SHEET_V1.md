# OMR answer sheet format — version 1

## Purpose

Newly generated answer sheets use a fixed A4 portrait layout intended to support future camera-based optical mark recognition (OMR).

## Printed layout contract

- Paper: A4 portrait, printed at 100% / actual size.
- Four solid black square calibration markers are placed 8 mm inside the page corners to reduce clipping on printers with non-printable edge areas. Keep all four markers visible; do not crop, cover, write on, or punch through them.
- The answer bubbles are blank circles. Choice labels remain in the table header so an unmarked bubble does not contain printed text that could be mistaken for pencil shading.
- The QR code identifies the student only. It is not an answer key and does not indicate correctness.
- The school logo/seal remains configurable through the existing PNG, JPEG, or WebP upload control and is retained in the saved answer-sheet template.
- The printed footer identifies this layout as OMR FORM V1.

## Printing guidance

Select A4 portrait and 100% / actual size. Disable browser options such as fit-to-page or shrink-to-fit. Confirm the four black markers and the complete answer grid are visible before printing a class set.

## Compatibility and limitations

- Sheets already printed before this change are physically unchanged. They can still be handled through the existing manual workflow; they do not gain the new calibration markers or blank OMR bubbles.
- The scan workspace now implements live camera capture and QR decoding on browsers that provide the native BarcodeDetector API. The QR token identifies the student only and is matched against the selected exam class. Camera scanning can continue across consecutive sheets.
- The current scanner does **not** perform perspective correction, answer-bubble OMR recognition, mobile-to-desktop pairing, or real-time desktop updates. Teachers must review and enter the marked answers manually before saving.
- An OMR reader must be implemented and tested against this exact versioned layout before the answer bubbles can be advertised as automatically readable. It must reject unclear, multiple, or low-confidence marks for teacher review rather than guessing.
- No database migration is required for this presentation-only change.
