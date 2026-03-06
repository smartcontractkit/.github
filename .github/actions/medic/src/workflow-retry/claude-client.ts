/**
 * Claude analysis client using Anthropic Vertex SDK.
 *
 * Runs a tool-use conversation loop: Claude inspects a failed workflow run
 * by calling get_failure_summary and optionally get_job_log_tail, then
 * returns a structured retry/skip decision.
 */

import * as core from '@actions/core';
import type { OctokitClient } from '../types.js';
import { getWorkflowSummary } from './github-service.js';
import { DEFAULT_TAIL_BYTES, getLogTail } from './log-service.js';
import type { AnalysisResult } from './types.js';

const MODEL = 'claude-sonnet-4@20250514';
const MAX_TOOL_ROUNDS = 5;
const ANALYSIS_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a CI failure analyst. You determine whether a failed GitHub Actions workflow run should be retried or skipped.

You have tools to inspect the failure. Start by calling get_failure_summary to see which jobs failed and what annotations they produced. If the annotations are not informative enough, call get_job_log_tail for the relevant job(s).

Classify the failure into one of these categories:
- "flaky": Network timeouts (ETIMEDOUT, ECONNREFUSED, ECONNRESET), DNS failures, rate limits, transient infrastructure errors, OOM on shared runners. RETRY these.
- "infra": GitHub Actions platform issues, runner failures, out-of-disk. RETRY these.
- "build": Compilation errors, type errors, missing imports. SKIP these -- they need code fixes.
- "test": Assertion failures, test logic errors. SKIP these -- they need code fixes.
- "lint": Linter violations, formatting errors. SKIP these -- they need code fixes.

