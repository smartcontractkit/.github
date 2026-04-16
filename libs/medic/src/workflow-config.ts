/**
 * Loads and validates .github/medic.yml using Zod.
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import yaml from 'js-yaml';
import * as path from 'path';
import { z } from 'zod';
import type { MedicConfig, MergeConflictConfig, WorkflowRetryConfig } from './types';

export const DEFAULT_MERGE_CONFLICT_CONFIG: MergeConflictConfig = {
  allowed_authors: ['patrickhuie19', 'bolekk', 'tofel'],
  max_attempts: 3,
  activity_threshold_hours: 48,
  skip_labels: ['medic-skip', 'do not merge', 'do-not-merge', 'wip'],
};

const DEFAULT_WORKFLOW_RETRY_CONFIG: WorkflowRetryConfig = { max_attempts: 3, retryable: [] };

const DEFAULT_MEDIC_CONFIG: MedicConfig = {
  merge_conflict: DEFAULT_MERGE_CONFLICT_CONFIG,
  workflow_retry: DEFAULT_WORKFLOW_RETRY_CONFIG,
};

const stringArray = z.preprocess(
  (val) => (Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string') : []),
  z.array(z.string()),
);

const mergeConflictSchema = z.object({
  allowed_authors: stringArray.default(DEFAULT_MERGE_CONFLICT_CONFIG.allowed_authors),
  max_attempts: z.number().int().min(1).default(3),
  activity_threshold_hours: z.number().min(1).default(48),
  skip_labels: stringArray.default(DEFAULT_MERGE_CONFLICT_CONFIG.skip_labels),
});

const workflowRetrySchema = z.object({
  max_attempts: z.number().int().min(1).default(3),
  retryable: stringArray.default([]),
});

const configFileSchema = z
  .object({
    merge_conflict: mergeConflictSchema.optional(),
    workflow_retry: workflowRetrySchema.optional(),
  })
  .passthrough();

function parseYaml(content: string): MedicConfig {
  const raw = yaml.load(content);
  if (!raw || typeof raw !== 'object') {
    core.warning('Empty config file, using defaults');
    return DEFAULT_MEDIC_CONFIG;
  }

  const result = configFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    core.warning(`Invalid medic.yml:\n${issues}\nUsing defaults.`);
    return DEFAULT_MEDIC_CONFIG;
  }

  return {
    merge_conflict: result.data.merge_conflict ?? DEFAULT_MERGE_CONFLICT_CONFIG,
    workflow_retry: result.data.workflow_retry ?? DEFAULT_WORKFLOW_RETRY_CONFIG,
  };
}

export function parseMedicConfig(content: string): MedicConfig {
  try {
    return parseYaml(content);
  } catch (error) {
    core.warning(`Failed to parse config: ${error instanceof Error ? error.message : String(error)}`);
    return DEFAULT_MEDIC_CONFIG;
  }
}

export function parseConfig(content: string): WorkflowRetryConfig {
  return parseMedicConfig(content).workflow_retry;
}

export function loadMedicConfigFromFile(filePath: string = '.github/medic.yml'): MedicConfig {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      core.warning(`Config file not found at ${absolutePath}, using defaults`);
      return DEFAULT_MEDIC_CONFIG;
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    return parseMedicConfig(content);
  } catch (error) {
    core.warning(`Failed to load config from file: ${error instanceof Error ? error.message : String(error)}`);
    return DEFAULT_MEDIC_CONFIG;
  }
}

export function isWorkflowRetryable(workflowFile: string, config: WorkflowRetryConfig): boolean {
  return config.retryable.includes(workflowFile);
}
