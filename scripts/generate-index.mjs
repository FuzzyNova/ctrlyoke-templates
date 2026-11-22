// Regenerate index.json from templates/. Never edit index.json by hand.
//
//   npm run index          write index.json
//   npm run index:check    fail if the committed index.json is stale (CI)
import { readFile, writeFile } from "node:fs/promises";
import {
  formatIndex,
  indexEntryFor,
  INDEX_PATH,
  listTemplateFiles,
  readTemplate,
} from "./lib.mjs";

const check = process.argv.includes("--check");

const { files } = await listTemplateFiles();
const templates = [];
for (const file of files) {
  try {
    const { document } = await readTemplate(file);
    templates.push(indexEntryFor(file, document));
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit();

const next = formatIndex(templates);
if (check) {
  const current = await readFile(INDEX_PATH, "utf8").catch(() => "");
  if (current !== next) {
    console.error(
      "index.json is out of date. Run `npm run index` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`index.json is up to date (${templates.length} templates).`);
} else {
  await writeFile(INDEX_PATH, next);
  console.log(`Wrote index.json (${templates.length} templates).`);
}
