# Super-Agent 工单自动化编排演示

> 仓库名仍为 `ai-agent-demo`（GitHub 仓库链接不变）；`package.json` 的包名已改为 `super-agent-ticket-demo`。本项目是零依赖、零构建的多页面静态教学演示站。

**把一次真实工单（GitHub Issue #11）的执行过程拆成七个可观测层级，用 44 步标准轨迹、可逐步回放的时间线和逐字节可复现的快照，回答“谁在什么时候、为什么、做了什么、得到什么”。** 目标不是“功能跑通”，而是**可阅读、可追溯、可复盘**。

## 这个项目演示什么

- **首页**（`index.html`）：整体入口，串起七层轨迹、标准样例、回放能力与五个页面的学习路径。
- **架构页**（`pages/architecture.html`）：五阶段工作流、DSH Super-Agent 调用链路、工具与能力依赖关系，以及七层轨迹与架构节点的映射。
- **演示页**（`pages/demo.html`）：标准样例工单与标准轨迹摘要（层覆盖、44 步、异常分支、最终产出），并保留四类任务的简化模拟器作为**教学对照**（它不执行真实工具调用）。
- **轨迹页**（`pages/trace.html`）：七层图例、回放控制条与完整时间线；支持播放 / 暂停、上一步 / 下一步、重置、拖动 seek，以及 plan 子任务折叠。
- **规则页**（`pages/rules.html`）：四类任务的策略规则、接受条件与执行 / 交付产出。

完整使用说明见 **[docs/guide.md](docs/guide.md)**（整体架构 / 页面模块与字段语义 / 运行教程 / 扩展开发 / 调试方案）。

## 标准样例与关键数字

标准样例工单来自 GitHub Issue #11（`https://github.com/TravisWangchn/ai-agent-demo`，提交者 `TravisWangchn`，创建于 `2026-11-04T09:40:37.000Z`）。标准执行轨迹覆盖完整闭环：Issue 触发 → 规则评估 → plan 拆解 → 工具调用 → 页面与文档 → 快照与 CI → 提交分支 → 创建 PR → CI 校验 → 汇总。

| 指标 | 值 |
| --- | --- |
| 轨迹总步数 | **44 步**（`step-01` … `step-44`，`seq` 连续） |
| 七层覆盖 | `trigger` 1 · `plan` 1 · `tool_call` 18 · `tool_result` 18 · `reasoning` 3 · `branch` 2 · `summary` 1 |
| plan 子任务 | **7 个**（P1 确认基线 → P2 读取契约与现有实现 → P3 实现轨迹数据与回放模块 → P4 实现轨迹页面与样式 → P5 编写使用文档与 README → P6 生成标准快照并接入 CI → P7 提交分支、创建 PR 并校验 CI） |
| 分支 | **2 个**：`step-27` 异常分支（`snapshot-missing`，`step-26` → `step-28`）与 `step-34` 正常分支（`step-33` → `step-35`） |
| 时间跨度 | `2026-11-04T09:40:37.000Z` → `2026-11-04T09:47:20.000Z` |
| 测试 | `npm test` 运行 4 个测试文件、**36 个测试用例** |
| 标准快照 | `tests/snapshots/sample-ticket.json`、`tests/snapshots/sample-trace.json` |

标准轨迹第 26 步保留了一次真实的测试失败（缺少已提交快照），第 27 步的异常分支记录 `errorType` 与 `handling`，第 28～33 步补生成快照并重跑测试收敛。这条失败不是瑕疵，而是演示“异常如何被判定与处置”的教学材料。

## 页面

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `index.html` | 七层轨迹总览、标准样例入口、回放能力、项目结构与命令 |
| 架构 | `pages/architecture.html` | 五阶段工作流 + DSH 调用链路 + 工具依赖表 + 七层映射 |
| 演示 | `pages/demo.html` | 标准样例工单、标准轨迹摘要、四类任务的简化模拟器 |
| 轨迹 | `pages/trace.html` | 七层图例、回放控制条、执行时间线、字段导读 |
| 规则 | `pages/rules.html` | 策略规则表（由 `scripts/rules.js` 渲染） |

## 目录结构

