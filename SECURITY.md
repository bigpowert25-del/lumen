# 隐私与公开发布

## 两种运行模式

- `npm run demo`：只返回 `server/demo-data.mjs` 中的虚构样例，不读取真实 Codex、OpenClaw、Obsidian 或项目文件；默认使用端口 `4312`。
- `npm run dev` / `npm start`：启用真实本地只读扫描，默认仅监听 `127.0.0.1`，索引写入已忽略的 `runtime/context-index.json`。

Demo 与本地模式使用不同的浏览器存储键，避免真实 Capture 或复盘混进公开截图。需要确定性演示时使用 `?demo=1&fresh=1`；公开复盘中的项目、对话信号和升级候选均为虚构样例。

## 公开前检查

执行：

```bash
npm run check
```

其中 `npm run public-safety` 会阻止常见个人主目录、邮箱、手机号、私钥材料和疑似密钥进入可发布文本文件。它是最后一道防线，不替代人工检查。

公开截图必须来自 Demo 模式。不要提交 `runtime/`、浏览器导出、本机扫描日志或带有真实来源路径的截图。

## 报告问题

如果发现隐私或安全问题，请在公开 Issue 中只描述复现方式，不粘贴真实凭据、个人文件内容或本地绝对路径。
