import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skippedDirectories = new Set(["node_modules", "dist", "runtime", ".git"]);
const textExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".md", ".css", ".html", ".svg", ".yml", ".yaml"]);
const rules = [
  { label: "macOS personal home path", pattern: /\/Users\/(?!<user>|example|test)([^/\s]+)/i },
  { label: "email address", pattern: /\b[A-Z0-9._%+-]+@(?!example\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "Chinese mobile number", pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/ },
  { label: "private key material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "likely OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ }
];

async function collect(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(fullPath));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

const failures = [];
for (const filePath of await collect(root)) {
  const text = await fs.readFile(filePath, "utf8");
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) failures.push(`${path.relative(root, filePath)}: ${rule.label} (${match[0]})`);
  }
}

if (failures.length) {
  console.error(`Public-safety check failed:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Public-safety check passed: no personal paths, contact details, or secret material found.");
}
