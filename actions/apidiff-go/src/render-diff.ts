/**
 * This logic is best maintained by an LLM. It is a bunch
 * of tedious string manipulation and formatting.
 */
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

/** Split "func(...)[ return]" into head, params, ret (ret may be empty). */
function splitFuncSignature(sig: string): {
  head: string;
  params: string;
  ret: string;
} {
  const funcIdx = sig.indexOf("func(");
  if (funcIdx === -1) return { head: "", params: sig, ret: "" };

  // Find the matching ')' for the first '(' after "func"
  let i = funcIdx + 4; // at '('
  let depthPar = 0,
    depthBr = 0,
    depthBrace = 0;
  let startParams = -1,
    endParams = -1;

  for (; i < sig.length; i++) {
    const ch = sig[i];
    if (ch === "(") {
      depthPar++;
      if (startParams === -1) startParams = i + 1; // first char inside params
    } else if (ch === ")") {
      depthPar--;
      if (depthPar === 0) {
        endParams = i;
        i++;
        break;
      } // position right after ')'
    } else if (ch === "[") depthBr++;
    else if (ch === "]") depthBr--;
    else if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace--;
  }

  if (startParams === -1 || endParams === -1) {
    // Fallback: something odd—treat whole as params
    return { head: sig, params: "", ret: "" };
  }

  const head = sig.slice(0, funcIdx + 5); // include "func("
  const params = sig.slice(startParams, endParams);
  const after = sig.slice(i); // after ')'
  const ret = after.trim(); // may be "", a single type, or "(...)" etc.

  return { head, params, ret };
}

/** Renders compact, correct layout: params and return are diffed and printed separately in <pre>. */
/** One-line-per-parameter; params and return diffed separately; inline <ins>/<del>. */
export function renderFuncDiffCompactPre(
  oldText: string,
  newText: string,
): string {
  const oldParts = splitFuncSignature(oldText);
  const newParts = splitFuncSignature(newText);

  // PARAMS: comma-aware diff
  const oldSegs = splitSegments(oldParts.params);
  const newSegs = splitSegments(newParts.params);
  const segDiff = diffArrays(oldSegs, newSegs);

  type Op = {
    kind: "equal" | "add" | "del" | "replace";
    a?: string[];
    b?: string[];
  };
  const ops: Op[] = [];
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
      } else ops.push({ kind: "add", b: part.value });
    } else if (part.removed) {
      ops.push({ kind: "del", a: part.value });
    } else {
      ops.push({ kind: "equal", a: part.value });
    }
  }

  const lines: string[] = [];
  const IND = "  ";

  // func(
  lines.push(`${escapeHtml(oldParts.head)}`);

  // One line per param segment
  const pushStable = (s: string) => {
    const stable = escapeHtml(s);
    if (stable.trim()) lines.push(`${IND}${stable}`);
  };
  const pushDel = (s: string) => {
    const esc = escapeHtml(s);
    if (esc.trim()) lines.push(`${IND}- <del>${esc}</del>`);
  };
  const pushAdd = (s: string) => {
    const esc = escapeHtml(s);
    if (esc.trim()) lines.push(`${IND}+ <ins>${esc}</ins>`);
  };

  for (const op of ops) {
    if (op.kind === "equal") {
      for (const s of op.a ?? []) pushStable(s);
      continue;
    }

    if (op.kind === "del") {
      // ONE LINE PER DELETED PARAM
      for (const s of op.a ?? []) pushDel(s);
      continue;
    }

    if (op.kind === "add") {
      // ONE LINE PER ADDED PARAM (usually a single consolidated arg)
      for (const s of op.b ?? []) pushAdd(s);
      continue;
    }

    // replace: if it's truly 1 ↔ 1, token-diff within the param; otherwise, expand
    const aList = op.a ?? [];
    const bList = op.b ?? [];
    if (aList.length === 1 && bList.length === 1) {
      const a = aList[0],
        b = bList[0];
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
      if (aHtml.trim()) lines.push(`${IND}- ${aHtml}`);
      if (bHtml.trim()) lines.push(`${IND}+ ${bHtml}`);
    } else {
      // Many→one or one→many: show each old on its own '-' line, then each new on its own '+' line
      for (const s of aList) pushDel(s);
      for (const s of bList) pushAdd(s);
    }
  }

  // Close params on its own line
  lines.push(`)`);

  // RETURN: diff separately from params
  const oldRet = oldParts.ret;
  const newRet = newParts.ret;

  if (oldRet === newRet) {
    if (oldRet) lines.push(escapeHtml(oldRet));
  } else {
    // - old
    if (oldRet) {
      const d = diffTokenized(oldRet, newRet);
      let oHtml = "";
      for (const c of d) {
        const esc = escapeHtml(c.value);
        if (c.removed) oHtml += `<del>${esc}</del>`;
        else if (!c.added) oHtml += esc;
      }
      lines.push(`- ${oHtml}`);
    }
    // + new
    if (newRet) {
      const d = diffTokenized(oldRet, newRet);
      let nHtml = "";
      for (const c of d) {
        const esc = escapeHtml(c.value);
        if (c.added) nHtml += `<ins>${esc}</ins>`;
        else if (!c.removed) nHtml += esc;
      }
      lines.push(`+ ${nHtml}`);
    }
  }

  return `<pre>${lines.join("\n")}</pre>`;
}
