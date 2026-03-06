import { describe, it, expect } from 'vitest';
import {
  isAuthorAllowed,
  hasSkipLabel,
  hasExceededMaxAttempts,
  hasLockLabel,
  getAttemptCount,
  isRecentlyActive
} from '../config.js';

describe('config', () => {
  describe('isAuthorAllowed', () => {
    it('should return true for allowed authors', () => {
      expect(isAuthorAllowed('patrickhuie19')).toBe(true);
      expect(isAuthorAllowed('bolekk')).toBe(true);
      expect(isAuthorAllowed('tofel')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isAuthorAllowed('PatrickHuie19')).toBe(true);
      expect(isAuthorAllowed('BOLEKK')).toBe(true);
      expect(isAuthorAllowed('Tofel')).toBe(true);
    });

    it('should return false for non-allowed authors', () => {
      expect(isAuthorAllowed('randomuser')).toBe(false);
      expect(isAuthorAllowed('unknown')).toBe(false);
    });

    it('should accept a custom allowlist override', () => {
      expect(isAuthorAllowed('customuser', ['customuser'])).toBe(true);
      expect(isAuthorAllowed('patrickhuie19', ['customuser'])).toBe(false);
    });
  });

  describe('hasSkipLabel', () => {
    it('should return true when skip label present', () => {
      expect(hasSkipLabel(['medic-skip'])).toBe(true);
      expect(hasSkipLabel(['do not merge'])).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(hasSkipLabel(['MEDIC-SKIP'])).toBe(true);
      expect(hasSkipLabel(['Do Not Merge'])).toBe(true);
    });

    it('should return false when no skip labels', () => {
      expect(hasSkipLabel(['bug', 'enhancement'])).toBe(false);
      expect(hasSkipLabel([])).toBe(false);
    });

    it('should match partial labels containing skip text', () => {
      expect(hasSkipLabel(['wip-feature'])).toBe(true);
    });

    it('should accept custom skip labels override', () => {
      expect(hasSkipLabel(['custom-skip'], ['custom-skip'])).toBe(true);
      expect(hasSkipLabel(['medic-skip'], ['custom-skip'])).toBe(false);
    });
  });

  describe('hasExceededMaxAttempts', () => {
    it('should return false when no attempt labels', () => {
      expect(hasExceededMaxAttempts([])).toBe(false);
    });

    it('should return false when attempts below max', () => {
      expect(hasExceededMaxAttempts(['medic-attempts:2'])).toBe(false);
      expect(hasExceededMaxAttempts(['medic-attempts:1'], 3)).toBe(false);
    });

    it('should return true when attempts equal max', () => {
      expect(hasExceededMaxAttempts(['medic-attempts:3'])).toBe(true);
      expect(hasExceededMaxAttempts(['medic-attempts:3'], 3)).toBe(true);
    });

    it('should return true when attempts exceed max', () => {
      expect(hasExceededMaxAttempts(['medic-attempts:4'], 3)).toBe(true);
    });

    it('should respect custom maxAttempts', () => {
      expect(hasExceededMaxAttempts(['medic-attempts:3'], 5)).toBe(false);
      expect(hasExceededMaxAttempts(['medic-attempts:5'], 5)).toBe(true);
    });
  });

  describe('hasLockLabel', () => {
    it('should return true when lock label present', () => {
      expect(hasLockLabel(['medic-in-progress'])).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(hasLockLabel(['MEDIC-IN-PROGRESS'])).toBe(true);
    });

    it('should return false when lock label not present', () => {
      expect(hasLockLabel(['bug', 'enhancement'])).toBe(false);
      expect(hasLockLabel([])).toBe(false);
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 when no attempt labels', () => {
      expect(getAttemptCount(['bug', 'enhancement'])).toBe(0);
      expect(getAttemptCount([])).toBe(0);
    });

    it('should extract attempt number from label', () => {
      expect(getAttemptCount(['medic-attempts:1'])).toBe(1);
      expect(getAttemptCount(['medic-attempts:2'])).toBe(2);
      expect(getAttemptCount(['medic-attempts:3'])).toBe(3);
    });

    it('should work with other labels present', () => {
      expect(getAttemptCount(['bug', 'medic-attempts:2', 'enhancement'])).toBe(2);
    });

    it('should return 0 for malformed labels', () => {
      expect(getAttemptCount(['medic-attempts:'])).toBe(0);
      expect(getAttemptCount(['medic-attempts:abc'])).toBe(0);
    });
  });

  describe('isRecentlyActive', () => {
    it('should return true for recent dates', () => {
      const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(isRecentlyActive(recent)).toBe(true);
    });

    it('should return false for old dates', () => {
      const old = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      expect(isRecentlyActive(old)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRecentlyActive(undefined)).toBe(false);
    });

    it('should return true for dates just under default threshold', () => {
      const boundary = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString();
      expect(isRecentlyActive(boundary)).toBe(true);
    });

    it('should respect custom threshold override', () => {
      const date = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(); // 10 hours ago
      expect(isRecentlyActive(date, 12)).toBe(true);
      expect(isRecentlyActive(date, 8)).toBe(false);
    });
  });
});

