import { describe, it, expect } from 'vitest';
import { isAbortError } from './error-utils';

describe('isAbortError', () => {
  it('returns false for falsy inputs', () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError(false)).toBe(false);
    expect(isAbortError('')).toBe(false);
    expect(isAbortError(0)).toBe(false);
  });

  describe('Standard Error objects', () => {
    it('detects AbortError by name', () => {
      const error = new Error('Some message');
      error.name = 'AbortError';
      expect(isAbortError(error)).toBe(true);
    });

    it('detects CanceledError by name', () => {
      const error = new Error('Some message');
      error.name = 'CanceledError';
      expect(isAbortError(error)).toBe(true);
    });

    it('detects Node.js errors by code 20', () => {
      const error = new Error('Some message') as Error & { code?: number | string };
      error.code = 20;
      expect(isAbortError(error)).toBe(true);
    });

    it('detects Node.js errors by code ECONNRESET', () => {
      const error = new Error('Some message') as Error & { code?: number | string };
      error.code = 'ECONNRESET';
      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for standard errors without abort indicators', () => {
      const error = new Error('Some regular error');
      expect(isAbortError(error)).toBe(false);
    });
  });

  describe('Supabase/PostgREST plain objects', () => {
    it('detects AbortError by name', () => {
      const error = { name: 'AbortError', message: 'Something went wrong' };
      expect(isAbortError(error)).toBe(true);
    });

    it('detects FetchError aborted message', () => {
      const error = { name: 'FetchError', message: 'FetchError: request to http://localhost/api aborted' };
      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for plain objects without abort indicators', () => {
      const error = { name: 'PostgrestError', message: 'Row not found' };
      expect(isAbortError(error)).toBe(false);
    });
  });

  describe('Raw strings and string checks', () => {
    it('detects "aborted" in string', () => {
      expect(isAbortError('The request was aborted.')).toBe(true);
      expect(isAbortError('ABORTED')).toBe(true);
    });

    it('detects "abort_err" in string', () => {
      expect(isAbortError('Received ABORT_ERR from server')).toBe(true);
    });

    it('detects indicators in message property even if not Error object', () => {
      const error = { message: 'The request was aborted.' };
      expect(isAbortError(error)).toBe(true);
    });

    it('returns false for strings without abort indicators', () => {
      expect(isAbortError('Something failed')).toBe(false);
      expect(isAbortError('Database connection error')).toBe(false);
    });
  });

  it('returns false for other truthy non-error objects', () => {
    expect(isAbortError({ foo: 'bar' })).toBe(false);
    expect(isAbortError([])).toBe(false);
    expect(isAbortError(123)).toBe(false);
  });
});
