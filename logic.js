export const STORAGE_KEY = "dayflow-local-mvp-v1";
export const LEGACY_STORAGE_KEYS = ["dayflow-local-mvp-v1"];

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function displayDate(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createDefaultHistory(baseDate = new Date(), length = 59) {
  return Array.from({ length }, (_, index) => {
    const daysAgo = length - index;
    const date = new Date(baseDate);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    const weekday = date.getDay();
    const weekendScale = weekday === 0 || weekday === 6 ? 0.62 : 1;
    const wave = Math.sin(index * 0.72) * 48;
    const focusMinutes = Math.max(
      42,
      Math.round((188 + wave + ((index * 17) % 37)) * weekendScale)
    );
    const scheduled = 4 + ((index * 5) % 4);
    const completed = Math.max(1, scheduled - (index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0));
    const meetingMinutes = Math.round((45 + ((index * 19) % 76)) * weekendScale);
    const routineMinutes = 35 + ((index * 11) % 45);
    const breakMinutes = 45 + ((index * 7) % 36);

    return {
      dateKey: localDateKey(date),
      date: displayDate(date),
      label: WEEKDAYS[weekday],
      hasData: true,
      focusMinutes,
      completed,
      scheduled,
      contextSwitches: 2 + ((index * 3) % 5),
      categories: {
        focus: focusMinutes,
        meeting: meetingMinutes,
        routine: routineMinutes,
        break: breakMinutes
      }
    };
  });
}

export function createDefaultState() {
  return {
    version: 5,
    lastActiveDate: localDateKey(),
    lastRolloverAt: null,
    activeModule: "dayflow",
    dayflowView: "today",
    selectedCaptureId: "capture-v11",
    selectedIdeaId: "idea-light-bridge",
    dayClosed: false,
    captures: [
      {
        id: "capture-v11",
        text: "把参考官网的波墨与产品电影做成同一条故事。",
        source: "灵感",
        createdAt: "今天 09:12",
        project: "DayFlow",
        people: "自己",
        urgency: "高",
        energy: "深度工作",
        deadline: "今天 18:00",
        notes: "先验收核心流程，再统一视觉叙事，避免边做边返工。",
        status: "suggested",
        suggestion: {
          title: "先完成 V11 官网体验验收",
          reason: "上午没有会议，而且这是今天最重要的交付。先确认体验问题，后续修改会更聚焦。",
          start: "09:30",
          duration: 90,
          confidence: 88
        }
      },
      {
        id: "capture-interview",
        text: "整理昨天的用户访谈：大家希望建议能解释原因，也要能随时撤回。",
        source: "会议",
        createdAt: "今天 09:47",
        project: "DayFlow",
        people: "设计、产品",
        urgency: "中",
        energy: "轻量整理",
        deadline: "本周五",
        notes: "",
        status: "inbox",
        suggestion: null
      },
      {
        id: "capture-weekly",
        text: "准备周会：说明 MVP 已经打通了哪些环节。",
        source: "任务",
        createdAt: "今天 08:56",
        project: "DayFlow",
        people: "项目组",
        urgency: "中",
        energy: "沟通",
        deadline: "明天 10:00",
        notes: "",
        status: "inbox",
        suggestion: null
      }
    ],
    timeline: [
      {
        id: "event-morning",
        captureId: null,
        title: "晨间回顾与规划",
        start: "08:30",
        duration: 30,
        type: "routine",
        done: true
      },
      {
        id: "event-sync",
        captureId: null,
        title: "项目对齐会",
        start: "11:30",
        duration: 45,
        type: "meeting",
        done: false
      },
      {
        id: "event-lunch",
        captureId: null,
        title: "午间恢复",
        start: "12:30",
        duration: 60,
        type: "break",
        done: false
      },
      {
        id: "event-review",
        captureId: null,
        title: "设计评审",
        start: "14:30",
        duration: 45,
        type: "meeting",
        done: false
      }
    ],
    memories: [
      {
        id: "memory-focus",
        time: "昨天 17:40",
        type: "偏好",
        text: "上午更容易进入深度工作，适合安排需要整合和判断的任务。",
        kept: true
      },
      {
        id: "memory-control",
        time: "周一 18:10",
        type: "原则",
        text: "任何写入日程的动作都先确认，不替用户做不可逆决定。",
        kept: true
      }
    ],
    ideas: [
      {
        id: "idea-light-bridge",
        title: "用一束光表现想法进入今天",
        body: "灵感不该突然变成任务。让它穿过界面，在 DayFlow 里落成一个仍需确认的下一步。",
        stage: "forming",
        nextStep: "为双模块转移补上清晰但克制的过渡动画",
        project: "LUMEN",
        source: "本地灵感",
        createdAt: "今天 10:08",
        updatedAt: "今天 10:08",
        linkedCaptureId: null
      },
      {
        id: "idea-quiet-context",
        title: "让项目上下文安静地浮现",
        body: "自动读取 Codex、OpenClaw 与本地项目里的高置信信号，但不展示原始敏感内容，也不替用户写回来源。",
        stage: "incubating",
        nextStep: "先展示来源、类型和建议动作，低置信内容保持隐藏",
        project: "LUMEN",
        source: "设计决定",
        createdAt: "昨天 17:32",
        updatedAt: "今天 09:40",
        linkedCaptureId: null
      },
      {
        id: "idea-friction-note",
        title: "确认应该像眨眼一样轻",
        body: "真正占用日程前只保留一次轻确认；其余整理、推荐和跨模块关联自动完成。",
        stage: "inbox",
        nextStep: "验证手机端确认操作是否能单手完成",
        project: "DayFlow",
        source: "用户原则",
        createdAt: "周一 18:10",
        updatedAt: "周一 18:10",
        linkedCaptureId: null
      }
    ],
    ingestedSignalIds: [],
    transferLog: [],
    reflection: {
      signals: [
        "上午的专注度明显更高。",
        "先验收主流程，比同时修多个细节更省时间。",
        "解释建议原因，会让我更愿意确认安排。"
      ],
      note: "",
      savedAt: null
    },
    reviews: [],
    history: createDefaultHistory()
  };
}

export function normalizeState(candidate) {
  const fallback = createDefaultState();
  if (!candidate || typeof candidate !== "object") return fallback;
  if (!Array.isArray(candidate.captures) || !Array.isArray(candidate.timeline)) return fallback;

  const candidateHistory = Array.isArray(candidate.history) && candidate.history.length
    ? structuredClone(candidate.history)
    : [];
  const history = candidateHistory.length >= fallback.history.length
    ? candidateHistory.slice(-fallback.history.length)
    : [...fallback.history.slice(0, fallback.history.length - candidateHistory.length), ...candidateHistory];

  return {
    ...fallback,
    ...structuredClone(candidate),
    version: 5,
    lastActiveDate: candidate.lastActiveDate || fallback.lastActiveDate,
    dayflowView: ["today", "week", "month", "review"].includes(candidate.dayflowView)
      ? candidate.dayflowView
      : "today",
    captures: structuredClone(candidate.captures),
    timeline: structuredClone(candidate.timeline),
    memories: Array.isArray(candidate.memories)
      ? structuredClone(candidate.memories)
      : fallback.memories,
    ideas: Array.isArray(candidate.ideas)
      ? structuredClone(candidate.ideas)
      : fallback.ideas,
    ingestedSignalIds: Array.isArray(candidate.ingestedSignalIds)
      ? [...new Set(candidate.ingestedSignalIds)]
      : [],
    transferLog: Array.isArray(candidate.transferLog)
      ? structuredClone(candidate.transferLog)
      : [],
    reviews: Array.isArray(candidate.reviews)
      ? structuredClone(candidate.reviews).slice(-31)
      : [],
    reflection: {
      ...fallback.reflection,
      ...(candidate.reflection || {})
    },
    history
  };
}

export function toMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  return hours * 60 + minutes;
}

