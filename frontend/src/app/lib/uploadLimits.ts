/** Max bytes per student enrollment document upload (must match api/upload_limits.php). */
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_DOCUMENT_UPLOAD_LABEL = '10MB';

export function isDocumentUploadTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES;
}
