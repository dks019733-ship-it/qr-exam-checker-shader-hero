import QRCode from "qrcode";

/**
 * Server-only helpers. `qrcode`'s Node renderer uses pure-JS PNG encoding
 * (no native `canvas` dependency), so this is safe to import from API
 * routes and PDF generation code, but should NOT be imported from a
 * "use client" component's bundle.
 *
 * Every student QR encodes a namespaced version of their unique
 * `qrToken` (see prisma/schema.prisma Student.qrToken). QEC2 identifies
 * the fixed OMR V2 sheet layout. QEC1 remains accepted for legacy
 * identity-only sheets.
 */
const QR_PREFIX = "QEC2:";
const LEGACY_QR_PREFIX = "QEC1:";

export function studentQrPayload(qrToken: string): string {
  return `${QR_PREFIX}${qrToken}`;
}

/** Extracts the qrToken back out of a scanned QR payload, or null if it's not ours. */
export function parseStudentQrPayload(payload: string): string | null {
  const prefix = payload.startsWith(QR_PREFIX) ? QR_PREFIX : payload.startsWith(LEGACY_QR_PREFIX) ? LEGACY_QR_PREFIX : null;
  if (!prefix) return null;
  const token = payload.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

export async function studentQrPngBuffer(qrToken: string, size = 240): Promise<Buffer> {
  return QRCode.toBuffer(studentQrPayload(qrToken), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}

export async function studentQrDataUrl(qrToken: string, size = 240): Promise<string> {
  return QRCode.toDataURL(studentQrPayload(qrToken), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}