After your analysis, you MUST call the submit_analysis tool with your decision. Do NOT respond with text -- always use the tool.`;

const TOOLS = [
  {
    name: 'get_failure_summary',
    description: 'Get a summary of failed jobs and their annotations for a workflow run',
    input_schema: {
      type: 'object' as const,
      properties: {
        run_id: { type: 'number' as const, description: 'The workflow run ID' }
      },
      required: ['run_id']
    }
  },
  {
    name: 'get_job_log_tail',
    description: 'Get the last portion of logs for a specific failed job. Use when annotations are insufficient.',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_id: { type: 'number' as const, description: 'The job ID to fetch logs for' },
        bytes: { type: 'number' as const, description: 'Bytes from end of log to fetch (default 50000)' }
      },
      required: ['job_id']
    }
  },
  {
    name: 'submit_analysis',
    description: 'Submit your final analysis decision. You MUST call this tool after analyzing the failure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        decision: {
          type: 'string' as const,
          enum: ['retry', 'skip'],
          description: 'Whether to retry or skip the workflow'
        },
        category: {
          type: 'string' as const,
          enum: ['flaky', 'infra', 'build', 'test', 'lint'],
          description: 'The failure category'
        },
        reasoning: {
          type: 'string' as const,
          description: 'One sentence explanation of the decision'
        },
        confidence: {
          type: 'string' as const,
          enum: ['high', 'medium', 'low'],
          description: 'Confidence level in the decision'
        }
      },
      required: ['decision', 'category', 'reasoning', 'confidence']
    }
  }
];

type ToolName = 'get_failure_summary' | 'get_job_log_tail' | 'submit_analysis';

// Minimal types matching the Anthropic SDK response shape.
// Using our own interfaces avoids import path issues with the pnpm-hoisted SDK.
interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ContentBlock = TextContentBlock | ToolUseContentBlock | { type: string };

interface ApiMessage {
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface MessageParam {
  role: 'user' | 'assistant';
  content: string | ContentBlock[] | ToolResultBlock[];
}

/**
 * Handle a tool call from Claude by dispatching to the appropriate service.
 * Returns null for data-fetching tools (string result), or an AnalysisResult
 * for the submit_analysis tool.
 */
async function handleToolCall(
  toolName: ToolName,
  toolInput: Record<string, unknown>,
  octokit: OctokitClient,
  owner: string,
  repo: string,
  inputTokens: number,
  outputTokens: number
): Promise<string | AnalysisResult> {
  switch (toolName) {
    case 'get_failure_summary': {
      const runId = toolInput.run_id as number;
      const summary = await getWorkflowSummary(octokit, owner, repo, runId);
      return JSON.stringify(summary, null, 2);
    }
    case 'get_job_log_tail': {
      const jobId = toolInput.job_id as number;
      const bytes = (toolInput.bytes as number) || DEFAULT_TAIL_BYTES;
      return await getLogTail(octokit, owner, repo, jobId, bytes);
    }
    case 'submit_analysis': {
      return {
        decision: toolInput.decision as 'retry' | 'skip',
        category: toolInput.category as AnalysisResult['category'],
        reasoning: toolInput.reasoning as string,
        confidence: (toolInput.confidence as AnalysisResult['confidence']) || 'medium',
        inputTokens,
        outputTokens
      };
    }
    default:
      return `Unknown tool: ${String(toolName)}`;
  }
}

/**
 * Parse Claude's text response into a structured AnalysisResult.
 * Handles JSON wrapped in markdown fences or surrounded by prose.
 * Token counts are injected by the caller after accumulation across rounds.
 */
function parseAnalysisResult(text: string, inputTokens: number, outputTokens: number): AnalysisResult {
  // Strip markdown code fences
  let cleaned = text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();

  // If still not valid JSON, try to extract a JSON object from the text
  if (!cleaned.startsWith('{')) {
    const jsonMatch = cleaned.match(/\{[\s\S]*"decision"[\s\S]*"category"[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.decision || !parsed.category || !parsed.reasoning) {
    throw new Error(`Incomplete analysis result: ${JSON.stringify(parsed)}`);
  }

  return {
    decision: parsed.decision,
    category: parsed.category,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence || 'medium',
    inputTokens,
    outputTokens
  };
}

/**
 * Analyze a failed workflow run using Claude.
 * Returns an AnalysisResult or null if analysis isn't available/fails.
 */
export async function analyzeFailure(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  runId: number
): Promise<AnalysisResult | null> {
  const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!projectId) {
    core.info('Claude analysis not available (no Vertex credentials), using unconditional retry');
    return null;
  }

  let client: { messages: { create: (params: Record<string, unknown>) => Promise<ApiMessage> } };
  try {
    const mod = await import('@anthropic-ai/vertex-sdk');
    const AnthropicVertex = mod.default;
    client = new AnthropicVertex({
      projectId,
      region: process.env.CLOUD_ML_REGION || 'us-east5',
    }) as unknown as typeof client;
  } catch (error) {
    core.warning(`Failed to initialize Vertex SDK: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  core.info(`Starting Claude analysis for run ${runId}`);

  try {
    const messages: MessageParam[] = [
      { role: 'user', content: `Analyze workflow run ${runId} and determine whether it should be retried or skipped.` }
    ];

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Analysis timed out after ${ANALYSIS_TIMEOUT_MS / 1000}s`)), ANALYSIS_TIMEOUT_MS);
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await Promise.race([
        client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
          stream: false
        }),
        timeoutPromise
      ]);

      totalInputTokens += response.usage?.input_tokens ?? 0;
      totalOutputTokens += response.usage?.output_tokens ?? 0;

      // #region agent log
      core.info(`[debug-75a56e] Round ${round}: stop_reason=${response.stop_reason}, content_types=${response.content.map(b => b.type).join(',')}`);
      // #endregion

      if (response.stop_reason === 'tool_use') {
        const toolBlocks = response.content.filter(
          (b): b is ToolUseContentBlock => b.type === 'tool_use'
        );
        if (toolBlocks.length === 0) {
          throw new Error('tool_use stop reason but no tool_use blocks');
        }

        // Check if any tool call is submit_analysis (terminal)
        for (const block of toolBlocks) {
          if (block.name === 'submit_analysis') {
            // #region agent log
            core.info(`[debug-75a56e] submit_analysis called with: ${JSON.stringify(block.input)}`);
            // #endregion
            const result = await handleToolCall(
              'submit_analysis', block.input, octokit, owner, repo,
              totalInputTokens, totalOutputTokens
            ) as AnalysisResult;
            core.info(`Analysis complete: ${result.decision} (${result.category}) - ${result.reasoning} [${totalInputTokens} in / ${totalOutputTokens} out tokens]`);
            return result;
          }
        }

        messages.push({ role: 'assistant', content: response.content });

        const toolResults: ToolResultBlock[] = [];
        for (const block of toolBlocks) {
          // #region agent log
          core.info(`[debug-75a56e] Calling tool: ${block.name} with input: ${JSON.stringify(block.input)}`);
          // #endregion
          const toolResult = await handleToolCall(
            block.name as ToolName,
            block.input,
            octokit,
            owner,
            repo,
            totalInputTokens,
            totalOutputTokens
          );
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResult as string
          });
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      if (response.stop_reason === 'end_turn') {
        // Claude responded with text instead of calling submit_analysis.
        // Try to parse as JSON as a fallback.
        const textBlock = response.content.find(
          (b): b is TextContentBlock => b.type === 'text'
        );
        // #region agent log
        core.info(`[debug-75a56e] end_turn text fallback: ${textBlock?.text?.substring(0, 200) ?? '(no text)'}`);
        // #endregion
        if (textBlock?.text) {
          const result = parseAnalysisResult(textBlock.text, totalInputTokens, totalOutputTokens);
          core.info(`Analysis complete (text fallback): ${result.decision} (${result.category}) - ${result.reasoning}`);
          return result;
        }
        throw new Error('No text content in final response');
      }

      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }

    throw new Error(`Analysis exceeded ${MAX_TOOL_ROUNDS} tool rounds without a decision`);
  } catch (error) {
    core.warning(`Claude analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
