// Shared helpers for generate-index.mjs and validate-templates.mjs.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const TEMPLATES_DIR = path.join(ROOT, "templates");
export const INDEX_PATH = path.join(ROOT, "index.json");

/** Major version of index.json. ctrlyoke refuses a version it does not know. */
export const INDEX_SCHEMA_VERSION = 1;

export const TEMPLATE_EXTENSIONS = [
  ".ctrlyoke.yaml",
  ".ctrlyoke.yml",
  ".ctrlyoke.json",
];

/**
 * A template's id is its file basename, such as `review-branch`: lowercase
 * letters and digits in hyphen-separated words, 3 to 100 characters. ctrlyoke
 * installs the file under this name, so it must stay portable and path-free.
 * Credit goes in `_templateMeta.author`, not the file name.
 */
export const TEMPLATE_ID_PATTERN = /^(?=.{3,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Limits ctrlyoke applies when it reads index.json
 * (`src/utils/CommunityTemplateClient.ts`). It truncates or drops anything
 * longer, so the check fails instead of letting text be cut off silently.
 */
export const META_LIMITS = {
  nameLength: 120,
  authorLength: 120,
  descriptionLength: 500,
  tagCount: 10,
  tagLength: 40,
};

/** Tags are short lowercase keywords, like the ids. */
export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The same YAML schema ctrlyoke loads workflows with (YAML 1.2 core plus merge keys). */
export const WORKFLOW_YAML_SCHEMA = yaml.CORE_SCHEMA.withTags(yaml.mergeTag);

export function templateIdOf(file) {
  const extension = TEMPLATE_EXTENSIONS.find((candidate) =>
    file.endsWith(candidate),
  );
  return extension ? file.slice(0, -extension.length) : undefined;
}

/** Every template file in templates/, sorted by name. Other files are returned as `stray`. */
export async function listTemplateFiles() {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  const files = [];
  const stray = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile() && templateIdOf(entry.name)) files.push(entry.name);
    else stray.push(entry.name);
  }
  return { files: files.sort(), stray: stray.sort() };
}

/** Parse one template file. Throws with a readable message when it does not parse. */
export async function readTemplate(file) {
  const text = await readFile(path.join(TEMPLATES_DIR, file), "utf8");
  const document = yaml.load(text, { schema: WORKFLOW_YAML_SCHEMA });
  return { text, document };
}

/** The index entry for a parsed template. */
export function indexEntryFor(file, document) {
  const meta = document?._templateMeta ?? {};
  const entry = {
    id: templateIdOf(file),
    name: typeof meta.name === "string" ? meta.name : templateIdOf(file),
    description: typeof meta.description === "string" ? meta.description : "",
    tags: Array.isArray(meta.tags)
      ? meta.tags.filter((tag) => typeof tag === "string")
      : [],
    file,
  };
  if (typeof meta.author === "string" && meta.author.trim())
    entry.author = meta.author.trim();
  return entry;
}

/** Serialize the index exactly as it is committed, so CI can diff it. */
export function formatIndex(templates) {
  return `${JSON.stringify({ schemaVersion: INDEX_SCHEMA_VERSION, templates }, null, 2)}\n`;
}
