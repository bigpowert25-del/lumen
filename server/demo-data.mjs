export const DEMO_SNAPSHOT = {
  version: 1,
  mode: "demo",
  status: "ready",
  scannedAt: "2026-07-15T09:30:00.000Z",
  roots: ["samples/"],
  stats: {
    directoriesScanned: 4,
    candidateFiles: 12,
    ignoredFiles: 8,
    visibleSignals: 5,
    hiddenSignals: 7,
    truncated: false
  },
  visibleSignals: [
    {
      id: "demo-release-walkthrough",
      type: "task",
      typeLabel: "待办",
      module: "dayflow",
      title: "校对新版发布说明与完整演示流程",
      excerpt: "发布前走一遍从灵感到今日安排的闭环。",
      project: "LUMEN Demo",
      confidence: 0.94,
      nextAction: "生成今日排程建议",
      modifiedAt: "2026-07-15T08:20:00.000Z",
      source: { kind: "示例项目", path: "samples/project/ROADMAP.md", line: 12 }
    },
    {
      id: "demo-mobile-trend",
      type: "risk",
      typeLabel: "风险",
      module: "dayflow",
      title: "确认小屏趋势图仍能清楚读出日期与变化",
      excerpt: "移动端不应出现横向滚动或重叠刻度。",
      project: "LUMEN Demo",
      confidence: 0.9,
      nextAction: "检查影响并决定下一步",
      modifiedAt: "2026-07-15T08:10:00.000Z",
      source: { kind: "示例项目", path: "samples/project/QA.md", line: 7 }
    },
    {
      id: "demo-editorial-report",
      type: "decision",
      typeLabel: "决定",
      module: "refract",
      title: "周月回顾保持个人编辑报告感，不做企业仪表盘",
      excerpt: "使用连续曲线、对比数字与少量解释性文字。",
      project: "LUMEN Demo",
      confidence: 0.96,
      nextAction: "保留为稳定项目上下文",
      modifiedAt: "2026-07-15T07:55:00.000Z",
      source: { kind: "示例记忆", path: "samples/memory/DECISIONS.md", line: 5 }
    },
    {
      id: "demo-human-summary",
      type: "idea",
      typeLabel: "灵感",
      module: "refract",
      title: "把跨周期变化写成一句真正读得懂的话",
      excerpt: "数字负责证据，文字负责把变化说清楚。",
      project: "LUMEN Demo",
      confidence: 0.88,
      nextAction: "送入灵感库继续孵化",
      modifiedAt: "2026-07-15T07:40:00.000Z",
      source: { kind: "示例记忆", path: "samples/memory/IDEAS.md", line: 9 }
    },
    {
      id: "demo-public-safety",
      type: "status",
      typeLabel: "状态",
      module: "dayflow",
      title: "公开演示只使用脱敏样例，不读取真实本地记忆",
      excerpt: "Demo 模式和本地模式使用独立浏览器状态。",
      project: "LUMEN Demo",
      confidence: 0.98,
      nextAction: "同步项目状态与下一步",
      modifiedAt: "2026-07-15T07:30:00.000Z",
      source: { kind: "示例项目", path: "samples/PRIVACY.md", line: 3 }
    }
  ]
};
