import { useEffect, useMemo, useRef, useState } from "react";
import {
  STORAGE_KEY,
  buildDailyReview,
  buildPeriodSummary,
  buildSuggestion,
  confirmCaptureSchedule,
  createDefaultState,
  createExampleReview,
  createIdea,
  deriveDailyBrief,
  ensureDailyRollover,
  formatEndTime,
  ingestContextSignals,
  normalizeState,
  promoteIdeaToCapture,
  reconcileContextSignals,
  stageLabel,
  statusLabel,
  toMinutes
} from "../logic.js";

const MODULES = [
  { id: "dayflow", number: "01", label: "今日流", sub: "DayFlow" },
  { id: "refract", number: "02", label: "灵感库", sub: "Refract" }
];

const STAGES = ["inbox", "incubating", "forming", "archived"];
const URL_PARAMS = new URLSearchParams(window.location.search);
const DEMO_MODE = import.meta.env.VITE_LUMEN_DEMO === "1" || URL_PARAMS.get("demo") === "1";
const FRESH_DEMO = DEMO_MODE && URL_PARAMS.get("fresh") === "1";
const ACTIVE_STORAGE_KEY = DEMO_MODE ? `${STORAGE_KEY}-public-demo` : STORAGE_KEY;

function createPublicDemoState() {
  const state = createDefaultState();
  state.timeline.push({
    id: "event-demo-showcase",
    captureId: "demo-showcase",
    title: "整理 LUMEN 的发布叙事",
    start: "09:20",
    duration: 100,
    type: "focus",
    done: true
  });
  state.reviews = [createExampleReview()];
  return state;
}

function loadState() {
  try {
    const saved = FRESH_DEMO ? null : localStorage.getItem(ACTIVE_STORAGE_KEY);
    const normalized = normalizeState(saved ? JSON.parse(saved) : DEMO_MODE ? createPublicDemoState() : createDefaultState());
    return ensureDailyRollover(normalized, new Date()).state;
  } catch {
    return createDefaultState();
  }
}

function shortDate() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date());
}

function ModuleSwitch({ active, onChange }) {
  return (
    <nav className="module-switch" aria-label="LUMEN 两个模块">
      {MODULES.map((module) => (
        <button
          key={module.id}
          className={active === module.id ? "module-button is-active" : "module-button"}
          data-testid={`module-${module.id}`}
          type="button"
          onClick={() => onChange(module.id)}
        >
          <span className="module-number">{module.number}</span>
          <span>
            <strong>{module.label}</strong>
            <small>{module.sub}</small>
          </span>
        </button>
      ))}
      <span className={`module-track is-${active}`} aria-hidden="true" />
    </nav>
  );
}

function ContextButton({ snapshot, onClick }) {
  const isReady = snapshot?.status === "ready";
  const count = snapshot?.stats?.visibleSignals || 0;
  return (
    <button className="context-button" type="button" onClick={onClick} data-testid="context-open">
      <span className={`status-light is-${snapshot?.status || "idle"}`} aria-hidden="true" />
      <span>
        <small>{snapshot?.mode === "demo" ? "示例上下文" : "本地上下文"}</small>
        <strong>{isReady ? `${count} 条已筛选` : snapshot?.status === "scanning" ? "正在安静读取" : "等待连接"}</strong>
      </span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

function CaptureComposer({ onAdd, onClose }) {
  const [form, setForm] = useState({ text: "", project: "LUMEN", urgency: "中", energy: "深度工作" });
  const submit = (event) => {
    event.preventDefault();
    if (!form.text.trim()) return;
    onAdd(form);
    onClose();
  };
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-head">
        <div><span>NEW CAPTURE</span><h3>先把它放下来。</h3></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button>
      </div>
      <textarea
        autoFocus
        value={form.text}
        onChange={(event) => setForm({ ...form, text: event.target.value })}
        placeholder="一句话就够，LUMEN 会整理下一步……"
        aria-label="Capture 内容"
      />
      <div className="field-row">
        <label>项目<input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} /></label>
        <label>紧急度<select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}><option>中</option><option>高</option><option>低</option></select></label>
        <label>精力<select value={form.energy} onChange={(event) => setForm({ ...form, energy: event.target.value })}><option>深度工作</option><option>轻量整理</option><option>沟通</option></select></label>
      </div>
      <button className="primary-button" type="submit">理解并生成建议 <span>→</span></button>
    </form>
  );
}

