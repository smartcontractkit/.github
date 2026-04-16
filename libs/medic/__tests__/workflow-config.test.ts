import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseConfig, parseMedicConfig, isWorkflowRetryable } from '../src/workflow-config';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
}));

describe('workflow-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseConfig', () => {
    it('should parse a valid config with workflow names', () => {
      const yaml = `
workflow_retry:
  max_attempts: 3
  retryable:
    - "flaky-ci-test.yml"
    - "ci-core.yml"
    - "integration-tests.yml"
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual(['flaky-ci-test.yml', 'ci-core.yml', 'integration-tests.yml']);
    });

    it('should parse config without quotes around workflow names', () => {
      const yaml = `
workflow_retry:
  max_attempts: 2
  retryable:
    - flaky-ci-test.yml
    - ci-core.yml
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(2);
      expect(config.retryable).toEqual(['flaky-ci-test.yml', 'ci-core.yml']);
    });

    it('should handle comments in yaml', () => {
      const yaml = `
# Medic Configuration
workflow_retry:
  # Maximum retry attempts
  max_attempts: 5
  retryable:
    - "flaky-ci-test.yml"
    # - "disabled-workflow.yml"
    - "ci-core.yml"
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(5);
      expect(config.retryable).toEqual(['flaky-ci-test.yml', 'ci-core.yml']);
    });

    it('should return defaults for empty config', () => {
      const config = parseConfig('');

      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual([]);
    });

    it('should return defaults for config without workflow_retry section', () => {
      const yaml = `
some_other_section:
  key: value
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual([]);
    });

    it('should use default max_attempts if not specified', () => {
      const yaml = `
workflow_retry:
  retryable:
    - "ci-core.yml"
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual(['ci-core.yml']);
    });

    it('should use empty retryable array if not specified', () => {
      const yaml = `
workflow_retry:
  max_attempts: 5
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(5);
      expect(config.retryable).toEqual([]);
    });

    it('should handle single workflow in retryable list', () => {
      const yaml = `
workflow_retry:
  max_attempts: 3
  retryable:
    - "single-workflow.yml"
`;
      const config = parseConfig(yaml);

      expect(config.retryable).toEqual(['single-workflow.yml']);
    });

    it('should filter out non-string items from retryable array', () => {
      const yaml = `
workflow_retry:
  max_attempts: 3
  retryable:
    - "valid-workflow.yml"
    - 123
    - true
    - "another-valid.yml"
`;
      const config = parseConfig(yaml);

      expect(config.retryable).toEqual(['valid-workflow.yml', 'another-valid.yml']);
    });

    it('should warn and use defaults when types are wrong', () => {
      const yaml = `
workflow_retry:
  max_attempts: not_a_number
  retryable: not_an_array
`;
      const config = parseConfig(yaml);
      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual([]);
    });

    it('should parse the actual medic.yml format from the repo', () => {
      const yaml = `# Medic Configuration
workflow_retry:
  max_attempts: 3
  retryable:
    - "flaky-ci-test.yml"
`;
      const config = parseConfig(yaml);

      expect(config.max_attempts).toBe(3);
      expect(config.retryable).toEqual(['flaky-ci-test.yml']);
    });
  });

  describe('parseMedicConfig – merge_conflict section', () => {
    it('should parse a valid merge_conflict section', () => {
      const yaml = `
merge_conflict:
  allowed_authors:
    - "alice"
    - "bob"
  max_attempts: 5
  activity_threshold_hours: 24
  skip_labels:
    - "hold"
`;
      const config = parseMedicConfig(yaml);
      expect(config.merge_conflict.allowed_authors).toEqual(['alice', 'bob']);
      expect(config.merge_conflict.max_attempts).toBe(5);
      expect(config.merge_conflict.activity_threshold_hours).toBe(24);
      expect(config.merge_conflict.skip_labels).toEqual(['hold']);
    });

    it('should return defaults when merge_conflict section is absent', () => {
      const yaml = `
workflow_retry:
  retryable:
    - "ci.yml"
`;
      const config = parseMedicConfig(yaml);
      expect(config.merge_conflict.allowed_authors).toContain('patrickhuie19');
      expect(config.merge_conflict.max_attempts).toBe(3);
      expect(config.merge_conflict.activity_threshold_hours).toBe(48);
      expect(config.merge_conflict.skip_labels).toContain('medic-skip');
    });

    it('should use defaults for missing fields within merge_conflict', () => {
      const yaml = `
merge_conflict:
  max_attempts: 10
`;
      const config = parseMedicConfig(yaml);
      expect(config.merge_conflict.max_attempts).toBe(10);
      expect(config.merge_conflict.allowed_authors).toContain('patrickhuie19');
      expect(config.merge_conflict.activity_threshold_hours).toBe(48);
    });

    it('should parse both sections together', () => {
      const yaml = `
merge_conflict:
  allowed_authors: ["alice"]
  max_attempts: 7
workflow_retry:
  max_attempts: 2
  retryable:
    - "ci.yml"
`;
      const config = parseMedicConfig(yaml);
      expect(config.merge_conflict.allowed_authors).toEqual(['alice']);
      expect(config.merge_conflict.max_attempts).toBe(7);
      expect(config.workflow_retry.max_attempts).toBe(2);
      expect(config.workflow_retry.retryable).toEqual(['ci.yml']);
    });

    it('should filter non-string items from allowed_authors', () => {
      const yaml = `
merge_conflict:
  allowed_authors:
    - "alice"
    - 123
    - true
    - "bob"
`;
      const config = parseMedicConfig(yaml);
      expect(config.merge_conflict.allowed_authors).toEqual(['alice', 'bob']);
    });
  });

  describe('isWorkflowRetryable', () => {
    it('should return true for workflows in the retryable list', () => {
      const config = {
        max_attempts: 3,
        retryable: ['ci-core.yml', 'integration-tests.yml'],
      };

      expect(isWorkflowRetryable('ci-core.yml', config)).toBe(true);
      expect(isWorkflowRetryable('integration-tests.yml', config)).toBe(true);
    });

    it('should return false for workflows not in the retryable list', () => {
      const config = {
        max_attempts: 3,
        retryable: ['ci-core.yml'],
      };

      expect(isWorkflowRetryable('security-scan.yml', config)).toBe(false);
      expect(isWorkflowRetryable('lint.yml', config)).toBe(false);
    });

    it('should return false for empty retryable list', () => {
      const config = {
        max_attempts: 3,
        retryable: [],
      };

      expect(isWorkflowRetryable('any-workflow.yml', config)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const config = {
        max_attempts: 3,
        retryable: ['CI-Core.yml'],
      };

      expect(isWorkflowRetryable('CI-Core.yml', config)).toBe(true);
      expect(isWorkflowRetryable('ci-core.yml', config)).toBe(false);
    });
  });
});
