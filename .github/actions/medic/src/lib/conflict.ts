/**
 * Shared conflict extraction utilities.
 *
 * Consolidates duplicated extractConflictRegions / extractConflictMetadata
 * from fixer.ts and fixer-setup.ts into a single module.
 */

import * as exec from '@actions/exec';

async function gitOutput(args: string[]): Promise<string> {
  let output = '';
  await exec.exec('git', args, {
    ignoreReturnCode: true,
    silent: true,
    listeners: { stdout: (data: Buffer) => { output += data.toString(); } },
  });
  return output.trim();
}

export async function extractConflictRegions(file: string): Promise<string> {
  let content = '';
  await exec.exec('cat', [file], {
    ignoreReturnCode: true,
    silent: true,
    listeners: { stdout: (data: Buffer) => { content += data.toString(); } },
  });

  const fileLines = content.split('\n');
  const regions: string[] = [];
  let regionStart = -1;
  const CONTEXT_LINES = 3;

  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i].startsWith('<<<<<<<')) {
      regionStart = i;
    } else if (fileLines[i].startsWith('>>>>>>>') && regionStart >= 0) {
      const ctxStart = Math.max(0, regionStart - CONTEXT_LINES);
      const ctxEnd = Math.min(fileLines.length - 1, i + CONTEXT_LINES);
      const snippet = fileLines.slice(ctxStart, ctxEnd + 1)
        .map((l, idx) => `${ctxStart + idx + 1}: ${l}`)
        .join('\n');
      regions.push(snippet);
      regionStart = -1;
    }
  }

  return regions.join('\n---\n');
}

export async function extractConflictMetadata(): Promise<string> {
  const conflictFiles = (await gitOutput(['diff', '--name-only', '--diff-filter=U']))
    .split('\n').filter(Boolean);
  if (conflictFiles.length === 0) return '';

  const lines: string[] = [];

  lines.push(`## Conflicted Files (${conflictFiles.length} total)`, '', '```');
  lines.push(...conflictFiles);
  lines.push('```', '');

  lines.push('## Conflict Regions (pre-extracted with 3 lines of context)');
  lines.push('');
  lines.push('Each block below shows the conflict markers and surrounding context from each file.');
  lines.push('Use this to plan your resolution. You still need to read each file to make edits,');
  lines.push('but you should already know what the resolution will be before reading.');
  lines.push('');

  for (const file of conflictFiles) {
    const regions = await extractConflictRegions(file);
    if (regions) {
      lines.push(`### \`${file}\``, '', '```');
      lines.push(regions);
      lines.push('```', '');
    }
  }

  lines.push('## File Renames/Moves Between Branches', '');
  const renames = await gitOutput(['diff', '--name-status', 'HEAD...MERGE_HEAD']);
  const renameLines = renames.split('\n').filter(l => /^[RCD]/.test(l));
  if (renameLines.length > 0) {
    lines.push('```', ...renameLines, '```');
  } else {
    lines.push('None detected.');
  }
  lines.push('');

  lines.push('## Auto-Merged Files (Modified by Both Branches)', '');
  lines.push('These files were changed by both branches but merged without conflict markers.');
  lines.push('Only check these if cross-file movements below indicate they need attention.');
  lines.push('');

  const prFilesRaw = await gitOutput(['log', '--name-only', '--pretty=format:', 'MERGE_HEAD..HEAD']);
  const baseFilesRaw = await gitOutput(['log', '--name-only', '--pretty=format:', 'HEAD..MERGE_HEAD']);
  const prFiles = new Set(prFilesRaw.split('\n').filter(Boolean));
  const baseFiles = new Set(baseFilesRaw.split('\n').filter(Boolean));
  const conflictSet = new Set(conflictFiles);

  const autoMerged = [...prFiles].filter(f => baseFiles.has(f) && !conflictSet.has(f));

  if (autoMerged.length > 0) {
    lines.push('| File | PR branch changes | Base branch changes |');
    lines.push('|------|------------------|-------------------|');
    for (const afile of autoMerged) {
      const prLog = await gitOutput(['log', '--oneline', '-1', 'MERGE_HEAD..HEAD', '--', afile]);
      const baseLog = await gitOutput(['log', '--oneline', '-1', 'HEAD..MERGE_HEAD', '--', afile]);
      lines.push(`| \`${afile}\` | ${prLog || '(none)'} | ${baseLog || '(none)'} |`);
    }
    lines.push('', `(${autoMerged.length} files total)`);
  } else {
    lines.push('None detected.');
  }
  lines.push('');

  lines.push('## Cross-File Code Movements', '');
  lines.push('Functions/types removed from conflicted files by the base branch that now exist');
  lines.push('elsewhere. Port the PR branch\'s additions to these new locations.');
  lines.push('');

  let foundMovements = false;
  for (const file of conflictFiles) {
    const diff = await gitOutput(['diff', 'HEAD...MERGE_HEAD', '--', file]);
    const removedSymbols = diff.split('\n')
      .filter(l => /^-\s*(func |type )/.test(l))
      .map(l => {
        const match = l.match(/(?:func |type )([A-Za-z_][A-Za-z0-9_]*)/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null);

    const uniqueSymbols = [...new Set(removedSymbols)];

    for (const sym of uniqueSymbols) {
      const grepResult = await gitOutput(['grep', '-rl', `\\b${sym}\\b`, '--', '*.go']);
      const destinations = grepResult.split('\n')
        .filter(d => d && d !== file && !d.includes('_test.go') && !d.includes('vendor/'))
        .slice(0, 5);

      if (destinations.length > 0) {
        foundMovements = true;
        lines.push(`- Symbol \`${sym}\` removed from \`${file}\`, now found in:`);
        for (const dest of destinations) {
          lines.push(`  - \`${dest}\``);
        }
      }
    }
  }

  if (!foundMovements) {
    lines.push('None detected.');
  }
  lines.push('');

  lines.push('## Per-File Branch History', '');
  for (const file of conflictFiles) {
    lines.push(`### \`${file}\``, '');
    const prLog = await gitOutput(['log', '--oneline', '-5', 'MERGE_HEAD..HEAD', '--', file]);
    lines.push('**PR branch changes (HEAD):**', '```', prLog || '  (none)', '```', '');
    const baseLog = await gitOutput(['log', '--oneline', '-5', 'HEAD..MERGE_HEAD', '--', file]);
    lines.push('**Base branch changes (MERGE_HEAD):**', '```', baseLog || '  (none)', '```', '');
  }

  return lines.join('\n');
}
