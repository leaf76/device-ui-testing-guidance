import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(__dirname, "..");
export const GUIDES_DIR = path.join(
  PACKAGE_ROOT,
  "skills",
  "device-ui-testing-guidance",
  "guides"
);

/**
 * Minimal zero-dependency YAML frontmatter parser for flat key/value & inline arrays.
 */
export function parseFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized };
  }
  const endIdx = normalized.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    return { data: {}, body: normalized };
  }
  const fmBlock = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + 5).trimStart();
  const data = {};

  for (const line of fmBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();

    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner
        ? inner
            .split(",")
            .map((item) => item.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean)
        : [];
    } else {
      data[key] = val.replace(/^["']|["']$/g, "");
    }
  }

  return { data, body };
}

function extractHeadings(body) {
  const headings = [];
  for (const line of body.split("\n")) {
    const m = /^#{1,3}\s+(.+)$/.exec(line.trim());
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

function extractRelatedGuides(body) {
  const m = /##\s+Related guides\s*\n([\s\S]*?)(?:\n##\s+|$)/i.exec(body);
  if (!m) return [];
  const ids = [];
  for (const match of m[1].matchAll(/`([a-z0-9-]+)`/g)) {
    ids.push(match[1]);
  }
  return ids;
}

let cachedGuides = null;

export function loadGuides({ fresh = false } = {}) {
  if (cachedGuides && !fresh) return cachedGuides;

  const guides = [];
  if (!fs.existsSync(GUIDES_DIR)) {
    return guides;
  }

  const categories = fs
    .readdirSync(GUIDES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const category of categories) {
    const catDir = path.join(GUIDES_DIR, category);
    const files = fs
      .readdirSync(catDir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith(".md"))
      .map((f) => f.name)
      .sort();

    for (const file of files) {
      const filePath = path.join(catDir, file);
      const raw = fs.readFileSync(filePath, "utf8");
      const { data, body } = parseFrontmatter(raw);
      const stem = file.replace(/\.md$/, "");

      guides.push({
        id: data.id || stem,
        stem,
        category: data.category || category,
        folderCategory: category,
        title: data.title || stem,
        description: data.description || "",
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        appliesTo: Array.isArray(data.appliesTo) ? data.appliesTo : [],
        headings: extractHeadings(body),
        related: extractRelatedGuides(body),
        filePath,
        body,
        raw,
      });
    }
  }

  cachedGuides = guides;
  return guides;
}

export function getGuideById(idOrPath, guides = loadGuides()) {
  const clean = idOrPath.trim().toLowerCase().replace(/\.md$/, "");
  return (
    guides.find((g) => g.id.toLowerCase() === clean) ||
    guides.find((g) => `${g.category}/${g.id}`.toLowerCase() === clean) ||
    null
  );
}

export function listCategories(guides = loadGuides()) {
  const counts = new Map();
  for (const g of guides) {
    counts.set(g.category, (counts.get(g.category) || 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}
