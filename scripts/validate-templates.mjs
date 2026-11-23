// Validate every template in templates/ against the workflow schema of the
// latest ctrlyoke release, plus the library's own rules.
//
//   npm run validate                      schema from the latest release tag
//   npm run validate -- --schema <file>   a local workflow-schema.json instead
//   npm run validate -- --tag v0.9.0      the schema from a given ctrlyoke tag
//
// Validation is strict: a field the latest release does not know fails, so a
// template never asks users for a ctrlyoke they cannot install yet.
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  listTemplateFiles,
  META_LIMITS,
  readTemplate,
  TAG_PATTERN,
  TEMPLATE_ID_PATTERN,
  templateIdOf,
} from "./lib.mjs";

const CTRLYOKE_REPO = "FuzzyNova/ctrlyoke";
const SCHEMA_PATH_IN_REPO = "schemas/workflow-schema.json";
const BUILT_IN_MANIFEST_PATH_IN_REPO = "src/templates/workflows/manifest.json";
/** Built-in ids that have no file in the manifest. */
const UNLISTED_BUILT_IN_IDS = ["blank"];
const REQUIRED_EXTENSION = ".ctrlyoke.yaml";

/**
 * Content worth a human's second look. These never fail the check: review is
 * the real gate, and this only points reviewers at the lines that matter.
 */
const TRIPWIRES = [
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, "recursive forced delete"],
  [
    /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(ba|z)?sh\b/i,
    "downloads and runs a script",
  ],
  [
    /\b(curl|wget)\b[^\n]*(-d|--data|-F|--upload-file|-T)\b/i,
    "uploads data to a URL",
  ],
  [/\bbase64\b[^\n]*(-d|--decode)\b/i, "decodes hidden content"],
  [/\b(ssh|scp|rsync)\b[^\n]*@/i, "connects to a remote host"],
  [
    /~\/\.ssh|\.aws\/credentials|id_rsa|\.npmrc|\.git-credentials/i,
    "reads credential files",
  ],
  [/\bgit\s+push\b[^\n]*(--force|-f)\b/i, "force-pushes"],
  [/\b(sudo|chmod\s+777|mkfs|dd\s+if=)/i, "privileged or destructive command"],
  [
    /\bdangerously|--yolo|bypassPermissions|--dangerously-skip-permissions/i,
    "turns off harness safety prompts",
  ],
];

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function fetchJson(url) {
  const headers = {
    "User-Agent": "ctrlyoke-templates-ci",
    Accept: "application/json",
  };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

/**
 * The workflow schema, and the ids of ctrlyoke's built-in templates from the
 * same release. A community template may not reuse a built-in id: it would sit
 * in the template picker beside the built-in under the same name.
 */
async function loadReferences() {
  const localPath = argValue("--schema") ?? process.env.WORKFLOW_SCHEMA_PATH;
  if (localPath) {
    // Inside a ctrlyoke checkout, read the built-in manifest beside the schema.
    const manifestPath = path.resolve(
      path.dirname(localPath),
      "..",
      BUILT_IN_MANIFEST_PATH_IN_REPO,
    );
    const manifest = await readFile(manifestPath, "utf8")
      .then(JSON.parse)
      .catch(() => undefined);
    if (!manifest) {
      console.log(
        `No built-in manifest at ${manifestPath}; skipping the built-in id check.`,
      );
    }
    return {
      source: path.resolve(localPath),
      schema: JSON.parse(await readFile(localPath, "utf8")),
      builtInIds: builtInIdsOf(manifest),
    };
  }
  const tag =
    argValue("--tag") ??
    (
      await fetchJson(
        `https://api.github.com/repos/${CTRLYOKE_REPO}/releases/latest`,
      )
    ).tag_name;
  const raw = `https://raw.githubusercontent.com/${CTRLYOKE_REPO}/${tag}`;
  const [schema, manifest] = await Promise.all([
    fetchJson(`${raw}/${SCHEMA_PATH_IN_REPO}`),
    fetchJson(`${raw}/${BUILT_IN_MANIFEST_PATH_IN_REPO}`),
  ]);
  return {
    source: `${CTRLYOKE_REPO}@${tag}`,
    schema,
    builtInIds: builtInIdsOf(manifest),
  };
}

function builtInIdsOf(manifest) {
  if (!manifest) return new Set();
  const workflows = Array.isArray(manifest.workflows) ? manifest.workflows : [];
  return new Set([
    ...UNLISTED_BUILT_IN_IDS,
    ...workflows.map((workflow) => workflow?.id).filter(Boolean),
  ]);
}

/** Problems with `_templateMeta`'s display fields that the schema does not catch. */
function metaProblems(meta) {
  const problems = [];
  const tooLong = (field, limit) => {
    if (typeof meta[field] === "string" && meta[field].length > limit) {
      problems.push(
        `_templateMeta.${field} is longer than ${limit} characters`,
      );
    }
  };
  tooLong("name", META_LIMITS.nameLength);
  tooLong("author", META_LIMITS.authorLength);
  tooLong("description", META_LIMITS.descriptionLength);
  if (meta.author !== undefined && !String(meta.author).trim()) {
    problems.push("_templateMeta.author is empty; leave it out instead");
  }
  if (Array.isArray(meta.tags)) {
    if (meta.tags.length > META_LIMITS.tagCount) {
      problems.push(
        `_templateMeta.tags has more than ${META_LIMITS.tagCount} tags`,
      );
    }
    const seen = new Set();
    for (const tag of meta.tags) {
      if (typeof tag !== "string") continue; // the schema reports it
      if (!TAG_PATTERN.test(tag) || tag.length > META_LIMITS.tagLength) {
        problems.push(
          `tag "${tag}": use lowercase letters, digits and hyphens, at most ${META_LIMITS.tagLength} characters`,
        );
      } else if (seen.has(tag)) {
        problems.push(`tag "${tag}" is listed twice`);
      }
      seen.add(tag);
    }
  }
  return problems;
}

function annotate(level, file, message) {
  const relative = `templates/${file}`;
  if (process.env.GITHUB_ACTIONS)
    console.log(`::${level} file=${relative}::${message}`);
  else console.log(`${level.toUpperCase()} ${relative}: ${message}`);
}

const { source, schema, builtInIds } = await loadReferences();
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);
console.log(`Validating against the workflow schema from ${source}`);