function SuggestionPanel({ capture, onConfirm }) {
  const suggestion = capture?.suggestion;
  const [draft, setDraft] = useState(suggestion || { title: "", start: "09:30", duration: 60 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(suggestion || { title: "", start: "09:30", duration: 60 });
    setMessage("");
  }, [capture?.id, suggestion?.title, suggestion?.start, suggestion?.duration]);

  if (!capture || capture.status !== "suggested" || !suggestion) {
    return (
      <section className="suggestion-panel suggestion-empty">
        <span className="section-kicker">NEXT LIGHT</span>
        <h3>没有等待确认的建议。</h3>
        <p>新的 Capture、项目变化或灵感下一步出现时，会先在这里解释原因。</p>
      </section>
    );
  }

  const confirm = () => {
    const result = onConfirm(capture.id, draft);
    if (result?.conflicts?.length) {
      setMessage(`与「${result.conflicts[0].title}」冲突，请换一个时间。`);
    }
  };

  return (
    <section className="suggestion-panel" data-testid="suggestion-panel">
      <div className="suggestion-glow" aria-hidden="true" />
      <div className="suggestion-label"><span>建议下一步</span><b>{suggestion.confidence}% 清晰度</b></div>
      <input className="suggestion-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="建议标题" />
      <p>{suggestion.reason}</p>
      <div className="schedule-fields">
        <label><span>开始</span><input data-testid="suggestion-start" aria-label="开始" type="time" value={draft.start} onInput={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, start: value })); setMessage(""); }} /></label>
        <label><span>长度</span><select value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}><option value="30">30 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option><option value="75">75 分钟</option><option value="90">90 分钟</option></select></label>
        <div className="end-time"><span>结束</span><strong>{formatEndTime(draft.start, draft.duration)}</strong></div>
      </div>
      {message && <p className="inline-error" role="alert">{message}</p>}
      <button className="confirm-button" type="button" onClick={confirm} data-testid="suggestion-confirm">
        确认放进今天 <span aria-hidden="true">↗</span>
      </button>
      <small className="confirmation-note">只有这一步需要你确认。本地来源不会被修改。</small>
    </section>
  );
}

