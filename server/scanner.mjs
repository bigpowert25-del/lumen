import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".jsonl", ".yaml", ".yml"]);
const SKIP_DIRECTORIES = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", "coverage", "vendor",
  "Library", "Applications", "Movies", "Music", "Pictures", "Public", ".Trash",
  ".cache", ".npm", ".pnpm-store", ".yarn", "Caches", "DerivedData", "Pods",
  "__pycache__", ".venv", "venv", "target", "out", "tmp", "temp", "logs",
  "sessions", "session", "backups", "backup"
]);
const ALLOWED_HIDDEN_DIRECTORIES = new Set([".codex", ".openclaw"]);
const PRIORITY_NAMES = /^(readme|agents|memory|memories|todo|todos|tasks|roadmap|status|decisions?|notes?|project|plan|changelog)([-_.].*)?\.(md|mdx|txt|json|yaml|yml)$/i;
const PRIORITY_PATH = /(codex[/\\]memories|\.openclaw|obsidian vault|projects?|workspace|完项目|记忆|项目|任务|计划)/i;
const SKIP_PATH = /(rollout_summaries|raw_memories|[/\\](conv|conversation|transcript|session|sessions|archive|archives|history)[-_/\\]|phase2_workspace_diff|[/\\]logs?[/\\]|\.openclaw[/\\]workspace[/\\]skills[/\\]|[/\\]obsidian-vault[/\\]|70-OpenClaw历史记忆|OpenClaw-Wiki[/\\]sources|bridge-workspace)/i;
const PRIVATE_PATH = /([/\\](01-人物|04-决策记录|12-个人文件|个人|人物|健康|医疗|家庭|财务)[/\\]|[/\\](MEMORY|CODEBUDDY)\.md$)/i;
const SENSITIVE_NAME = /(^|[-_.])(auth|secret|secrets|credential|credentials|token|tokens|password|passwd|api[-_]?key|private[-_]?key|cookies?|keychain|identity)([-_.]|$)/i;
const SENSITIVE_LINE = /(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|authorization|cookie)\s*["']?\s*[:=]\s*["']?[^\s"']{6,}/i;
const SENSITIVE_CONTEXT = /(危机|自杀|抑郁|焦虑症|病历|诊断|用药|睡眠问题|家人|父母|妻子|丈夫|孩子|家庭|个人文件|身份证|住址|电话号码|银行卡)/i;
const CODE_LINE = /^(import|export|const|let|var|function|class|return|throw|if\s*\(|for\s*\(|while\s*\(|\{|\}|<\/?[a-z]|\[\d{2}:\d{2}:\d{2}\]|│|\|.*\|$)/i;
const SCHEMA_LINE = /(queued\s*[\/|→,-].*completed|pending\s*[\/|→,-].*completed|待处理\s*[\/|→,-].*已完成|状态\s*[:：].*(已完成|completed).*(失败|failed))/i;
const EXPLICIT_PREFIX = /^(?:[-*+]\s*)?(?:\*\*)?(TODO|待办|下一步|阻塞|Blocker|风险|Risk|决定|决策|Decision|状态|Status|灵感|Idea)\s*[:：-](?:\*\*)?/i;

const TYPE_RULES = [
  { type: "blocker", module: "dayflow", confidence: 0.82, pattern: /(阻塞|卡住|blocked|blocker|无法继续|反复失败|失败原因|待解除)/i },
  { type: "task", module: "dayflow", confidence: 0.78, pattern: /(^|\s)(TODO|待办|下一步|需要完成|需要处理|follow[- ]?up|action item|未完成)(\s|[:：]|$)|^[-*]\s*\[\s\]/i },
  { type: "decision", module: "refract", confidence: 0.76, pattern: /(决定|已确认|最终选择|原则|decision|confirmed|采用方案|选择了)/i },
  { type: "risk", module: "dayflow", confidence: 0.78, pattern: /(风险|注意事项|隐患|可能导致|risk|警告|需谨慎)/i },
  { type: "status", module: "dayflow", confidence: 0.72, pattern: /(项目状态|当前状态|进行中|已完成|待验证|待发布|in progress|completed|pending|status)/i },
  { type: "idea", module: "refract", confidence: 0.72, pattern: /(灵感|值得做|可以做成|想做|创意|idea|concept|值得尝试|产品机会)/i }
];

const TYPE_LABELS = {
  blocker: "阻塞",
  task: "待办",
  decision: "决定",
  risk: "风险",
  status: "状态",
  idea: "灵感"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePath(filePath, home) {
  return filePath.startsWith(home) ? `~${filePath.slice(home.length)}` : filePath;
}

function isSensitiveFile(filePath) {
  const base = path.basename(filePath);
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (/\.(pem|p12|pfx|key|sqlite|sqlite3|db)$/i.test(base)) return true;
  return SENSITIVE_NAME.test(base);
}

function shouldSkipDirectory(name) {
  if (SKIP_DIRECTORIES.has(name)) return true;
  if (name.startsWith(".") && !ALLOWED_HIDDEN_DIRECTORIES.has(name)) return true;
  return false;
}

function isCandidateFile(filePath) {
  if (isSensitiveFile(filePath) || SKIP_PATH.test(filePath) || PRIVATE_PATH.test(filePath)) return false;
  const base = path.basename(filePath);
  if (/^(package-lock|pnpm-lock|yarn\.lock)/i.test(base)) return false;
  const extension = path.extname(base).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) return false;
  return PRIORITY_NAMES.test(base) || PRIORITY_PATH.test(filePath);
}

function sourceKind(filePath) {
  if (/\.codex[/\\]memories/i.test(filePath)) return "Codex 记忆";
  if (/\.openclaw/i.test(filePath)) return "OpenClaw 记忆";
  if (/obsidian vault/i.test(filePath)) return "共享记忆";
  if (/(projects?|完项目|workspace)/i.test(filePath)) return "项目";
  return "文档";
}

function inferProject(filePath) {
  const segments = filePath.split(path.sep).filter(Boolean);
  const completeIndex = segments.findIndex((part) => part === "完项目");
  if (completeIndex >= 0 && segments[completeIndex + 1]) return segments[completeIndex + 1];
  const projectIndex = segments.findIndex((part) => /^(projects?|workspace)$/i.test(part));
  if (projectIndex >= 0 && segments[projectIndex + 1]) return segments[projectIndex + 1];
  if (filePath.includes(".codex")) return "Codex";
  if (filePath.includes(".openclaw")) return "OpenClaw";
  if (/obsidian vault/i.test(filePath)) return "共享记忆";
  return path.basename(path.dirname(filePath));
}

function cleanSignalText(line) {
  return String(line)
    .replace(/^\s*[-*+]\s*(\[[ xX]\])?\s*/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^(TODO|待办|下一步|决定|状态|风险|灵感|注意事项)\s*[:：-]\s*/i, "")
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function nextAction(type) {
  return {
    blocker: "安排一个解除阻塞的时间块",
    task: "生成今日排程建议",
    decision: "保留为稳定项目上下文",
    risk: "检查影响并决定下一步",
    status: "同步项目状态与下一步",
    idea: "送入灵感库继续孵化"
  }[type];
}

function stableId(type, title) {
  return createHash("sha1").update(`${type}:${title.toLowerCase()}`).digest("hex").slice(0, 14);
}

export function extractSignalsFromText(text, metadata = {}) {
  const {
    filePath = "unknown.md",
    home = os.homedir(),
    mtimeMs = Date.now(),
    now = Date.now(),
    threshold = 0.76
  } = metadata;
  const lines = String(text).split(/\r?\n/).slice(0, 5000);
  const signals = [];
  let hiddenCount = 0;

  const frontmatterMatch = String(text).match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fields = Object.fromEntries(frontmatterMatch[1].split(/\r?\n/).map((line) => {
      const splitAt = line.indexOf(":");
      if (splitAt < 0) return ["", ""];
      return [line.slice(0, splitAt).trim(), line.slice(splitAt + 1).trim().replace(/^['"]|['"]$/g, "")];
    }).filter(([key]) => key));
    if (String(fields.doc_type).toLowerCase() === "decision" && (fields.title || fields.summary)) {
      const title = cleanSignalText(fields.title || fields.summary);
      signals.push({
        id: stableId("decision", title),
        type: "decision",
        typeLabel: TYPE_LABELS.decision,
        module: "refract",
        title,
        excerpt: cleanSignalText(fields.summary || title),
        project: fields.project_id || inferProject(filePath),
        confidence: 0.96,
        nextAction: nextAction("decision"),
        modifiedAt: new Date(mtimeMs).toISOString(),
        source: { kind: sourceKind(filePath), path: normalizePath(filePath, home), line: 2 },
        sources: [{ kind: sourceKind(filePath), path: normalizePath(filePath, home), line: 2 }]
      });
    }
  }

  let sectionType = null;
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const title = heading[1].replace(/[*_`]/g, "");
      if (/(待办|下一步|未完成|open items?|todo|action)/i.test(title)) sectionType = "task";
      else if (/(阻塞|blocker)/i.test(title)) sectionType = "blocker";
      else if (/(风险|risk)/i.test(title)) sectionType = "risk";
      else if (/(决定|决策|decision)/i.test(title)) sectionType = "decision";
      else if (/(灵感|创意|idea)/i.test(title)) sectionType = "idea";
      else if (/(当前状态|进行中|status|in progress)/i.test(title)) sectionType = "status";
      else sectionType = null;
      return;
    }
    if (line.length < 8 || line.length > 300 || CODE_LINE.test(line) || SCHEMA_LINE.test(line) || SENSITIVE_LINE.test(line) || SENSITIVE_CONTEXT.test(line)) return;
    if (/^[-*]\s*\[[xX]\]/.test(line)) return;
    const explicitCheckbox = /^[-*]\s*\[\s\]/.test(line);
    const prefixMatch = line.match(EXPLICIT_PREFIX);
    const sectionBullet = Boolean(sectionType && /^[-*+]\s+/.test(line));
    const bulletText = line.replace(/^[-*+]\s+/, "").replace(/^\*\*/, "");
    if (sectionType === "status" && sectionBullet && !/^(已|完成|进行|待|方向|上线|修复|验证|暂停|暂不|当前|blocked)/i.test(bulletText)) return;
    const inferredType = explicitCheckbox ? "task" : prefixMatch
      ? ({ todo: "task", 待办: "task", 下一步: "task", 阻塞: "blocker", blocker: "blocker", 风险: "risk", risk: "risk", 决定: "decision", 决策: "decision", decision: "decision", 状态: "status", status: "status", 灵感: "idea", idea: "idea" }[prefixMatch[1].toLowerCase()])
      : sectionBullet ? sectionType : null;
    if (!inferredType) return;
    const rule = TYPE_RULES.find((candidate) => candidate.type === inferredType);
    if (!rule) return;

    const title = cleanSignalText(line);
    if (title.length < 6 || SENSITIVE_LINE.test(title)) return;
    const labelled = Boolean(prefixMatch || sectionBullet);
    const prioritySource = PRIORITY_PATH.test(filePath);
    const ageDays = Math.max(0, (now - mtimeMs) / 86400000);
    const recencyBoost = ageDays <= 14 ? 0.08 : ageDays <= 60 ? 0.04 : 0;
    const confidence = clamp(
      rule.confidence + (explicitCheckbox ? 0.12 : 0) + (labelled ? 0.06 : 0) + (prioritySource ? 0.04 : 0) + recencyBoost - (title.length > 150 ? 0.06 : 0),
      0,
      0.98
    );

    if (confidence < threshold) {
      if (confidence >= 0.62) hiddenCount += 1;
      return;
    }

    signals.push({
      id: stableId(rule.type, title),
      type: rule.type,
      typeLabel: TYPE_LABELS[rule.type],
      module: rule.module,
      title,
      excerpt: title,
      project: inferProject(filePath),
      confidence: Number(confidence.toFixed(2)),
      nextAction: nextAction(rule.type),
      modifiedAt: new Date(mtimeMs).toISOString(),
      source: {
        kind: sourceKind(filePath),
        path: normalizePath(filePath, home),
        line: index + 1
      },
      sources: [{ kind: sourceKind(filePath), path: normalizePath(filePath, home), line: index + 1 }]
    });
  });

  const perFileLimit = 4;
  if (signals.length > perFileLimit) hiddenCount += signals.length - perFileLimit;
  return { signals: signals.slice(0, perFileLimit), hiddenCount };
}

function priorityScore(entry) {
  if (entry.name === ".codex") return 100;
  if (entry.name === ".openclaw") return 95;
  if (entry.name === "Documents") return 90;
  if (/projects?|workspace|vault|完项目/i.test(entry.name)) return 80;
  return 0;
}

export async function scanContext(options = {}) {
  const home = options.home ?? os.homedir();
  const roots = options.roots?.length ? options.roots : [home];
  const maxFiles = options.maxFiles ?? 1600;
  const maxDirectories = options.maxDirectories ?? 6500;
  const maxDepth = options.maxDepth ?? 8;
  const maxDurationMs = options.maxDurationMs ?? 15000;
  const threshold = options.threshold ?? 0.76;
  const now = options.now ?? Date.now();
  const started = Date.now();
  const queue = roots.map((root) => ({ directory: path.resolve(root), depth: 0 }));
  const visitedDirectories = new Set();
  const visitedFiles = new Set();
  const candidates = [];
  const byId = new Map();
  let hiddenCount = 0;
  let ignoredFiles = 0;
  let directoriesScanned = 0;

  while (queue.length && candidates.length < maxFiles && directoriesScanned < maxDirectories && Date.now() - started < maxDurationMs) {
    const current = queue.shift();
    if (!current || visitedDirectories.has(current.directory) || current.depth > maxDepth) continue;
    visitedDirectories.add(current.directory);
    directoriesScanned += 1;

    let entries;
    try {
      entries = await fs.readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => priorityScore(b) - priorityScore(a) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (Date.now() - started >= maxDurationMs) break;
      const fullPath = path.join(current.directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) queue.push({ directory: fullPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile() || visitedFiles.has(fullPath)) continue;
      visitedFiles.add(fullPath);
      if (!isCandidateFile(fullPath)) {
        ignoredFiles += 1;
        continue;
      }
      candidates.push(fullPath);
      if (candidates.length >= maxFiles) break;
    }
  }

  for (const filePath of candidates) {
    if (Date.now() - started >= maxDurationMs) break;
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > 420000) {
        ignoredFiles += 1;
        continue;
      }
      const ageDays = Math.max(0, (now - stat.mtimeMs) / 86400000);
      if (ageDays > 45) {
        ignoredFiles += 1;
        continue;
      }
      const content = await fs.readFile(filePath, "utf8");
      const extracted = extractSignalsFromText(content, { filePath, home, mtimeMs: stat.mtimeMs, now, threshold });
      hiddenCount += extracted.hiddenCount;
      for (const signal of extracted.signals) {
        const existing = byId.get(signal.id);
        if (!existing) {
          byId.set(signal.id, signal);
        } else {
          existing.confidence = Math.max(existing.confidence, signal.confidence);
          if (!existing.sources.some((source) => source.path === signal.source.path && source.line === signal.source.line)) {
            existing.sources.push(signal.source);
            existing.sources = existing.sources.slice(0, 4);
          }
        }
      }
    } catch {
      ignoredFiles += 1;
    }
  }

  const rankedSignals = [...byId.values()]
    .sort((a, b) => b.confidence - a.confidence || new Date(b.modifiedAt) - new Date(a.modifiedAt));
  const sourceCounts = new Map();
  const projectCounts = new Map();
  const visibleSignals = [];
  const maxSignals = options.maxSignals ?? 24;
  for (const signal of rankedSignals) {
    const sourceCount = sourceCounts.get(signal.source.path) || 0;
    const projectCount = projectCounts.get(signal.project) || 0;
    if (sourceCount >= 3 || projectCount >= 5) {
      hiddenCount += 1;
      continue;
    }
    visibleSignals.push(signal);
    sourceCounts.set(signal.source.path, sourceCount + 1);
    projectCounts.set(signal.project, projectCount + 1);
    if (visibleSignals.length >= maxSignals) break;
  }

  return {
    version: 1,
    status: "ready",
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    roots: roots.map((root) => normalizePath(path.resolve(root), home)),
    stats: {
      directoriesScanned,
      candidateFiles: candidates.length,
      ignoredFiles,
      visibleSignals: visibleSignals.length,
      hiddenSignals: hiddenCount,
      truncated: Boolean(queue.length || candidates.length >= maxFiles || Date.now() - started >= maxDurationMs)
    },
    visibleSignals
  };
}
