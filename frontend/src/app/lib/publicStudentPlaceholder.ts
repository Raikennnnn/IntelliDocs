/**
 * Public-page student-name privacy helper.
 *
 * Policy (per design "Public Page Privacy" / Requirements 8.3, 8.4):
 *   - Public marketing pages MUST NOT render any `users.*name*` value.
 *   - When public copy wants to refer to "a student", it goes through this
 *     helper. If the build-time env var `VITE_PUBLIC_STUDENT_PLACEHOLDER`
 *     is set to a non-empty string, we render that placeholder. Otherwise
 *     the reference is omitted entirely (caller renders nothing).
 *
 * Usage:
 *   const placeholder = getPublicStudentPlaceholder();
 *   {placeholder && <p>Quote from {placeholder}.</p>}
 *
 *   // Or, for a complete sentence that should be omitted when unset:
 *   const sentence = renderWithPublicStudentPlaceholder(
 *     (name) => `Hear what ${name} has to say.`,
 *   );
 *   {sentence && <p>{sentence}</p>}
 *
 * The helper reads from `import.meta.env` so the value is captured at build
 * time. There is no runtime fetch — public pages must never depend on a
 * live user record for this content.
 */

const RAW_PLACEHOLDER: string | undefined =
  // Vite inlines `import.meta.env.VITE_*` at build time.
  (import.meta.env.VITE_PUBLIC_STUDENT_PLACEHOLDER as string | undefined);

const PLACEHOLDER: string | null = (() => {
  if (typeof RAW_PLACEHOLDER !== 'string') return null;
  const trimmed = RAW_PLACEHOLDER.trim();
  return trimmed.length > 0 ? trimmed : null;
})();

/**
 * Returns the configured public student placeholder, or `null` when the
 * env var is unset / blank. Callers MUST treat `null` as "omit the
 * reference entirely" — do not substitute a hard-coded fallback.
 */
export function getPublicStudentPlaceholder(): string | null {
  return PLACEHOLDER;
}

/**
 * Convenience wrapper for rendering a sentence that mentions a student.
 * The `build` callback receives the placeholder text and returns the full
 * rendered string. When the env var is unset, this returns `null` and the
 * caller should render nothing.
 */
export function renderWithPublicStudentPlaceholder(
  build: (placeholder: string) => string,
): string | null {
  return PLACEHOLDER === null ? null : build(PLACEHOLDER);
}