function Timeline({ events, onToggle }) {
  const sorted = [...events].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return (
    <section className="timeline-section">
      <div className="section-heading">
        <div><span className="section-kicker">TODAY / FLOW</span><h2>今天的形状</h2></div>
        <p>{sorted.filter((event) => event.done).length}/{sorted.length} 已完成</p>
      </div>
      <div className="timeline-list">
        {sorted.map((event) => (
          <article className={`timeline-row is-${event.type} ${event.done ? "is-done" : ""}`} key={event.id}>
            <time>{event.start}</time>
            <span className="timeline-line" aria-hidden="true"><i /></span>
            <div>
              <span>{event.type === "focus" ? "专注" : event.type === "meeting" ? "沟通" : event.type === "break" ? "恢复" : "例行"}</span>
              <h3>{event.title}</h3>
              <p>{event.duration} 分钟 · {formatEndTime(event.start, event.duration)} 结束</p>
            </div>
            <button type="button" className="done-button" onClick={() => onToggle(event.id)} aria-label={event.done ? `将 ${event.title} 标记为未完成` : `完成 ${event.title}`}>
              {event.done ? "✓" : "○"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

const DAYFLOW_VIEWS = [
  { id: "today", label: "今天", sub: "实时总结" },
  { id: "week", label: "7 天", sub: "周度回顾" },
  { id: "month", label: "30 天", sub: "月度趋势" },
  { id: "review", label: "复盘", sub: "自我升级" }
];

function DayflowPeriodSwitch({ active, onChange }) {
  return (
    <div className="period-switch-row">
      <nav className="period-switch" aria-label="DayFlow 时间范围">
        {DAYFLOW_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={active === view.id ? "is-active" : ""}
            data-testid={`period-${view.id}`}
            onClick={() => onChange(view.id)}
          >
            <strong>{view.label}</strong>
            <small>{view.sub}</small>
          </button>
        ))}
      </nav>
      <p><i aria-hidden="true" /> 每日自动结算 · 完成后即时更新</p>
    </div>
  );
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function FocusTrendChart({ summary }) {
  const width = 1000;
  const height = 280;
  const paddingX = 24;
  const paddingY = 30;
  const maxMinutes = Math.max(60, ...summary.days.map((day) => Number(day.focusMinutes || 0)));
  const points = summary.days.map((day, index) => ({
    day,
    x: paddingX + (index / Math.max(summary.days.length - 1, 1)) * (width - paddingX * 2),
    y: height - paddingY - (Number(day.focusMinutes || 0) / maxMinutes) * (height - paddingY * 2)
  }));
  const line = smoothPath(points);
  const area = `${line} L ${points.at(-1)?.x || paddingX} ${height - paddingY} L ${points[0]?.x || paddingX} ${height - paddingY} Z`;
  const dotEvery = summary.range === 7 ? 1 : 5;

  return (
    <figure className="trend-figure">
      <figcaption>
        <div><span className="section-kicker">FOCUS CURVE</span><h3>专注曲线</h3></div>
        <p><span>后半段节奏</span><strong>{summary.momentum}</strong></p>
      </figcaption>
      <div className="trend-chart-wrap">
        <span className="chart-peak">{Math.round(maxMinutes / 60 * 10) / 10}h</span>
        <span className="chart-zero">0</span>
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${summary.periodLabel}每日专注分钟趋势`}>
          {[0, 0.5, 1].map((ratio) => (
            <line key={ratio} x1={paddingX} x2={width - paddingX} y1={paddingY + ratio * (height - paddingY * 2)} y2={paddingY + ratio * (height - paddingY * 2)} className="trend-grid-line" />
          ))}
          <path d={area} className="trend-area" />
          <path d={line} className="trend-line" />
          {points.map((point, index) => (index % dotEvery === 0 || index === points.length - 1) && (
            <circle
              key={point.day.dateKey || `${point.day.date}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 5 : 3.5}
              className={point.day.hasData === false ? "trend-dot is-empty" : "trend-dot"}
            >
              <title>{point.day.label} {point.day.date}：{point.day.hasData === false ? "未记录" : `${point.day.focusMinutes} 分钟专注`}</title>
            </circle>
          ))}
        </svg>
        <div className="trend-axis"><span>{summary.days[0]?.date}</span><span>{summary.range === 7 ? "每一天" : "每 5 天标记"}</span><span>今天</span></div>
      </div>
    </figure>
  );
}

function signed(value, suffix = "") {
  if (!value) return `0${suffix}`;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function formatFocusHours(minutes) {
  const value = Number(minutes || 0) / 60;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function PeriodReport({ state, range }) {
  const summary = useMemo(() => buildPeriodSummary(state, range), [state, range]);
  const categoryLabels = { focus: "专注", meeting: "沟通", routine: "例行", break: "恢复" };
  const categoryTotal = Object.values(summary.categories).reduce((sum, value) => sum + value, 0);
  const metrics = [
    { label: "专注时间", value: formatFocusHours(summary.totalFocusMinutes), unit: "小时", delta: signed(summary.comparison.focusPercent, "%") },
    { label: "完成率", value: Math.round(summary.completionRate * 100), unit: "%", delta: signed(summary.comparison.completionPoints, "pt") },
    { label: "节律稳定", value: summary.stability, unit: "/100", delta: signed(summary.comparison.stability) },
    { label: "日均专注", value: Math.round(summary.baselineHours * 60), unit: "分钟", delta: signed(summary.comparison.averageFocusMinutes, "m") }
  ];

  return (
    <div className="period-report" data-testid={`report-${range}`}>
      <section className="report-opening">
        <div>
          <span className="section-kicker">AUTOMATIC REVIEW / {summary.periodLabel}</span>
          <h2>{summary.headline}</h2>
        </div>
        <div className="report-comparison">
          <span>对比前一周期</span>
          <strong className={summary.comparison.focusPercent >= 0 ? "is-up" : "is-down"}>{signed(summary.comparison.focusPercent, "%")}</strong>
          <p>{summary.recordedDays} 天有记录 · 本地自动更新</p>
        </div>
      </section>

      <FocusTrendChart summary={summary} />

      <section className="report-metrics" aria-label="周期摘要指标">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <p><strong>{metric.value}</strong><small>{metric.unit}</small></p>
            <em className={metric.delta.startsWith("-") ? "is-down" : "is-up"}>{metric.delta} / 上期</em>
          </article>
        ))}
      </section>

      <section className="report-reading">
        <div className="report-insights">
          <span className="section-kicker">EDITORIAL NOTES</span>
          <h3>这段节奏，值得这样读。</h3>
          {summary.insights.map((insight, index) => <p key={insight}><b>{String(index + 1).padStart(2, "0")}</b>{insight}</p>)}
        </div>
        <div className="category-composition">
          <span className="section-kicker">TIME COMPOSITION</span>
          <h3>时间去了哪里</h3>
          {Object.entries(summary.categories).map(([type, minutes]) => {
            const share = categoryTotal ? Math.round(minutes / categoryTotal * 100) : 0;
            return (
              <div className={`category-row is-${type}`} key={type}>
                <span>{categoryLabels[type]}</span>
                <i><b style={{ width: `${share}%` }} /></i>
                <strong>{share}%</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`rhythm-ribbon is-${range}`}>
        <div className="section-heading">
          <div><span className="section-kicker">DAILY TRACE</span><h2>每天留下的痕迹</h2></div>
          <p>珊瑚色越高，专注越完整</p>
        </div>
        <div className="rhythm-days">
          {summary.days.map((day, index) => {
            const peak = Math.max(1, ...summary.days.map((item) => Number(item.focusMinutes || 0)));
            const height = day.hasData === false ? 2 : Math.max(8, Math.round(Number(day.focusMinutes || 0) / peak * 100));
            const showLabel = summary.range === 7 || index % 5 === 0 || index === summary.days.length - 1;
            return (
              <div className={day.hasData === false ? "rhythm-day is-empty" : "rhythm-day"} key={day.dateKey || `${day.date}-${index}`} title={day.hasData === false ? `${day.date} 未记录` : `${day.date} · ${day.focusMinutes} 分钟`}>
                <span><i style={{ height: `${height}%` }} /></span>
                <small>{showLabel ? (index === summary.days.length - 1 ? "今" : day.date.slice(3)) : ""}</small>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReviewReport({ state }) {
  const review = useMemo(
    () => state.reviews.at(-1) || buildDailyReview(state, state.lastActiveDate, { live: true }),
    [state]
  );
  const statusLabel = { candidate: "等待复核", observe: "继续观察", adopted: "已采纳" };

  return (
    <div className="review-report" data-testid="review-report">
      <section className="review-opening">
        <div>
          <span className="section-kicker">{review.label} / {review.date}</span>
          <h2>{review.summary}</h2>
          <p>结合本地项目、时间线与对话信号自动生成；事实留在 LUMEN，跨项目规则交由身份记忆任务复核。</p>
        </div>
        <div className="review-evidence" aria-label="复盘证据覆盖">
          <div><strong>{review.evidence.projects}</strong><span>项目</span></div>
          <div><strong>{review.evidence.conversations}</strong><span>对话信号</span></div>
          <div><strong>{review.evidence.items}</strong><span>证据项</span></div>
        </div>
      </section>

      <section className="review-ledger">
        <div className="review-wins">
          <span className="section-kicker">WHAT MOVED</span>
          <h3>真正推进了什么</h3>
          {review.wins.map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong>{item.title}</strong><p>{item.meta}</p></div>
            </article>
          ))}
        </div>
        <div className="review-frictions">
          <span className="section-kicker">FRICTION / ROOT CAUSE</span>
          <h3>问题不是结论，根因才是。</h3>
          {review.frictions.map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h4>{item.title}</h4>
              <p><b>根因</b>{item.root}</p>
              <p><b>教训</b>{item.lesson}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="review-lessons">
        <div className="section-heading">
          <div><span className="section-kicker">LESSONS</span><h2>留下可以复用的判断</h2></div>
          <p>只写有来源的教训</p>
        </div>
        <div>
          {review.lessons.map((lesson, index) => (
            <article key={lesson.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{lesson.text}</h3>
              <p>{lesson.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="upgrade-section">
        <div className="section-heading">
          <div><span className="section-kicker">SELF-UPGRADE CANDIDATES</span><h2>升级之前，先展示证据。</h2></div>
          <p>LUMEN 不直接修改全局规则</p>
        </div>
        <div className="upgrade-list">
          {review.upgrades.length ? review.upgrades.map((upgrade) => (
            <article key={upgrade.id}>
              <span className="upgrade-target">{upgrade.target}</span>
              <div><h3>{upgrade.title}</h3><p>{upgrade.scope}</p></div>
              <div className="upgrade-proof"><strong>{upgrade.evidenceCount}</strong><span>条证据</span></div>
              <div className="upgrade-confidence"><strong>{Math.round(upgrade.confidence * 100)}%</strong><span>置信度</span></div>
              <em>{statusLabel[upgrade.status] || upgrade.status}</em>
            </article>
          )) : <EmptyState>本日无需升级。保持现有规则比制造新规则更重要。</EmptyState>}
        </div>
      </section>

      <section className="review-next">
        <div><span className="section-kicker">NEXT / MAX 3</span><h2>今天，只带走三件事。</h2></div>
        <ol>{review.nextPriorities.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
    </div>
  );
}

function DayFlow({ state, setState, onToast }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const view = ["today", "week", "month", "review"].includes(state.dayflowView) ? state.dayflowView : "today";
  const selected = state.captures.find((capture) => capture.id === state.selectedCaptureId)
    || state.captures.find((capture) => capture.status === "suggested")
    || state.captures[0];
  const brief = useMemo(() => deriveDailyBrief(state), [state]);
  const periodPreview = useMemo(
    () => ["week", "month"].includes(view) ? buildPeriodSummary(state, view === "week" ? 7 : 30) : null,
    [state, view]
  );
  const reviewPreview = useMemo(
    () => state.reviews.at(-1) || buildDailyReview(state, state.lastActiveDate, { live: true }),
    [state]
  );
  const captures = state.captures.slice(0, 7);
  const intro = view === "today"
    ? { eyebrow: `DAYFLOW / ${shortDate()}`, lead: "今天，不需要", accent: "从零想起。", scoreLabel: "今日节奏", score: brief.score, rhythm: brief.rhythm }
    : view === "week"
      ? { eyebrow: "DAYFLOW / WEEKLY REVIEW", lead: "这一周，节奏", accent: "开始显影。", scoreLabel: "周度稳定", score: periodPreview.stability, rhythm: periodPreview.momentum }
      : view === "month"
        ? { eyebrow: "DAYFLOW / MONTHLY REVIEW", lead: "把一个月，读成", accent: "一条曲线。", scoreLabel: "月度稳定", score: periodPreview.stability, rhythm: periodPreview.momentum }
        : { eyebrow: "DAYFLOW / SELF REVIEW", lead: "把昨天，变成", accent: "今天的判断。", scoreLabel: "复盘质量", score: reviewPreview.score, rhythm: `${reviewPreview.upgrades.length} 项升级候选` };

  const addCapture = (form) => {
    const capture = {
      id: `capture-manual-${Date.now().toString(36)}`,
      text: form.text.trim(),
      source: "手动 Capture",
      createdAt: `今天 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
      project: form.project.trim() || "未归类",
      people: "",
      urgency: form.urgency,
      energy: form.energy,
      deadline: "",
      notes: "",
      status: "suggested",
      suggestion: null
    };
    capture.suggestion = buildSuggestion(capture);
    setState((current) => ({ ...current, captures: [capture, ...current.captures], selectedCaptureId: capture.id, dayClosed: false }));
    onToast("已经理解这条 Capture，并生成了一个可编辑建议。", "light");
  };

  const confirm = (captureId, draft) => {
    const outcome = confirmCaptureSchedule(state, captureId, draft);
    setState(outcome.state);
    if (!outcome?.conflicts?.length) onToast("已放进今天。你随时可以把它标记完成。", "success");
    return outcome;
  };

  const toggleEvent = (eventId) => {
    setState((current) => ({
      ...current,
      timeline: current.timeline.map((event) => event.id === eventId ? { ...event, done: !event.done } : event),
      dayClosed: false
    }));
  };

  return (
    <main className="module-view dayflow-view" id="main-content">
      <section className="module-intro">
        <div>
          <span className="eyebrow">{intro.eyebrow}</span>
          <h1>{intro.lead}<br /><em>{intro.accent}</em></h1>
        </div>
        <div className="brief-score">
          <span>{intro.scoreLabel}</span>
          <strong>{intro.score}</strong>
          <p>{intro.rhythm}</p>
        </div>
      </section>

      <DayflowPeriodSwitch active={view} onChange={(dayflowView) => setState((current) => ({ ...current, dayflowView }))} />

      {view === "today" ? (
        <>
          <section className="day-grid">
            <div className="capture-column">
              <div className="section-heading capture-heading">
                <div><span className="section-kicker">INCOMING</span><h2>刚刚浮现</h2></div>
                <button className="text-button" type="button" onClick={() => setComposerOpen(true)}>＋ Capture</button>
              </div>
              <div className="capture-list">
                {captures.map((capture) => (
                  <button
                    type="button"
                    className={selected?.id === capture.id ? "capture-row is-selected" : "capture-row"}
                    key={capture.id}
                    onClick={() => setState((current) => ({ ...current, selectedCaptureId: capture.id }))}
                  >
                    <span className={`capture-dot is-${capture.status}`} aria-hidden="true" />
                    <span><strong>{capture.text}</strong><small>{capture.project} · {capture.source}</small></span>
                    <em>{statusLabel(capture.status)}</em>
                  </button>
                ))}
              </div>
              {composerOpen && <CaptureComposer onAdd={addCapture} onClose={() => setComposerOpen(false)} />}
            </div>
            <SuggestionPanel capture={selected} onConfirm={confirm} />
          </section>

          <Timeline events={state.timeline} onToggle={toggleEvent} />

          <section className="reflection-strip">
            <div><span className="section-kicker">LIVE DAILY SUMMARY / 实时更新</span><h2>{brief.headline}</h2></div>
            <div className="reflection-insights">{brief.insights.slice(0, 2).map((insight) => <p key={insight}>{insight}</p>)}</div>
            <button type="button" onClick={() => {
              setState((current) => ({ ...current, dayClosed: true, reflection: { ...current.reflection, savedAt: new Date().toISOString() } }));
              onToast("今天的节奏已经留在本地。", "success");
            }}>{state.dayClosed ? "今日已收束 ✓" : "收束今天"}</button>
          </section>
        </>
      ) : view === "review"
        ? <ReviewReport state={state} />
        : <PeriodReport state={state} range={view === "week" ? 7 : 30} />}
    </main>
  );
}

function IdeaComposer({ onAdd, onClose }) {
  const [form, setForm] = useState({ title: "", body: "", nextStep: "", project: "LUMEN" });
  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onAdd(form);
    onClose();
  };
  return (
    <form className="composer idea-composer" onSubmit={submit}>
      <div className="composer-head"><div><span>NEW REFRACTION</span><h3>收下一点还没成形的光。</h3></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <input className="large-input" autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="它可能会变成什么？" aria-label="灵感标题" />
      <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="把触发它的画面、问题或判断放在这里……" aria-label="灵感内容" />
      <input value={form.nextStep} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} placeholder="如果继续，最小下一步是什么？" aria-label="灵感下一步" />
      <button className="primary-button" type="submit">放进灵感库 <span>→</span></button>
    </form>
  );
}

function Refract({ state, setState, onPromote, onToast }) {
  const [stage, setStage] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const visible = stage === "all" ? state.ideas : state.ideas.filter((idea) => idea.stage === stage);
  const selected = state.ideas.find((idea) => idea.id === state.selectedIdeaId) || visible[0] || state.ideas[0];

  const selectIdea = (ideaId) => setState((current) => ({ ...current, selectedIdeaId: ideaId }));
  const updateIdea = (patch) => setState((current) => ({
    ...current,
    ideas: current.ideas.map((idea) => idea.id === selected.id ? { ...idea, ...patch, updatedAt: `今天 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}` } : idea)
  }));
  const addIdea = (form) => {
    const idea = createIdea(form);
    setState((current) => ({ ...current, ideas: [idea, ...current.ideas], selectedIdeaId: idea.id }));
    onToast("已收进灵感库。它还不需要立刻变成任务。", "light");
  };

  return (
    <main className="module-view refract-view" id="main-content">
      <section className="module-intro refract-intro">
        <div><span className="eyebrow">REFRACT / LOCAL IDEA LIBRARY</span><h1>先允许想法<br /><em>慢一点成形。</em></h1></div>
        <button className="new-idea-button" type="button" onClick={() => setComposerOpen(true)}><span>＋</span> 收下一点灵感</button>
      </section>

      <div className="stage-filter" aria-label="灵感阶段">
        <button type="button" className={stage === "all" ? "is-active" : ""} onClick={() => setStage("all")}>全部 <b>{state.ideas.length}</b></button>
        {STAGES.map((item) => <button type="button" key={item} className={stage === item ? "is-active" : ""} onClick={() => setStage(item)}>{stageLabel(item)} <b>{state.ideas.filter((idea) => idea.stage === item).length}</b></button>)}
      </div>

      <section className="idea-workspace">
        <div className="idea-list">
          {visible.length ? visible.map((idea, index) => (
            <button type="button" key={idea.id} className={selected?.id === idea.id ? "idea-row is-selected" : "idea-row"} onClick={() => selectIdea(idea.id)}>
              <span className="idea-index">{String(index + 1).padStart(2, "0")}</span>
              <span><small>{idea.project} / {stageLabel(idea.stage)}</small><strong>{idea.title}</strong><p>{idea.body || idea.nextStep || "等待更多上下文"}</p></span>
              <em>{idea.linkedCaptureId ? "已连接 ↗" : "打开 →"}</em>
            </button>
          )) : <EmptyState>这个阶段还没有灵感。</EmptyState>}
        </div>

        {selected && (
          <aside className="idea-detail">
            <div className="idea-detail-head"><span>{stageLabel(selected.stage)}</span><small>{selected.source} · {selected.updatedAt}</small></div>
            <h2>{selected.title}</h2>
            <p className="idea-body">{selected.body || "这个想法还没有补充说明。"}</p>
            {selected.sourceMeta && <p className="source-note">来自 {selected.sourceMeta.path}:{selected.sourceMeta.line}</p>}
            <label className="next-step-field"><span>如果它继续，最小下一步</span><textarea value={selected.nextStep} onChange={(event) => updateIdea({ nextStep: event.target.value })} /></label>
            <label className="stage-field"><span>成熟度</span><select value={selected.stage} onChange={(event) => updateIdea({ stage: event.target.value })}>{STAGES.map((item) => <option value={item} key={item}>{stageLabel(item)}</option>)}</select></label>
            <button
              className="promote-button"
              type="button"
              onClick={() => onPromote(selected.id)}
              disabled={Boolean(selected.linkedCaptureId)}
              data-testid="idea-promote"
            >
              <span>{selected.linkedCaptureId ? "已经送往今日流" : "送往今日流"}</span>
              <i aria-hidden="true">→</i>
            </button>
            <small className="promotion-note">只生成建议；真正占用时间前仍由你确认。</small>
          </aside>
        )}
      </section>
      {composerOpen && <div className="composer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposerOpen(false)}><IdeaComposer onAdd={addIdea} onClose={() => setComposerOpen(false)} /></div>}
    </main>
  );
}

function ContextDrawer({ open, snapshot, onClose, onRefresh }) {
  const signals = snapshot?.visibleSignals || [];
  const isDemo = snapshot?.mode === "demo";
  return (
    <>
      <div className={open ? "drawer-scrim is-open" : "drawer-scrim"} onClick={onClose} aria-hidden="true" />
      <aside className={open ? "context-drawer is-open" : "context-drawer"} aria-hidden={!open} aria-label="本地上下文">
        <div className="drawer-head">
          <div><span>{isDemo ? "DEMO CONTEXT" : "LOCAL CONTEXT"}</span><h2>只把重要的带进来。</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭上下文">×</button>
        </div>
        <p className="drawer-lede">{isDemo
          ? "当前是公开演示模式：这里只展示仓库内的脱敏样例，不读取这台电脑上的任何记忆或项目。"
          : "只读扫描 Codex、OpenClaw、共享记忆与本地项目文档。凭据、数据库、缓存、构建产物和低置信内容不会进入工作台。"}</p>
        <div className="scan-summary">
          <div><span>已展示</span><strong>{snapshot?.stats?.visibleSignals || 0}</strong></div>
          <div><span>已隐藏</span><strong>{snapshot?.stats?.hiddenSignals || 0}</strong></div>
          <div><span>候选文件</span><strong>{snapshot?.stats?.candidateFiles || 0}</strong></div>
        </div>
        <button className="refresh-button" type="button" onClick={onRefresh} disabled={snapshot?.status === "scanning"} data-testid="context-refresh">
          <span className={`status-light is-${snapshot?.status || "idle"}`} />
          {snapshot?.status === "scanning" ? "正在重新读取……" : isDemo ? "重新载入脱敏样例" : "重新读取本地上下文"}
        </button>
        <div className="signal-list">
          {signals.slice(0, 12).map((signal) => (
            <article key={signal.id} className="signal-row">
              <div><span>{signal.typeLabel} · {signal.module === "refract" ? "灵感库" : "今日流"}</span><b>{Math.round(signal.confidence * 100)}%</b></div>
              <h3>{signal.title}</h3>
              <p>{signal.source?.path}:{signal.source?.line}</p>
            </article>
          ))}
          {!signals.length && <EmptyState>{snapshot?.status === "scanning" ? "正在筛选值得浮现的内容……" : "还没有可展示的高置信内容。"}</EmptyState>}
        </div>
        <footer><span>{isDemo ? "PUBLIC DEMO" : "LOCAL ONLY"}</span><p>{isDemo ? "所有内容均为虚构示例，可安全用于截图、录屏和公开仓库说明。" : "索引只保存在这个项目的 runtime 目录；不会上传，也不会写回来源。"}</p></footer>
      </aside>
    </>
  );
}

function TransferOverlay({ transfer }) {
  return (
    <div className={transfer ? "transfer-overlay is-active" : "transfer-overlay"} aria-hidden={!transfer}>
      <div className="transfer-copy"><span>REFRACT</span><b>把下一步折进今天</b><span>DAYFLOW</span></div>
      <div className="light-path"><i /></div>
    </div>
  );
}

function Toast({ toast }) {
  return <div className={toast ? `toast is-visible is-${toast.tone}` : "toast"} role="status">{toast?.message}</div>;
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [snapshot, setSnapshot] = useState({ status: "idle", stats: {}, visibleSignals: [] });
  const [contextOpen, setContextOpen] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [toast, setToast] = useState(null);
  const importedSnapshot = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const showToast = (message, tone = "light") => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => {
        const result = ensureDailyRollover(current, new Date());
        if (result.rolledOver) {
          window.setTimeout(() => showToast("新的一天已经开始，昨天的节奏已自动归档。", "success"), 0);
        }
        return result.state;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const readContext = async (refresh = false) => {
    try {
      setSnapshot((current) => ({ ...current, status: "scanning" }));
      const demoQuery = DEMO_MODE ? "?demo=1" : "";
      const response = await fetch(`${refresh ? "/api/context/scan" : "/api/context"}${demoQuery}`, { method: refresh ? "POST" : "GET" });
      const result = await response.json();
      setSnapshot(result);
      if (result.status === "scanning") window.setTimeout(() => readContext(false), 1200);
      return result;
    } catch {
      setSnapshot((current) => ({ ...current, status: "offline" }));
      return null;
    }
  };

  useEffect(() => {
    void readContext(false);
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (snapshot.status !== "ready" || !snapshot.scannedAt || importedSnapshot.current === snapshot.scannedAt) return;
    importedSnapshot.current = snapshot.scannedAt;
    setState((current) => {
      const reconciled = reconcileContextSignals(current, snapshot.visibleSignals);
      const result = ingestContextSignals(reconciled, snapshot.visibleSignals);
      const total = result.addedCaptures.length + result.addedIdeas.length;
      if (total) window.setTimeout(() => showToast(`已自动整理 ${total} 条高置信本地信息。`, "light"), 0);
      return result.state;
    });
  }, [snapshot.scannedAt, snapshot.status]);

  const switchModule = (module) => setState((current) => ({ ...current, activeModule: module }));

  const promote = (ideaId) => {
    const result = promoteIdeaToCapture(state, ideaId);
    if (result.error) return;
    if (result.reused) {
      setState(result.state);
      showToast("这条灵感已经连接到今日流。", "light");
      return;
    }
    setTransfer({ ideaId, title: result.capture.text });
    window.setTimeout(() => {
      setState(result.state);
      setTransfer(null);
      showToast("下一步已成为建议，等你确认时间。", "success");
    }, 760);
  };

  return (
    <div className={`app-shell module-${state.activeModule}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => switchModule("dayflow")} aria-label="LUMEN 首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>LUMEN</strong><small>流明</small></span>
        </button>
        <ModuleSwitch active={state.activeModule} onChange={switchModule} />
        <ContextButton snapshot={snapshot} onClick={() => setContextOpen(true)} />
      </header>

      <div className="local-banner"><span>{snapshot.mode === "demo" ? "SANITIZED PUBLIC DEMO" : "LOCAL-FIRST WORKSPACE"}</span><p>{snapshot.mode === "demo" ? "脱敏示例用于公开展示，不读取真实本机内容。" : "从本地上下文到今天，只在你的电脑上流动。"}</p><b>{state.ingestedSignalIds.length} 已整理</b></div>

      {state.activeModule === "dayflow"
        ? <DayFlow state={state} setState={setState} onToast={showToast} />
        : <Refract state={state} setState={setState} onPromote={promote} onToast={showToast} />}

      <footer className="site-footer"><span>LUMEN / 流明</span><p>行动与灵感，共享一束本地上下文。</p><span>{snapshot.mode === "demo" ? "DEMO DATA · SAFE TO SHARE" : "READ ONLY · LOCAL ONLY"}</span></footer>
      <ContextDrawer open={contextOpen} snapshot={snapshot} onClose={() => setContextOpen(false)} onRefresh={() => readContext(true)} />
      <TransferOverlay transfer={transfer} />
      <Toast toast={toast} />
    </div>
  );
}