export function formatEndTime(start, duration) {
  const total = toMinutes(start) + Number(duration);
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function rangesOverlap(startA, durationA, startB, durationB) {
  const a = toMinutes(startA);
  const b = toMinutes(startB);
  return a < b + Number(durationB) && b < a + Number(durationA);
}

export function findConflicts(start, duration, timeline, ignoreEventId = null) {
  return timeline.filter(
    (event) =>
      event.id !== ignoreEventId &&
      rangesOverlap(start, duration, event.start, event.duration)
  );
}

function cleanTitle(text) {
  const normalized = String(text)
    .replace(/[。！？!?].*$/, "")
    .replace(/^(请|记得|需要|想要|准备|把)/, "")
    .trim();
  return normalized.length > 24 ? `${normalized.slice(0, 24)}…` : normalized;
}

export function buildSuggestion(capture) {
  const isDeep = capture.energy === "深度工作";
  const isHigh = capture.urgency === "高";
  const start = isDeep ? "09:30" : capture.energy === "沟通" ? "15:30" : "14:00";
  const duration = isHigh ? 90 : isDeep ? 75 : 45;
  const title = cleanTitle(capture.text) || "处理这条 Capture";
  const energyReason = isDeep
    ? "这件事需要整合与判断，放在专注度更高的时段更合适"
    : "这件事可以用一个边界清楚的时间块完成";
  const deadlineReason = capture.deadline
    ? `，同时兼顾「${capture.deadline}」的截止时间`
    : "";

  return {
    title,
    reason: `${energyReason}${deadlineReason}。你仍然可以编辑或暂不安排。`,
    start,
    duration,
    confidence: isHigh && isDeep ? 88 : 76
  };
}

export function confirmCaptureSchedule(state, captureId, draft) {
  const conflicts = findConflicts(draft.start, draft.duration, state.timeline);
  if (conflicts.length) return { state, conflicts };

  const nextState = structuredClone(state);
  const capture = nextState.captures.find((item) => item.id === captureId);
  if (!capture) return { state, conflicts: [], error: "CAPTURE_NOT_FOUND" };

  const eventId = `event-${captureId}-${Date.now()}`;
  nextState.timeline.push({
    id: eventId,
    captureId,
    title: draft.title.trim(),
    start: draft.start,
    duration: Number(draft.duration),
    type: "focus",
    done: false
  });
  capture.status = "scheduled";
  capture.scheduledEventId = eventId;
  capture.suggestion = { ...capture.suggestion, ...draft };
  nextState.dayClosed = false;

  return { state: nextState, conflicts: [] };
}

export function deriveDayStats(state) {
  const timeline = [...state.timeline].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const scheduled = timeline.length;
  const completed = timeline.filter((event) => event.done).length;
  const typeMinutes = timeline.reduce(
    (totals, event) => {
      const type = Object.hasOwn(totals, event.type) ? event.type : "routine";
      totals[type] += Number(event.duration) || 0;
      return totals;
    },
    { focus: 0, meeting: 0, routine: 0, break: 0 }
  );
  const focusMinutes = typeMinutes.focus;
  const captured = state.captures.length;
  const totalMinutes = Object.values(typeMinutes).reduce((sum, value) => sum + value, 0);
  const contextSwitches = timeline.reduce((count, event, index) => {
    if (!index) return count;
    return count + (event.type !== timeline[index - 1].type ? 1 : 0);
  }, 0);
  const completionRate = scheduled ? completed / scheduled : 0;

  return {
    scheduled,
    completed,
    focusMinutes,
    captured,
    totalMinutes,
    contextSwitches,
    completionRate,
    typeMinutes
  };
}

export function deriveDailyBrief(state) {
  const stats = deriveDayStats(state);
  const focusRatio = Math.min(stats.focusMinutes / 180, 1);
  const switchControl = Math.max(0, 1 - stats.contextSwitches / 6);
  const score = Math.min(
    98,
    Math.round(30 + stats.completionRate * 30 + focusRatio * 30 + switchControl * 10)
  );
  const sortedTimeline = [...state.timeline].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const focusBlocks = sortedTimeline.filter((event) => event.type === "focus");
  const firstFocus = focusBlocks[0];
  const longestFocus = [...focusBlocks].sort((a, b) => Number(b.duration) - Number(a.duration))[0];
  const pendingCapture = state.captures.find(
    (capture) => capture.status === "suggested" && capture.suggestion
  );
  const unfinishedEvent = sortedTimeline.find((event) => !event.done && event.type !== "break");

  let rhythm = "节奏正在形成";
  if (score >= 88) rhythm = "专注且流畅";
  else if (score >= 74) rhythm = "稳定且清晰";
  else if (score >= 58) rhythm = "有序但分散";

  const headline = stats.focusMinutes
    ? `今天已经为深度工作留出 ${stats.focusMinutes} 分钟，完成状态会持续改变这份总结。`
    : "今天的安排已经有形状，但还缺少一段经过确认的深度工作。";

  const focusInsight = firstFocus
    ? `${firstFocus.start} 开始的专注段是今天最清晰的工作窗口${longestFocus ? `，最长连续 ${longestFocus.duration} 分钟` : ""}。`
    : "今天还没有确认专注时间块；先从一条最重要的 Capture 开始。";
  const completionInsight = stats.scheduled
    ? `已完成 ${stats.completed} / ${stats.scheduled} 个时间块，完成率 ${Math.round(stats.completionRate * 100)}%。`
    : "今天还没有时间块，先确认一个下一步。";
  const switchInsight = stats.contextSwitches <= 3
    ? `任务类型切换 ${stats.contextSwitches} 次，工作上下文保持得较完整。`
    : `任务类型切换 ${stats.contextSwitches} 次，明天可把相邻沟通集中处理。`;

  const recommendation = pendingCapture
    ? {
        title: pendingCapture.suggestion.title,
        meta: `${pendingCapture.suggestion.start} · ${pendingCapture.suggestion.duration} 分钟 · 等待确认`,
        view: "today"
      }
    : unfinishedEvent
      ? {
          title: `继续完成：${unfinishedEvent.title}`,
          meta: `${unfinishedEvent.start} · ${unfinishedEvent.duration} 分钟 · 尚未完成`,
          view: "today"
        }
      : {
          title: "从下一条 Capture 开始明天",
          meta: "补充上下文后再决定是否进入时间线",
          view: "capture"
        };

  return {
    ...stats,
    score,
    rhythm,
    headline,
    insights: [focusInsight, completionInsight, switchInsight],
    recommendation
  };
}

function currentDayRecord(state, now = new Date()) {
  const stats = deriveDayStats(state);
  const brief = deriveDailyBrief(state);
  return {
    dateKey: localDateKey(now),
    date: displayDate(now),
    label: "今天",
    hasData: true,
    focusMinutes: stats.focusMinutes,
    completed: stats.completed,
    scheduled: stats.scheduled,
    contextSwitches: stats.contextSwitches,
    score: brief.score,
    categories: { ...stats.typeMinutes }
  };
}

function normalizeTrendDay(day) {
  const completionRate = day.scheduled ? day.completed / day.scheduled : 0;
  const inferredScore = Math.max(
    38,
    Math.round(88 - Number(day.contextSwitches || 0) * 5 + completionRate * 12)
  );
  return {
    ...day,
    hasData: day.hasData !== false,
    completionRate,
    score: day.hasData === false ? null : (day.score ?? inferredScore)
  };
}

function aggregateDays(days) {
  const totalFocusMinutes = days.reduce((sum, day) => sum + Number(day.focusMinutes || 0), 0);
  const totalCompleted = days.reduce((sum, day) => sum + Number(day.completed || 0), 0);
  const totalScheduled = days.reduce((sum, day) => sum + Number(day.scheduled || 0), 0);
  const scoredDays = days.filter((day) => Number.isFinite(day.score));
  const stability = scoredDays.length
    ? Math.round(scoredDays.reduce((sum, day) => sum + day.score, 0) / scoredDays.length)
    : 0;
  const bestDay = [...days].sort((a, b) => Number(b.focusMinutes) - Number(a.focusMinutes))[0];
  const categories = days.reduce(
    (totals, day) => {
      Object.keys(totals).forEach((type) => {
        totals[type] += Number(day.categories?.[type] || 0);
      });
      return totals;
    },
    { focus: 0, meeting: 0, routine: 0, break: 0 }
  );

  return {
    totalFocusMinutes,
    totalCompleted,
    totalScheduled,
    completionRate: totalScheduled ? totalCompleted / totalScheduled : 0,
    stability,
    bestDay,
    baselineHours: totalFocusMinutes / Math.max(days.length, 1) / 60,
    recordedDays: days.filter((day) => day.hasData !== false).length,
    categories
  };
}

function trendDays(state, now = new Date()) {
  const history = Array.isArray(state.history) && state.history.length
    ? state.history
    : createDefaultHistory(now);
  return [...history, currentDayRecord(state, now)].map(normalizeTrendDay);
}

export function buildTrendSeries(state, range = 7, now = new Date()) {
  const safeRange = range === 30 ? 30 : 7;
  const days = trendDays(state, now).slice(-safeRange);

  return {
    range: safeRange,
    days,
    ...aggregateDays(days)
  };
}

function percentDelta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function focusDuration(minutes) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

export function buildPeriodSummary(state, range = 7, now = new Date()) {
  const safeRange = range === 30 ? 30 : 7;
  const allDays = trendDays(state, now);
  const days = allDays.slice(-safeRange);
  const previousDays = allDays.slice(-(safeRange * 2), -safeRange);
  const current = aggregateDays(days);
  const previous = aggregateDays(previousDays);
  const comparison = {
    focusPercent: percentDelta(current.totalFocusMinutes, previous.totalFocusMinutes),
    completionPoints: Math.round((current.completionRate - previous.completionRate) * 100),
    stability: current.stability - previous.stability,
    averageFocusMinutes: Math.round((current.baselineHours - previous.baselineHours) * 60)
  };
  const focusDirection = comparison.focusPercent >= 8
    ? `比前一周期多 ${comparison.focusPercent}%`
    : comparison.focusPercent <= -8
      ? `比前一周期少 ${Math.abs(comparison.focusPercent)}%`
      : "与前一周期基本持平";
  const periodLabel = safeRange === 7 ? "过去 7 天" : "过去 30 天";
  const categoryLabels = { focus: "专注", meeting: "沟通", routine: "例行", break: "恢复" };
  const dominantCategory = Object.entries(current.categories).sort((a, b) => b[1] - a[1])[0] || ["focus", 0];
  const splitAt = Math.max(1, Math.floor(days.length / 2));
  const earlier = aggregateDays(days.slice(0, splitAt));
  const later = aggregateDays(days.slice(splitAt));
  const momentumMinutes = Math.round((later.baselineHours - earlier.baselineHours) * 60);
  const momentum = momentumMinutes > 12 ? "正在抬升" : momentumMinutes < -12 ? "正在回落" : "保持平稳";

  return {
    range: safeRange,
    periodLabel,
    days,
    previousDays,
    ...current,
    comparison,
    momentum,
    headline: `${periodLabel}留下了 ${focusDuration(current.totalFocusMinutes)}专注，${focusDirection}。`,
    insights: [
      current.bestDay
        ? `${current.bestDay.label} ${current.bestDay.date} 是最完整的一天，记录了 ${Math.round(current.bestDay.focusMinutes || 0)} 分钟专注。`
        : "这段时间还没有形成可比较的专注记录。",
      `完成率 ${Math.round(current.completionRate * 100)}%，相对前一周期${comparison.completionPoints >= 0 ? "提高" : "下降"} ${Math.abs(comparison.completionPoints)} 个百分点。`,
      `${categoryLabels[dominantCategory[0]]}是占比最高的时间类型；后半段节奏${momentum}。`
    ]
  };
}

export function buildDailyReview(state, dateKey = state.lastActiveDate || localDateKey(), options = {}) {
  const stats = deriveDayStats(state);
  const brief = deriveDailyBrief(state);
  const completedEvents = state.timeline.filter((event) => event.done);
  const unfinishedEvents = state.timeline.filter((event) => !event.done && event.type !== "break");
  const pendingCaptures = state.captures.filter((capture) => ["inbox", "suggested"].includes(capture.status));
  const projects = [...new Set(state.captures.map((capture) => capture.project).filter(Boolean))];
  const conversationSignals = [
    ...state.captures.filter((capture) => capture.sourceMeta || capture.sourceSignalId),
    ...state.ideas.filter((idea) => idea.sourceMeta || idea.sourceSignalId)
  ];
  const wins = completedEvents.slice(0, 3).map((event) => ({
    title: event.title,
    meta: `${event.start} · ${event.duration} 分钟 · ${event.type === "focus" ? "专注" : "已完成"}`
  }));
  if (!wins.length) wins.push({ title: "完成状态仍在形成", meta: "今天还没有已完成的时间块" });

  const frictions = [];
  if (unfinishedEvents.length) {
    frictions.push({
      title: `${unfinishedEvents.length} 个行动块尚未完成`,
      root: stats.contextSwitches > 3 ? "工作类型切换偏多，连续上下文被打断。" : "计划已经明确，但执行闭环还没有结束。",
      lesson: "下一周期只保留一个最重要的未完成块，并先确认它。"
    });
  }
  if (pendingCaptures.length) {
    frictions.push({
      title: `${pendingCaptures.length} 条 Capture 仍停留在候选层`,
      root: "信息已经出现，但证据或时间承诺还不够清楚。",
      lesson: "候选可以自动整理，真正占用时间继续保持轻确认。"
    });
  }
  if (!frictions.length) {
    frictions.push({ title: "没有发现新的结构性问题", root: "当天行动与确认链路完整。", lesson: "保持现有规则，不为升级而升级。" });
  }

  const lessons = (state.reflection?.signals || []).slice(0, 3).map((text, index) => ({
    id: `lesson-${dateKey}-${index}`,
    text,
    evidence: index === 0 ? "当日时间线与完成状态" : "本地上下文与复盘信号"
  }));
  const upgrades = [];
  if (conversationSignals.length >= 3) {
    upgrades.push({
      id: `upgrade-filter-${dateKey}`,
      target: "Skill",
      title: "保留高置信上下文筛选与来源上限",
      evidenceCount: conversationSignals.length,
      confidence: 0.9,
      status: "candidate",
      scope: "交由身份记忆任务复核"
    });
  }
  if (pendingCaptures.length >= 2) {
    upgrades.push({
      id: `upgrade-confirm-${dateKey}`,
      target: "AGENTS",
      title: "候选自动整理，时间写入继续要求确认",
      evidenceCount: pendingCaptures.length,
      confidence: 0.86,
      status: "candidate",
      scope: "交由身份记忆任务复核"
    });
  }
  if (stats.contextSwitches >= 4) {
    upgrades.push({
      id: `upgrade-loop-${dateKey}`,
      target: "Loop",
      title: "复核阶段集中处理相邻沟通，减少上下文切换",
      evidenceCount: stats.contextSwitches,
      confidence: 0.78,
      status: "observe",
      scope: "再观察一个周期"
    });
  }

  const nextPriorities = [
    ...pendingCaptures.filter((capture) => capture.suggestion).map((capture) => capture.suggestion.title),
    ...unfinishedEvents.map((event) => event.title),
    "检查新的本地上下文信号"
  ].filter(Boolean).slice(0, 3);

  return {
    id: `review-${dateKey}`,
    dateKey,
    date: displayDate(dateFromKey(dateKey)),
    label: options.live ? "今日预览" : "昨日复盘",
    generatedAt: (options.now || new Date()).toISOString(),
    score: brief.score,
    summary: `完成 ${stats.completed} / ${stats.scheduled} 个时间块，留下 ${stats.focusMinutes} 分钟专注；${frictions.length === 1 && frictions[0].title.includes("没有发现") ? "节奏稳定，无需新增规则。" : "问题已经被整理成下一步与升级候选。"}`,
    evidence: {
      projects: projects.length,
      conversations: conversationSignals.length,
      items: state.captures.length + state.timeline.length
    },
    wins,
    frictions: frictions.slice(0, 3),
    lessons,
    upgrades,
    nextPriorities
  };
}

export function createExampleReview(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  const dateKey = localDateKey(date);
  return {
    id: `review-${dateKey}`,
    dateKey,
    date: displayDate(date),
    label: "昨日复盘",
    generatedAt: new Date(baseDate).toISOString(),
    score: 88,
    summary: "两个项目完成了可运行闭环；公开展示前发现真实本地上下文不应进入截图，并把问题转成了脱敏门禁。",
    evidence: { projects: 2, conversations: 6, items: 14 },
    wins: [
      { title: "DayFlow 完成日、周、月三层总结", meta: "01-dayflow · 19 项自动验证" },
      { title: "公开 Demo 与真实本地模式完成隔离", meta: "独立端口 · 独立浏览器状态" },
      { title: "来源、许可和 GitHub 门禁补齐", meta: "ATTRIBUTION · SECURITY · CI" }
    ],
    frictions: [
      { title: "真实本地信号曾进入演示画布", root: "演示与个人使用最初共用同一数据入口。", lesson: "任何公开截图必须先切换到确定性的脱敏 Demo。" },
      { title: "一次性规则容易污染长期 AGENTS", root: "项目教训和全局行为规则没有先做证据分层。", lesson: "LUMEN 只提出候选；身份记忆任务负责跨日验证与晋升。" }
    ],
    lessons: [
      { id: `lesson-${dateKey}-0`, text: "先把问题变成可验证门禁，再考虑写入长期规则。", evidence: "公开安全检查与 Demo 复验" },
      { id: `lesson-${dateKey}-1`, text: "日报描述事实；升级候选必须显示证据数、置信度和生效范围。", evidence: "项目对话与规则边界" }
    ],
    upgrades: [
      { id: `upgrade-${dateKey}-0`, target: "AGENTS", title: "公开发布前强制执行个人信息与凭据检查", evidenceCount: 3, confidence: 0.94, status: "candidate", scope: "交由身份记忆任务复核" },
      { id: `upgrade-${dateKey}-1`, target: "Skill", title: "将复盘拆成事实、根因、教训与升级候选四层", evidenceCount: 2, confidence: 0.89, status: "candidate", scope: "交由身份记忆任务复核" }
    ],
    nextPriorities: ["完成 GitHub 发布前最终脱敏", "保留一个可运行 Demo 入口", "把跨项目自动复盘留给身份记忆主任务"]
  };
}

function makeDailySnapshot(state, dateKey) {
  const date = dateFromKey(dateKey);
  const stats = deriveDayStats(state);
  const brief = deriveDailyBrief(state);
  return {
    dateKey,
    date: displayDate(date),
    label: WEEKDAYS[date.getDay()],
    hasData: true,
    focusMinutes: stats.focusMinutes,
    completed: stats.completed,
    scheduled: stats.scheduled,
    contextSwitches: stats.contextSwitches,
    score: brief.score,
    categories: { ...stats.typeMinutes },
    headline: brief.headline,
    insights: brief.insights,
    reflectionNote: state.reflection?.note || "",
    closedAt: state.reflection?.savedAt || null
  };
}

function makeEmptyDay(dateKey) {
  const date = dateFromKey(dateKey);
  return {
    dateKey,
    date: displayDate(date),
    label: WEEKDAYS[date.getDay()],
    hasData: false,
    focusMinutes: 0,
    completed: 0,
    scheduled: 0,
    contextSwitches: 0,
    score: null,
    categories: { focus: 0, meeting: 0, routine: 0, break: 0 }
  };
}

function appendHistoryDay(history, day) {
  return [
    ...history.filter((item) => item.dateKey !== day.dateKey && !(item.dateKey == null && item.date === day.date)),
    day
  ].slice(-59);
}

export function ensureDailyRollover(state, now = new Date()) {
  const todayKey = localDateKey(now);
  if (state?.lastActiveDate === todayKey) return { state, rolledOver: false, archivedDays: [] };

  const current = normalizeState(state);
  const previousKey = current.lastActiveDate || todayKey;
  if (previousKey >= todayKey) {
    return {
      state: { ...current, lastActiveDate: todayKey, lastRolloverAt: now.toISOString() },
      rolledOver: previousKey !== todayKey,
      archivedDays: []
    };
  }

  const archivedDays = [makeDailySnapshot(current, previousKey)];
  const cursor = dateFromKey(previousKey);
  cursor.setDate(cursor.getDate() + 1);
  while (localDateKey(cursor) < todayKey && archivedDays.length < 370) {
    archivedDays.push(makeEmptyDay(localDateKey(cursor)));
    cursor.setDate(cursor.getDate() + 1);
  }
  let history = current.history;
  archivedDays.forEach((day) => { history = appendHistoryDay(history, day); });
  const review = buildDailyReview(current, previousKey, { now });
  const reviews = [
    ...current.reviews.filter((item) => item.dateKey !== previousKey),
    review
  ].slice(-31);

  const timelineByCapture = new Map(
    current.timeline.filter((event) => event.captureId).map((event) => [event.captureId, event])
  );
  const captures = current.captures.map((capture) => {
    if (capture.status !== "scheduled") return capture;
    const event = timelineByCapture.get(capture.id);
    const { scheduledEventId, ...rest } = capture;
    return {
      ...rest,
      status: event?.done ? "completed" : capture.suggestion ? "suggested" : "inbox"
    };
  });
  const timeline = current.timeline
    .filter((event) => !event.captureId)
    .map((event) => ({ ...event, done: false }));

  return {
    state: {
      ...current,
      lastActiveDate: todayKey,
      lastRolloverAt: now.toISOString(),
      history,
      reviews,
      captures,
      timeline,
      dayClosed: false,
      reflection: { ...current.reflection, note: "", savedAt: null }
    },
    rolledOver: true,
    archivedDays
  };
}

export function statusLabel(status) {
  return {
    inbox: "待整理",
    suggested: "待确认",
    scheduled: "已安排",
    completed: "已完成",
    rejected: "已暂缓"
  }[status] || status;
}

export function stageLabel(stage) {
  return {
    inbox: "刚刚收下",
    incubating: "正在孵化",
    forming: "接近成形",
    archived: "已经沉淀"
  }[stage] || stage;
}

function localClock(date = new Date()) {
  return `今天 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function makeLocalId(prefix, value, now = Date.now()) {
  const slug = String(value || prefix)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return `${prefix}-${slug || "item"}-${now.toString(36)}`;
}

export function createIdea(input = {}, options = {}) {
  const now = options.now ?? new Date();
  const title = String(input.title || "未命名灵感").trim();
  return {
    id: input.id || makeLocalId("idea", title, now.getTime()),
    title,
    body: String(input.body || "").trim(),
    stage: input.stage || "inbox",
    nextStep: String(input.nextStep || "").trim(),
    project: String(input.project || "未归类").trim(),
    source: String(input.source || "手动记录").trim(),
    createdAt: input.createdAt || localClock(now),
    updatedAt: input.updatedAt || localClock(now),
    linkedCaptureId: input.linkedCaptureId || null,
    sourceSignalId: input.sourceSignalId || null,
    sourceMeta: input.sourceMeta ? structuredClone(input.sourceMeta) : null
  };
}

export function routeContextSignal(signal) {
  if (signal?.module === "refract") return "refract";
  return ["idea", "decision"].includes(signal?.type) ? "refract" : "dayflow";
}

function captureFromSignal(signal, now) {
  const urgent = ["blocker", "risk"].includes(signal.type);
  const capture = {
    id: `capture-signal-${signal.id}`,
    text: signal.title,
    source: signal.source?.kind || "本地上下文",
    createdAt: localClock(now),
    project: signal.project || "未归类",
    people: "",
    urgency: urgent ? "高" : "中",
    energy: urgent ? "深度工作" : "轻量整理",
    deadline: urgent ? "尽快" : "",
    notes: signal.nextAction || "",
    status: "suggested",
    suggestion: null,
    sourceSignalId: signal.id,
    sourceMeta: signal.source ? structuredClone(signal.source) : null
  };
  capture.suggestion = buildSuggestion(capture);
  return capture;
}

export function ingestContextSignals(state, signals = [], options = {}) {
  const nextState = normalizeState(state);
  const now = options.now ?? new Date();
  const seen = new Set(nextState.ingestedSignalIds);
  const addedCaptures = [];
  const addedIdeas = [];

  for (const signal of signals) {
    if (!signal?.id || seen.has(signal.id) || Number(signal.confidence || 0) < 0.76) continue;
    if (routeContextSignal(signal) === "refract") {
      const idea = createIdea({
        id: `idea-signal-${signal.id}`,
        title: signal.title,
        body: signal.excerpt || signal.title,
        stage: signal.type === "decision" ? "forming" : "inbox",
        nextStep: signal.nextAction || "继续整理这个想法",
        project: signal.project,
        source: signal.source?.kind || "本地上下文",
        sourceSignalId: signal.id,
        sourceMeta: signal.source
      }, { now });
      nextState.ideas.unshift(idea);
      addedIdeas.push(idea);
    } else {
      const capture = captureFromSignal(signal, now);
      nextState.captures.unshift(capture);
      addedCaptures.push(capture);
    }
    seen.add(signal.id);
  }

  nextState.ingestedSignalIds = [...seen];
  return { state: nextState, addedCaptures, addedIdeas };
}

export function reconcileContextSignals(state, signals = []) {
  const nextState = normalizeState(state);
  const activeIds = new Set(signals.map((signal) => signal?.id).filter(Boolean));
  nextState.captures = nextState.captures.filter((capture) =>
    !capture.sourceSignalId || activeIds.has(capture.sourceSignalId) || capture.status === "scheduled"
  );
  nextState.ideas = nextState.ideas.filter((idea) =>
    !idea.sourceSignalId || activeIds.has(idea.sourceSignalId) || Boolean(idea.linkedCaptureId)
  );
  const retainedIds = new Set([
    ...nextState.captures.map((capture) => capture.sourceSignalId),
    ...nextState.ideas.map((idea) => idea.sourceSignalId)
  ].filter(Boolean));
  nextState.ingestedSignalIds = nextState.ingestedSignalIds.filter((id) => activeIds.has(id) || retainedIds.has(id));
  if (!nextState.captures.some((capture) => capture.id === nextState.selectedCaptureId)) {
    nextState.selectedCaptureId = nextState.captures[0]?.id || null;
  }
  if (!nextState.ideas.some((idea) => idea.id === nextState.selectedIdeaId)) {
    nextState.selectedIdeaId = nextState.ideas[0]?.id || null;
  }
  return nextState;
}

export function promoteIdeaToCapture(state, ideaId, options = {}) {
  const nextState = normalizeState(state);
  const idea = nextState.ideas.find((item) => item.id === ideaId);
  if (!idea) return { state, error: "IDEA_NOT_FOUND", capture: null };
  if (idea.linkedCaptureId) {
    return {
      state: nextState,
      capture: nextState.captures.find((item) => item.id === idea.linkedCaptureId) || null,
      reused: true
    };
  }

  const now = options.now ?? new Date();
  const capture = {
    id: makeLocalId("capture-idea", idea.id, now.getTime()),
    text: idea.nextStep || idea.title,
    source: "折光 · 灵感库",
    createdAt: localClock(now),
    project: idea.project || "未归类",
    people: "",
    urgency: "中",
    energy: "深度工作",
    deadline: "",
    notes: `来自「${idea.title}」`,
    status: "suggested",
    suggestion: null,
    sourceIdeaId: idea.id
  };
  capture.suggestion = buildSuggestion(capture);
  nextState.captures.unshift(capture);
  idea.stage = "forming";
  idea.linkedCaptureId = capture.id;
  idea.updatedAt = localClock(now);
  nextState.selectedCaptureId = capture.id;
  nextState.activeModule = "dayflow";
  nextState.transferLog.unshift({
    id: makeLocalId("transfer", idea.id, now.getTime()),
    ideaId: idea.id,
    captureId: capture.id,
    createdAt: now.toISOString()
  });
  nextState.transferLog = nextState.transferLog.slice(0, 30);

  return { state: nextState, capture, reused: false };
}
