/**
 * Fails the check when a change-management section in the PR body is empty
 * or missing. Exempt: Renovate branches, docs-only PRs, dev-only PRs.
 *
 * Inputs (via environment):
 *   SECTIONS:      lines of "Display name: heading text"
 *   STRIP_LINES:   lines removed from a section before the empty test
 *   DOCS_PATHS:    glob lines; a PR whose files all match is docs-only
 *   DEV_PATHS:     glob lines; a PR whose files all match is dev-only
 *   HEAD_PREFIXES: comma-separated head-branch prefixes that are exempt
 *   STANDARD_URL:  link included in the failure message
 */

const DEFAULT_STANDARD_URL =
  "https://smartcontract-it.atlassian.net/wiki/spaces/ENG/pages/1417445401" +
  "/Infrastructure+Change+Management+Standard";

const HEADING_RE = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

function splitLines(value) {
  return (value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// Converts a glob to an anchored RegExp. `**` crosses `/`, `*` does not.
function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
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

// Section bodies keyed by lowercased heading text. Fenced code is not scanned.
function splitSections(body) {
  const sections = new Map();
  let current = null;
  let fenced = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) fenced = !fenced;
    const heading = fenced ? null : line.match(HEADING_RE);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current !== null) sections.get(current).push(line);
  }
  return sections;
}

// Removes HTML comments, including multiline ones. An unterminated comment
// drops the rest of the text, matching how GitHub renders the body.
function stripComments(text) {
  let out = "";
  let i = 0;
  for (;;) {
    const start = text.indexOf("<!--", i);
    if (start === -1) return out + text.slice(i);
    out += text.slice(i, start);
    const end = text.indexOf("-->", start + 4);
    if (end === -1) return out;
    i = end + 3;
  }
}

// Specs whose section body is empty after comment and strip-line removal.
function missingSections(body, specs, stripLines) {
  const sections = splitSections(stripComments(String(body || "")));
  const strip = new Set((stripLines || []).map((line) => line.trim()));
  return specs.filter((spec) => {
    const content = (sections.get(spec.alias) || [])
      .filter((line) => !strip.has(line.trim()))
      .join("\n")
      .trim();
    return content === "";
  });
}

async function listFiles(github, context) {
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;
  const files = [];
  // The API caps at 3000 files; 30 pages of 100.
  for (let page = 1; page <= 30; page++) {
    const { data } = await github.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: 100,
      page,
    });
    files.push(...data.map((file) => file.filename));
    if (data.length < 100) break;
  }
  return files;
}

// Reason string when every changed file matches one glob set, else null.
function classifyFiles(files, docsPaths, devPaths) {
  if (files.length === 0) return null;
  const allMatch = (regexps) =>
    regexps.length > 0 &&
    files.every((file) => regexps.some((re) => re.test(file)));
  if (allMatch(docsPaths)) return "docs-only";
  if (allMatch(devPaths)) return "dev-only";
  return null;
}

// Reason string when the PR is exempt, else null.
async function findExemption({
  github,
  context,
  headPrefixes,
  docsPaths,
  devPaths,
}) {
  const headRef = context.payload.pull_request.head.ref || "";
  const prefix = headPrefixes.find((p) => headRef.startsWith(p));
  if (prefix) return `head branch starts with ${prefix}`;

  return classifyFiles(await listFiles(github, context), docsPaths, devPaths);
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

module.exports = async ({ context, core, github }) => {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info("This action is only applicable to pull requests.");
    return;
  }

  const specs = parseSectionSpec(process.env.SECTIONS);
  const stripLines = splitLines(process.env.STRIP_LINES);
  // action.yml supplies the defaults. An explicit empty input disables the
  // exemption.
  const docsPaths = splitLines(process.env.DOCS_PATHS).map(globToRegExp);
  const devPaths = splitLines(process.env.DEV_PATHS).map(globToRegExp);
  const headPrefixes = (process.env.HEAD_PREFIXES || "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean);
  const standardUrl = process.env.STANDARD_URL || DEFAULT_STANDARD_URL;

  const exempt = await findExemption({
    github,
    context,
    headPrefixes,
    docsPaths,
    devPaths,
  });
  if (exempt) {
    core.info(
      `Exempt (${exempt}): the change-management check does not apply.`,
    );
    return;
  }

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

module.exports.classifyFiles = classifyFiles;
module.exports.globToRegExp = globToRegExp;
module.exports.missingSections = missingSections;
module.exports.parseSectionSpec = parseSectionSpec;
module.exports.splitSections = splitSections;
