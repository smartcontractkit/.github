/**
 * Failure Scenarios for Workflow Retry Testing
 * 
 * These tests can be controlled via environment variables to produce
 * different types of failures for testing the workflow retry analyzer.
 * 
 * Environment variables:
 * - FAIL_TEST=true  → triggers assertion failures
 * - FAIL_FLAKY=true → triggers simulated flaky failures (timeout, OOM)
 */
import { describe, it, expect } from 'vitest';

describe('Failure Scenarios (for retry testing)', () => {
  
  it('should pass normally', () => {
    expect(1 + 1).toBe(2);
  });

  it('basic math operations work', () => {
    expect(10 * 5).toBe(50);
    expect(100 / 4).toBe(25);
  });

  describe('controlled test failures', () => {
    
    it('assertion failure - wrong value', () => {
      if (process.env.FAIL_TEST === 'true') {
        expect(42).toBe(0);
      } else {
        expect(42).toBe(42);
      }
    });

    it('assertion failure - type mismatch', () => {
      if (process.env.FAIL_TEST === 'true') {
        expect('hello').toBe(123);
      } else {
        expect('hello').toBe('hello');
      }
    });

    it('assertion failure - array comparison', () => {
      if (process.env.FAIL_TEST === 'true') {
        expect([1, 2, 3]).toEqual([1, 2, 4]);
      } else {
        expect([1, 2, 3]).toEqual([1, 2, 3]);
      }
    });
  });

  describe('controlled flaky failures', () => {
    
    it('flaky - network timeout simulation', async () => {
      if (process.env.FAIL_FLAKY === 'true') {
        await new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('ETIMEDOUT: connection timed out after 30000ms'));
          }, 50);
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(true).toBe(true);
      }
    });

    it('flaky - connection refused simulation', async () => {
      if (process.env.FAIL_FLAKY === 'true') {
        throw new Error('ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:5432');
      }
      expect(true).toBe(true);
    });

    it('flaky - resource exhaustion simulation', () => {
      if (process.env.FAIL_FLAKY === 'true') {
        throw new Error('ENOMEM: not enough memory, cannot allocate 1073741824 bytes');
      }
      expect(true).toBe(true);
    });

    it('flaky - rate limit simulation', async () => {
      if (process.env.FAIL_FLAKY === 'true') {
        throw new Error('HTTP 429: Rate limit exceeded. Retry after 60 seconds.');
      }
      expect(true).toBe(true);
    });

    it('flaky - DNS resolution failure', async () => {
      if (process.env.FAIL_FLAKY === 'true') {
        throw new Error('ENOTFOUND: getaddrinfo ENOTFOUND api.example.com');
      }
      expect(true).toBe(true);
    });
  });
});
