/**
 * Unified utility to detect AbortErrors across the application.
 * This handles browser DOMExceptions, Node.js AbortErrors, and Supabase client aborts.
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;

  // Basic check for Error objects
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'CanceledError') return true;
    const code = (error as { code?: number | string }).code;
    if (code === 20 || code === 'ECONNRESET') return true;
  }

  // Supabase/PostgREST specific error objects
  const errObj = error as Record<string, unknown>;
  if (errObj.name === 'AbortError' || errObj.message === 'FetchError: request to ... aborted') return true;
  
  // Standard string checks for raw errors
  const message = String(errObj.message || error).toLowerCase();
  if (message.includes('aborted') || message.includes('abort_err')) return true;

  return false;
}
