import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractSignalsFromText, scanContext } from "./scanner.mjs";

test("extractor keeps actionable context and drops secrets", () => {
  const text = [
    "- [ ] 下一步：完成 LUMEN 双模块导航",
    "决定：真正写入时间线前保留轻确认",
    "风险：扫描目录过大会带来噪音",
    "这段对话曾经 blocked，但不是当前阻塞",
    "- [x] TODO: 已经完成的旧任务",
    "待办：处理家人关系与病历信息",
    "API_KEY=sk-redacted"
  ].join("\n");
  const result = extractSignalsFromText(text, {
    filePath: "/Users/test/Documents/完项目/README.md",
    home: "/Users/test",
    threshold: 0.7,
    mtimeMs: Date.now()
  });

  assert.deepEqual(result.signals.map((signal) => signal.type), ["task", "decision", "risk"]);
  assert.equal(JSON.stringify(result).includes("sk-do-not-keep"), false);
  assert.equal(JSON.stringify(result).includes("旧任务"), false);
  assert.equal(JSON.stringify(result).includes("病历"), false);
  assert.equal(JSON.stringify(result).includes("不是当前阻塞"), false);
  assert.equal(result.signals[0].source.path.startsWith("~/"), true);
});

test("scanner ignores credential files and deduplicates repeated signals", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lumen-scan-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "projects", "lumen"), { recursive: true });
  await fs.writeFile(path.join(root, "projects", "lumen", "README.md"), "TODO: 完成上下文扫描服务\n灵感：把状态变化做成一束移动的光\n");
  await fs.writeFile(path.join(root, "projects", "lumen", "TODO.md"), "TODO: 完成上下文扫描服务\n");
  await fs.writeFile(path.join(root, "projects", "lumen", "credentials.md"), "TODO: 泄露密码 password=unsafe-value\n");

  const result = await scanContext({ roots: [root], home: root, threshold: 0.7, maxDurationMs: 5000 });
  assert.equal(result.status, "ready");
  assert.equal(result.visibleSignals.some((signal) => signal.title.includes("上下文扫描服务")), true);
  assert.equal(result.visibleSignals.filter((signal) => signal.title.includes("上下文扫描服务")).length, 1);
  assert.equal(JSON.stringify(result).includes("unsafe-value"), false);
});

test("stable shared-memory decisions become Refract context", () => {
  const text = [
    "---",
    "title: \"LUMEN 合并决策 v1\"",
    "doc_type: \"decision\"",
    "project_id: \"dayflow-lumen\"",
    "summary: \"两个模块共享本地上下文\"",
    "---",
    "# LUMEN 合并决策"
  ].join("\n");
  const result = extractSignalsFromText(text, {
    filePath: "/Users/test/Documents/Obsidian Vault/20-项目/LUMEN.md",
    home: "/Users/test",
    mtimeMs: Date.now()
  });
  assert.equal(result.signals[0].type, "decision");
  assert.equal(result.signals[0].module, "refract");
  assert.equal(result.signals[0].project, "dayflow-lumen");
});
