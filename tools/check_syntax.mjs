// Parses every JavaScript file in the behavior pack with Node's own parser.
// Node treats the repo as ESM (package.json "type": "module"), which matches
// how the Bedrock script runtime loads module files.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = walk(join(root, "behavior_pack", "scripts")).concat(walk(join(root, "tests")));
let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures += 1;
    console.error(`SYNTAX ERROR in ${relative(root, file)}\n${result.stderr}`);
  }
}
console.log(`Checked ${files.length} JavaScript files, ${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
