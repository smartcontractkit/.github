import { describe, it, expect, vi } from 'vitest';

// Mock @actions/core to avoid side effects
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  getInput: vi.fn(),
  setOutput: vi.fn()
}));

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// Inline parseClaudeTokens for testing (avoids importing fixer.ts which has side effects)
function parseClaudeTokens(output: string): TokenUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  
  try {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('"type":"result"') || line.includes('"type": "result"')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.input_tokens) inputTokens = parsed.input_tokens;
          if (parsed.output_tokens) outputTokens = parsed.output_tokens;
          if (parsed.cache_creation_input_tokens) cacheCreationTokens = parsed.cache_creation_input_tokens;
          if (parsed.cache_read_input_tokens) cacheReadTokens = parsed.cache_read_input_tokens;
        } catch {
          // Continue to next line
        }
      }
    }
  } catch {
    // Return zeros on error
  }
  
  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
}

describe('parseClaudeTokens', () => {
  it('should extract token counts from result line', () => {
    const output = `{"type":"text","text":"Working on conflicts..."}
{"type":"result","input_tokens":45230,"output_tokens":12847}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(45230);
    expect(result.outputTokens).toBe(12847);
    expect(result.cacheCreationTokens).toBe(0);
    expect(result.cacheReadTokens).toBe(0);
  });

  it('should extract cache token counts', () => {
    const output = `{"type":"result","input_tokens":219,"output_tokens":15091,"cache_creation_input_tokens":84000,"cache_read_input_tokens":0}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(219);
    expect(result.outputTokens).toBe(15091);
    expect(result.cacheCreationTokens).toBe(84000);
    expect(result.cacheReadTokens).toBe(0);
  });

  it('should handle result with spaces in JSON', () => {
    const output = `{"type": "result", "input_tokens": 1000, "output_tokens": 500}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
  });

  it('should return zeros for empty output', () => {
    const result = parseClaudeTokens('');
    
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.cacheCreationTokens).toBe(0);
    expect(result.cacheReadTokens).toBe(0);
  });

  it('should return zeros when no result line', () => {
    const output = `{"type":"text","text":"Working..."}
{"type":"tool_use","name":"write_file"}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it('should handle malformed JSON gracefully', () => {
    const output = `{"type":"result","input_tokens":invalid}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it('should use last result line if multiple present', () => {
    const output = `{"type":"result","input_tokens":100,"output_tokens":50}
{"type":"result","input_tokens":200,"output_tokens":100,"cache_creation_input_tokens":5000}`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(100);
    expect(result.cacheCreationTokens).toBe(5000);
  });

  it('should handle mixed content with result', () => {
    const output = `Some random text
{"type":"text","text":"Analyzing..."}
More text here
{"type":"result","input_tokens":5000,"output_tokens":2500,"cache_read_input_tokens":30000}
Final output`;
    
    const result = parseClaudeTokens(output);
    
    expect(result.inputTokens).toBe(5000);
    expect(result.outputTokens).toBe(2500);
    expect(result.cacheReadTokens).toBe(30000);
  });
});
