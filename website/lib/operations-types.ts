export const requestTypes = ['orders', 'quotes', 'contacts'] as const;
export type RequestType = typeof requestTypes[number];
export type OperationsBindings = {DB: D1Database; BUCKET?: R2Bucket; [key: string]: unknown};
export type RequestRecord = {id: string; name: string; email: string; status: string; created_at: string; number?: string; user_id?: string | null; [key: string]: unknown};
export class OperationError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