const { files, stray } = await listTemplateFiles();
let failures = 0;
const fail = (file, message) => {
  failures++;
  annotate("error", file, message);
};

for (const name of stray) {
  fail(
    name,
    `templates/ may hold only <template-name>${REQUIRED_EXTENSION} files`,
  );
}

for (const file of files) {
  const id = templateIdOf(file);
  if (!file.endsWith(REQUIRED_EXTENSION)) {
    fail(file, `use the ${REQUIRED_EXTENSION} extension`);
  }
  if (!TEMPLATE_ID_PATTERN.test(id)) {
    fail(
      file,
      "name the file <template-name>: lowercase letters, digits and hyphens, 3 to 100 characters",
    );
  }
  if (builtInIds.has(id)) {
    fail(
      file,
      `"${id}" is the id of a ctrlyoke built-in template; choose another name`,
    );
  }

  let parsed;
  try {
    parsed = await readTemplate(file);
  } catch (error) {
    fail(file, `does not parse: ${error.message}`);
    continue;
  }
  const { text, document } = parsed;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    fail(file, "is not a workflow object");
    continue;
  }

  const meta = document._templateMeta;
  if (!meta || typeof meta !== "object") {
    fail(file, "needs a _templateMeta block");
  } else {
    if (typeof meta.name !== "string" || !meta.name.trim()) {
      fail(file, "_templateMeta.name is required");
    }
    if (typeof meta.description !== "string" || !meta.description.trim()) {
      fail(file, "_templateMeta.description is required");
    }
    for (const problem of metaProblems(meta)) fail(file, problem);
  }

  if (!validate(document)) {
    // A oneOf/anyOf failure repeats the same unknown field once per branch.
    const messages = new Set();
    for (const error of validate.errors ?? []) {
      const where = error.instancePath || "(root)";
      const detail =
        error.keyword === "unevaluatedProperties" ||
        error.keyword === "additionalProperties"
          ? `unknown field "${error.params.unevaluatedProperty ?? error.params.additionalProperty}"`
          : error.message;
      messages.add(`${where}: ${detail}`);
    }
    for (const message of messages) fail(file, message);
  }

  text.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, label] of TRIPWIRES) {
      if (pattern.test(line)) {
        annotate(
          "warning",
          file,
          `line ${index + 1}: ${label}; check it in review`,
        );
      }
    }
  });
}

if (failures) {
  console.error(
    `\n${failures} problem(s) found in ${files.length} template(s).`,
  );
  process.exit(1);
}
console.log(`All ${files.length} template(s) are valid.`);
