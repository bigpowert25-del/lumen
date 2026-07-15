import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPeriodSummary,
  buildDailyReview,
  buildTrendSeries,
  buildSuggestion,
  confirmCaptureSchedule,
  createIdea,
  createDefaultState,
  deriveDailyBrief,
  deriveDayStats,
  ensureDailyRollover,
  findConflicts,
  formatEndTime,
  normalizeState,
  ingestContextSignals,
  promoteIdeaToCapture,
  reconcileContextSignals,
  routeContextSignal,
  rangesOverlap
} from "../logic.js";

test("time helpers treat touching blocks as non-overlapping", () => {
  assert.equal(rangesOverlap("09:00", 60, "10:00", 30), false);
  assert.equal(rangesOverlap("09:30", 90, "11:30", 45), false);
  assert.equal(rangesOverlap("10:45", 60, "11:30", 45), true);
  assert.equal(formatEndTime("09:30", 90), "11:00");
});

test("suggestion uses context to choose a deep-work block", () => {
  const suggestion = buildSuggestion({
    text: "把访谈结论整理成产品决策。",
    urgency: "高",
    energy: "深度工作",
    deadline: "今天 18:00"
  });
  assert.equal(suggestion.start, "09:30");
  assert.equal(suggestion.duration, 90);
  assert.match(suggestion.reason, /截止时间/);
});

test("confirmation refuses conflicts and preserves the original state", () => {
  const state = createDefaultState();
  const before = state.timeline.length;
  const result = confirmCaptureSchedule(state, "capture-v11", {
    title: "冲突测试",
    start: "11:45",
    duration: 30
  });
  assert.equal(result.conflicts.length, 1);
  assert.equal(state.timeline.length, before);
  assert.equal(state.captures[0].status, "suggested");
});

test("confirmation writes an approved suggestion into today", () => {
  const state = createDefaultState();
  const result = confirmCaptureSchedule(state, "capture-v11", {
    title: "完成体验验收",
    start: "09:30",
    duration: 90
  });
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.state.timeline.length, state.timeline.length + 1);
  assert.equal(result.state.captures[0].status, "scheduled");
  assert.equal(result.state.timeline.at(-1).captureId, "capture-v11");
});

test("day stats summarize completion and focus time", () => {
  const state = createDefaultState();
  const scheduled = confirmCaptureSchedule(state, "capture-v11", {
    title: "完成体验验收",
    start: "09:30",
    duration: 90
  }).state;
  scheduled.timeline.at(-1).done = true;
  const stats = deriveDayStats(scheduled);
  assert.equal(stats.focusMinutes, 90);
  assert.equal(stats.completed, 2);
  assert.equal(stats.captured, 3);
});

test("findConflicts returns the conflicting event", () => {
  const state = createDefaultState();
  const conflicts = findConflicts("14:45", 30, state.timeline);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].title, "设计评审");
});

test("daily brief reacts to confirmed focus and completion state", () => {
  const state = createDefaultState();
  const before = deriveDailyBrief(state);
  const scheduled = confirmCaptureSchedule(state, "capture-v11", {
    title: "完成体验验收",
    start: "09:30",
    duration: 90
  }).state;
  const afterSchedule = deriveDailyBrief(scheduled);
  scheduled.timeline.at(-1).done = true;
  const afterDone = deriveDailyBrief(scheduled);

  assert.equal(afterSchedule.focusMinutes, 90);
  assert.match(afterSchedule.headline, /90 分钟/);
  assert.ok(afterSchedule.score > before.score);
  assert.ok(afterDone.score > afterSchedule.score);
  assert.equal(afterDone.completed, 2);
});

test("trend series supports 7 and 30 days and includes live today data", () => {
  const state = createDefaultState();
  const scheduled = confirmCaptureSchedule(state, "capture-v11", {
    title: "完成体验验收",
    start: "09:30",
    duration: 90
  }).state;
  const week = buildTrendSeries(scheduled, 7);
  const month = buildTrendSeries(scheduled, 30);

  assert.equal(week.days.length, 7);
  assert.equal(month.days.length, 30);
  assert.equal(week.days.at(-1).label, "今天");
  assert.equal(week.days.at(-1).focusMinutes, 90);
  assert.ok(month.totalFocusMinutes >= week.totalFocusMinutes);
});

test("state normalization migrates v1 data without losing the closed loop", () => {
  const legacy = createDefaultState();
  legacy.version = 1;
  delete legacy.history;
  legacy.captures[0].text = "用户自己的 Capture";
  legacy.timeline[0].done = false;

  const migrated = normalizeState(legacy);
  assert.equal(migrated.version, 5);
  assert.equal(migrated.captures[0].text, "用户自己的 Capture");
  assert.equal(migrated.timeline[0].done, false);
  assert.equal(migrated.history.length, 59);
  assert.equal(migrated.dayflowView, "today");
  assert.deepEqual(migrated.reviews, []);
  assert.equal(migrated.ideas.length, 3);
  assert.deepEqual(migrated.ingestedSignalIds, []);
});

test("weekly and monthly summaries compare equal previous periods", () => {
  const state = createDefaultState();
  const week = buildPeriodSummary(state, 7, new Date("2026-07-15T12:00:00"));
  const month = buildPeriodSummary(state, 30, new Date("2026-07-15T12:00:00"));

  assert.equal(week.days.length, 7);
  assert.equal(week.previousDays.length, 7);
  assert.equal(month.days.length, 30);
  assert.equal(month.previousDays.length, 30);
  assert.equal(Number.isFinite(week.comparison.focusPercent), true);
  assert.match(week.headline, /过去 7 天/);
  assert.equal(month.insights.length, 3);
});