```text
├── index.html
├── pages/
│   ├── architecture.html
│   ├── demo.html
│   ├── trace.html
│   └── rules.html
├── styles/
│   └── main.css              # 全站样式与 CSS 变量（含轨迹页组件样式）
├── scripts/
│   ├── main.js               # 全站导航交互
│   ├── demo.js               # 四类任务的简化模拟器（含可测试纯逻辑）
│   ├── rules.js              # 规则数据与规则表渲染
│   ├── trace-data.js         # 七层 schema、SAMPLE_TICKET、44 步 SAMPLE_TRACE、查询函数
│   ├── trace-playback.js     # 回放状态机（纯逻辑，不创建定时器）
│   ├── trace-render.js       # 轨迹 DOM 渲染（工单卡 / 图例 / 步骤 / 时间线 / 摘要）
│   ├── trace-page.js         # 轨迹页浏览器入口（绑定控制条、驱动自动播放）
│   ├── generate-snapshots.js # 从 SAMPLE_* 生成标准快照
│   └── serve.js              # 零依赖静态服务器（node:http + node:fs）
├── tests/
│   ├── demo.test.js
│   ├── rules.test.js
│   ├── trace.test.js
│   ├── snapshots.test.js
│   └── snapshots/
│       ├── sample-ticket.json
│       └── sample-trace.json
├── docs/
│   └── guide.md              # 完整使用说明（五个章节）
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

## 本地运行

需要 Node.js 20 或更高版本（`package.json` 的 `engines.node` 为 `>=20`，CI 使用 `lts/*`）。

```bash
npm run serve
```

`scripts/serve.js` 是用 `node:http` + `node:fs` 实现的零依赖静态服务器，默认监听 `http://127.0.0.1:8000/`，目录请求会返回该目录下的 `index.html`，并带有正确的 MIME 与路径穿越防护。

- 自定义端口：`PORT=9000 npm run serve`（Windows PowerShell 可用 `$env:PORT=9000; npm run serve`）。
- 启动后打开 <http://127.0.0.1:8000/>；对应页面路径为 `pages/architecture.html`、`pages/demo.html`、`pages/trace.html`、`pages/rules.html`。
- 页面脚本是原生 ES modules。现代浏览器会阻止 `file://` 加载模块，因此**完整交互必须通过静态服务器访问**；直接双击 `index.html` 只能看到 HTML 与样式。任何静态文件服务器（Python、Nginx、Caddy 等）也可以，项目不依赖特定服务器。

## 测试与快照

```bash
# 运行全部测试（node:test；4 个测试文件、36 个用例）
npm test

# 从 SAMPLE_TICKET / SAMPLE_TRACE 重新生成标准快照
npm run snapshots
```

`npm test` 覆盖数据契约与行为：七层顺序固定、44 步的 `seq` 连续且时间戳非递减、`plan` 子任务依赖合法且无环、`tool_call` 携带逐字参数、`tool_result` 携带退出码 / 耗时 / 原始输出、正常与异常分支字段完整、`summary` 含产出物与后续动作，以及 `TracePlayback` 的播放 / 暂停 / 重置 / seek 夹紧 / 订阅 / 边界行为。现有 `tests/demo.test.js` 与 `tests/rules.test.js` 也保持通过。

`npm test` 中的 `tests/snapshots.test.js` 会**先**把已提交快照与当前代码生成结果逐字节比较，通过后才调用 `writeSnapshots()` 落库；因此修改样例数据后必须显式运行 `npm run snapshots` 并提交差异，测试不会在比较失败时悄悄覆盖快照。

CI 配置在 `.github/workflows/ci.yml`（`push` / `pull_request`，`ubuntu-latest`）：

1. `Run unit tests` → `npm test`
2. `Generate demo snapshots` → `npm run snapshots`
3. `Verify snapshots are committed` → `git diff --exit-code -- tests/snapshots`

第 3 步失败即说明文档 / 数据与实现已经漂移，必须重新生成并提交快照。

## 七层轨迹与快照一致性机制

七层定义在 `scripts/trace-data.js` 的 `TRACE_LAYERS` 中，顺序固定：

`trigger`（工单原始输入）→ `plan`（任务拆解规划）→ `tool_call`（工具调用请求）→ `tool_result`（工具返回 Payload）→ `reasoning`（Agent 决策推理）→ `branch`（分支跳转）→ `summary`（最终汇总输出）。

每一步都是**结构化对象**，至少包含 `role`、`timestamp`、`input`、`output`、`reason` 五个字段；`plan` 步骤额外含 `plan.subtasks`，归属于某个子任务的步骤带 `planStepId` / `subtaskId`，`branch` 步骤带 `branch` 对象，`summary` 步骤带 `artifacts` / `nextActions`。来源分三类：`agent`（Agent 推理）、`tool`（工具执行）、`event`（外部事件）。

数据流是一致的单一来源：

1. `scripts/trace-data.js` 定义 `SAMPLE_TICKET` / `SAMPLE_TRACE`；
2. `scripts/trace-render.js` 与 `scripts/trace-page.js` 在浏览器渲染 / 回放同一份数据；
3. `scripts/generate-snapshots.js` 从同一份常量生成 `tests/snapshots/*.json`；
4. `tests/snapshots.test.js` 逐字节校验快照，CI 再用 `git diff` 确认快照已随提交落库。

因此任何对样例轨迹的改动都必须同步更新快照，否则 `npm test` 或 CI 会失败——这正是防止“文档与实现漂移”的机制。

## 技术约束

- 纯 HTML + CSS + 原生 JavaScript（ES modules），无框架、无打包工具、无运行时依赖，`npm test` 只依赖 Node 内置的 `node:test` 与 `node:assert`。
- 不改变原有目录结构与技术栈；新增文件均为静态页面、ES module 或 Node 内置模块脚本。
- 所有配色与间距集中在 `styles/main.css` 的 CSS 变量中；视觉上以不同左边框与来源徽标区分 `agent` / `tool` / `event`。
- 所有来自轨迹数据的文本通过 `textContent` 写入，JSON 用 `<pre><code>` 展示，不做 HTML 注入。
- 不使用内联 `onclick`；事件通过 `addEventListener` 绑定。
- 窄屏（< 768px）下导航折叠为可展开菜单，页面内容单列；交互元素有可见焦点样式与“跳到主要内容”链接。
- 测试不依赖网络、时区或当前时间；轨迹时间统一以 UTC 文本展示，便于截图复现。

## 许可证

[MIT](LICENSE)
