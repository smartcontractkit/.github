/**
 * Fails the check when a change-management section in the PR body is empty
 * or missing. The workflow decides whether the check applies.
 *
 * Inputs (via environment):
 *   SECTIONS:      lines of "Display name: heading text"
 *   STRIP_LINES:   lines removed from a section before the empty test
 *   STANDARD_URL:  link included in the failure message
 */

const DEFAULT_STANDARD_URL =
  "https://smartcontract-it.atlassian.net/wiki/spaces/ENG/pages/1417445401" +
  "/Infrastructure+Change+Management+Standard";

const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*)$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

function splitLines(value) {
  return (value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSectionSpec(sections) {
  return splitLines(sections).map((line) => {
    const i = line.indexOf(":");
    if (i === -1) {
      throw new Error(
        `Invalid sections line (want "Display: heading"): ${line}`,
      );
    }
    return {
      display: line.slice(0, i).trim(),
      alias: line
        .slice(i + 1)
        .trim()
        .toLowerCase(),
    };
  });
}

// Heading text: drop a CommonMark closing sequence, then normalize.
function headingText(match) {
  return match[2]
    .replace(/\s+#+\s*$/, "")
    .trim()
    .toLowerCase();
}

// Section bodies keyed by lowercased heading text. Fenced code is not scanned.
// A heading starts a new section when it matches an alias or when its level is
// the same or higher than the current section's. Deeper headings are content.
function splitSections(body, aliases) {
  const sections = new Map();
  let current = null;
  let level = 0;
  let fenced = false;
  // Bodies can use CRLF line endings; parse them like LF bodies.
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    if (FENCE_RE.test(line)) fenced = !fenced;
    const heading = fenced ? null : line.match(HEADING_RE);
    if (heading) {
      const text = headingText(heading);
      const startSection =
        current === null || heading[1].length <= level || aliases?.has(text);
      if (startSection) {
        current = text;
        level = heading[1].length;
        if (!sections.has(current)) sections.set(current, []);
        continue;
      }
    }
    if (current !== null) sections.get(current).push(line);
  }
  return sections;
}

// Removes HTML comments, including multiline ones. An unterminated comment
// blanks the rest of the text, matching how GitHub renders the body.
function stripComments(text) {
  let out = "";
  let i = 0;
  for (;;) {
    const start = text.indexOf("<!--", i);
    if (start === -1) return out + text.slice(i);
    out += text.slice(i, start);
    const end = text.indexOf("-->", start + 4);
    const stop = end === -1 ? text.length : end + 3;
    // Blank the span in place so the text before and after it cannot join.
    out += text.slice(start, stop).replace(/[^\n]/g, " ");
    i = stop;
  }
}

// Specs whose section body is empty after comment and strip-line removal.
function missingSections(body, specs, stripLines) {
  const aliases = new Set(specs.map((spec) => spec.alias));
  const sections = splitSections(stripComments(String(body || "")), aliases);
  const strip = new Set((stripLines || []).map((line) => line.trim()));
  return specs.filter((spec) => {
    const content = (sections.get(spec.alias) || [])
      .filter((line) => !strip.has(line.trim()))
      .join("\n")
      .trim();
    return content === "";
  });
}

function summarize(specs, missing) {
  const empty = new Set(missing.map((spec) => spec.display));
  return [
    "### Change management check",
    "",
    ...specs.map(
      (spec) =>
        `- ${spec.display}: ${empty.has(spec.display) ? "empty" : "present"}`,
    ),
  ].join("\n");
}

module.exports = async ({ context, core }) => {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info("This action is only applicable to pull requests.");
    return;
  }

  const specs = parseSectionSpec(process.env.SECTIONS);
  if (specs.length === 0) {
    throw new Error(
      "The sections input is empty; at least one section is required.",
    );
  }
  const stripLines = splitLines(process.env.STRIP_LINES);
  const standardUrl = process.env.STANDARD_URL || DEFAULT_STANDARD_URL;

  const missing = missingSections(pr.body, specs, stripLines);
  core.summary.addRaw(summarize(specs, missing));
  await core.summary.write();

  if (missing.length > 0) {
    core.setFailed(
      `Please fill in: ${missing.map((spec) => spec.display).join(", ")}. ` +
        `See the Infrastructure Change Management Standard: ${standardUrl}`,
    );
    return;
  }

  core.info("All change-management sections are present.");
};

module.exports.missingSections = missingSections;
module.exports.parseSectionSpec = parseSectionSpec;
module.exports.splitSections = splitSections;
module.exports.stripComments = stripComments;