test("daily review separates evidence, friction, lessons and upgrade candidates", () => {
  const state = createDefaultState();
  state.captures[0].sourceSignalId = "signal-review";
  state.captures[1].sourceSignalId = "signal-review-2";
  state.ideas[0].sourceSignalId = "signal-review-3";
  const review = buildDailyReview(state, "2026-07-15", { now: new Date("2026-07-16T08:00:00") });

  assert.equal(review.dateKey, "2026-07-15");
  assert.equal(review.evidence.conversations, 3);
  assert.ok(review.frictions.length >= 1);
  assert.ok(review.lessons.length >= 1);
  assert.equal(review.upgrades.some((item) => item.target === "Skill"), true);
  assert.equal(review.upgrades.every((item) => item.scope.includes("身份记忆") || item.status === "observe"), true);
});

test("a new local day archives yesterday and starts a clean timeline", () => {
  const state = createDefaultState();
  state.lastActiveDate = "2026-07-14";
  const scheduled = confirmCaptureSchedule(state, "capture-v11", {
    title: "完成体验验收",
    start: "09:30",
    duration: 90
  }).state;
  scheduled.timeline.at(-1).done = true;

  const result = ensureDailyRollover(scheduled, new Date("2026-07-15T00:03:00"));
  assert.equal(result.rolledOver, true);
  assert.equal(result.archivedDays.length, 1);
  assert.equal(result.archivedDays[0].dateKey, "2026-07-14");
  assert.equal(result.archivedDays[0].focusMinutes, 90);
  assert.equal(result.state.lastActiveDate, "2026-07-15");
  assert.equal(result.state.reviews.at(-1).dateKey, "2026-07-14");
  assert.equal(result.state.timeline.every((event) => event.captureId == null && !event.done), true);
  assert.equal(result.state.captures.find((capture) => capture.id === "capture-v11").status, "completed");
});

test("days missed while the app is closed remain explicit gaps", () => {
  const state = createDefaultState();
  state.lastActiveDate = "2026-07-12";
  const result = ensureDailyRollover(state, new Date("2026-07-15T08:00:00"));

  assert.deepEqual(result.archivedDays.map((day) => day.dateKey), ["2026-07-12", "2026-07-13", "2026-07-14"]);
  assert.equal(result.archivedDays[1].hasData, false);
  assert.equal(result.archivedDays[2].score, null);
});

test("context signals route into two modules and deduplicate automatically", () => {
  const state = createDefaultState();
  const signals = [
    {
      id: "sig-task",
      type: "task",
      module: "dayflow",
      title: "完成本地扫描验证",
      confidence: 0.91,
      project: "LUMEN",
      nextAction: "生成今日排程建议",
      source: { kind: "Codex 记忆", path: "~/.codex/memories/test.md", line: 2 }
    },
    {
      id: "sig-idea",
      type: "idea",
      module: "refract",
      title: "把跨模块转移做成一束光",
      excerpt: "用动效解释状态变化",
      confidence: 0.87,
      project: "LUMEN",
      nextAction: "送入灵感库继续孵化",
      source: { kind: "OpenClaw 记忆", path: "~/.openclaw/notes.md", line: 8 }
    },
    { id: "low", type: "task", title: "不应展示", confidence: 0.6 }
  ];

  const first = ingestContextSignals(state, signals, { now: new Date("2026-07-15T09:00:00") });
  assert.equal(first.addedCaptures.length, 1);
  assert.equal(first.addedIdeas.length, 1);
  assert.equal(first.addedCaptures[0].status, "suggested");
  assert.equal(first.addedIdeas[0].sourceSignalId, "sig-idea");
  const second = ingestContextSignals(first.state, signals);
  assert.equal(second.addedCaptures.length, 0);
  assert.equal(second.addedIdeas.length, 0);
  assert.equal(routeContextSignal(signals[0]), "dayflow");
  assert.equal(routeContextSignal(signals[1]), "refract");
});

test("an idea becomes a DayFlow suggestion before occupying time", () => {
  const state = createDefaultState();
  const idea = createIdea({
    id: "idea-test",
    title: "安静的上下文",
    nextStep: "验证扫描结果的筛选质量",
    project: "LUMEN"
  });
  state.ideas.unshift(idea);

  const result = promoteIdeaToCapture(state, idea.id, { now: new Date("2026-07-15T10:00:00") });
  assert.equal(result.error, undefined);
  assert.equal(result.capture.status, "suggested");
  assert.equal(result.state.activeModule, "dayflow");
  assert.equal(result.state.timeline.length, state.timeline.length);
  assert.equal(result.state.ideas[0].linkedCaptureId, result.capture.id);
  assert.match(result.capture.notes, /安静的上下文/);
});

test("reconciliation removes filtered auto items but preserves confirmed work", () => {
  const state = createDefaultState();
  state.captures.unshift({ id: "auto-old", sourceSignalId: "old", status: "suggested", text: "旧噪音" });
  state.captures.unshift({ id: "auto-kept", sourceSignalId: "acted", status: "scheduled", text: "已经确认" });
  state.ideas.unshift(createIdea({ id: "idea-old", title: "旧灵感", sourceSignalId: "old" }));
  state.ingestedSignalIds = ["old", "acted"];

  const reconciled = reconcileContextSignals(state, []);
  assert.equal(reconciled.captures.some((capture) => capture.id === "auto-old"), false);
  assert.equal(reconciled.ideas.some((idea) => idea.id === "idea-old"), false);
  assert.equal(reconciled.captures.some((capture) => capture.id === "auto-kept"), true);
  assert.deepEqual(reconciled.ingestedSignalIds, ["acted"]);
});
