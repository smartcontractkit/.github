import { diffArrays, Change } from "diff";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Treat hyphen as part of identifiers/paths so "chainlink-common" stays a single token.
function tokenizeGeneric(s: string): string[] {
  const re =
    /(\s+|->|=>|::|\.{3}|[A-Za-z0-9_.$/-]+|\[\]|[\[\]{}()<>]|[,;:?*|&=+!%^~]|\\|\.|\|{2}|&{2})/g;
  const tokens = s.match(re);
  return tokens ?? [s];
}

function diffTokenized(a: string, b: string): Change[] {
  const A = tokenizeGeneric(a);
  const B = tokenizeGeneric(b);
  const parts = diffArrays(A, B);
  return parts.map((p) => ({
    value: p.value.join(""),
    added: p.added,
    removed: p.removed,
  })) as Change[];
}

/** Split into comma-aware segments, keeping ", " attached to the left segment. */
function splitSegments(s: string): string[] {
  const parts = s.split(/(, ?)/);
  const segs: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    segs.push(parts[i] + (parts[i + 1] ?? ""));
  }
  return segs;
}

/**
 * Always show the FULL old/new lines (no trimming), with:
 * - Comma-aware alignment so diffs never spill across arguments
 * - Token-level highlights within replaced segments
 */
export function renderTwoLineDiffPre(oldText: string, newText: string): string {
  const oldSegs = splitSegments(oldText);
  const newSegs = splitSegments(newText);
  const segDiff = diffArrays(oldSegs, newSegs);

  type Op = {
    kind: "equal" | "add" | "del" | "replace";
    a?: string[];
    b?: string[];
  };
  const ops: Op[] = [];

  // Coalesce adjacent del+add into a single replace so we can token-diff inside.
  for (const part of segDiff as Array<{
    value: string[];
    added?: boolean;
    removed?: boolean;
  }>) {
    if (part.added) {
      const prev = ops[ops.length - 1];
      if (prev && prev.kind === "del" && !prev.b) {
        prev.kind = "replace";
        prev.b = part.value;
      } else {
        ops.push({ kind: "add", b: part.value });
      }
    } else if (part.removed) {
      ops.push({ kind: "del", a: part.value });
    } else {
      ops.push({ kind: "equal", a: part.value });
    }
  }

  const outOld: string[] = [];
  const outNew: string[] = [];

  for (const op of ops) {
    if (op.kind === "equal") {
      const stable = escapeHtml((op.a ?? []).join(""));
      outOld.push(stable);
      outNew.push(stable);
      continue;
    }
    if (op.kind === "add") {
      outNew.push(`<ins>${escapeHtml((op.b ?? []).join(""))}</ins>`);
      continue;
    }
    if (op.kind === "del") {
      outOld.push(`<del>${escapeHtml((op.a ?? []).join(""))}</del>`);
      continue;
    }
    // replace: token-diff inside the segment for tight highlights
    const a = (op.a ?? []).join("");
    const b = (op.b ?? []).join("");
    const inner = diffTokenized(a, b);
    let aHtml = "",
      bHtml = "";
    for (const c of inner) {
      const esc = escapeHtml(c.value);
      if (c.added) bHtml += `<ins>${esc}</ins>`;
      else if (c.removed) aHtml += `<del>${esc}</del>`;
      else {
        aHtml += esc;
        bHtml += esc;
      }
    }
    outOld.push(aHtml);
    outNew.push(bHtml);
  }

  return `<pre>- ${outOld.join("")}\n+ ${outNew.join("")}</pre>`;
}
