export class PayloadTooLargeError extends Error {}

export function readLimitedBody(request: Request, maxBytes: number): Promise<Buffer>;
