# Super-Agent 工单自动化编排演示 · 使用说明

本文档对应仓库 `ai-agent-demo`（`package.json` 包名为 `super-agent-ticket-demo`），是一份零依赖、零构建的多页面静态教学演示站。全文分五个部分：

1. 项目整体架构
2. 页面模块说明
3. 运行演示教程
4. 扩展开发指南
5. 调试方案

文档中的文件名、命令、快照路径与数字均与当前实现一致。若后续修改样例数据，请同步更新本文档与标准快照。

---

## 一、项目整体架构

### 1.1 从工单到交付：DSH Super-Agent 调用链路

标准样例工单是 GitHub Issue #11（`https://github.com/TravisWangchn/ai-agent-demo/issues/11`）。它在 DSH Super-Agent 中经历以下调用链路：

```text
外部事件（GitHub Issue opened）
        │
        ▼
触发：记录来源、编号、提交者、时间戳与正文
        │
        ▼
orchestrator 评估：读取最小上下文 → 匹配策略规则 → 逐项检查接受条件
        │
        ├── 未满足条件 → 要求补充规格，不进入执行
        ▼
plan 拆解：把工单拆成带依赖顺序与所属工具的子任务（P1 … P7）
        │
        ▼
worker 工具调用：git / filesystem / shell / node:test / github
        │        ├── tool_call：逐字记录下发的命令与参数
        │        └── tool_result：记录退出码、耗时与原始输出
        ▼
分支与异常处置：成功则正常推进；失败则记录异常类型与处理方式
        │
        ▼
summary 汇总：整体结论、产出物清单、后续动作 → PR 与 CI 校验
```

对应到五个职责阶段：触发 → 评估 → 决策 → 执行 → 交付。轨迹中的 `reasoning` 对应评估与决策，`branch` 对应决策到执行的跳转，`plan` / `tool_call` / `tool_result` 对应执行，`summary` 对应交付。

### 1.2 模块与文件职责

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `scripts/trace-data.js` | 七层定义 `TRACE_LAYERS`、标准工单 `SAMPLE_TICKET`、44 步标准轨迹 `SAMPLE_TRACE`，以及 `getTraceLayer()` / `getTraceStep()` 查询函数 | 无（纯数据，浏览器与 Node 均可导入） |
| `scripts/trace-playback.js` | 回放状态机 `TracePlayback`：游标、播放态、前进/后退/重置/seek、订阅与快照 | 无 DOM、无定时器 |
| `scripts/trace-render.js` | 轨迹 DOM 渲染：工单卡、七层图例、单步卡片、时间线、标准轨迹摘要 | `trace-data.js`（只读数据） |
| `scripts/trace-page.js` | 轨迹页浏览器入口：初始化渲染、绑定回放控制条、用 `setInterval` 驱动自动播放、暴露 `destroy()` | `trace-data.js` / `trace-playback.js` / `trace-render.js` |
| `scripts/generate-snapshots.js` | 从 `SAMPLE_TICKET` / `SAMPLE_TRACE` 生成 `tests/snapshots/` 下的 JSON 快照 | `trace-data.js`、`node:fs` |
| `scripts/serve.js` | 零依赖静态服务器（`node:http` + `node:fs`），默认端口 8000，支持 `PORT` 环境变量 | Node 内置模块 |
| `scripts/demo.js` | 四类任务的简化模拟器（教学对照），含可测试纯逻辑 `TASKS` / `simulateTask()` | `rules.js` |
| `scripts/rules.js` | 策略规则数据 `TASK_TYPES` / `RULES` 与规则表渲染 | 无（除渲染外） |
| `scripts/main.js` | 全站导航折叠与初始化 | 无 |
| `pages/trace.html` | 轨迹页静态骨架：工单卡、七层图例、回放控制条、时间线容器与字段导读 | `trace-page.js` |
| `pages/demo.html` | 标准样例工单页：工单卡、轨迹摘要、教学对照模拟器 | `demo.js` + 内联 module（复用 `trace-render.js`） |
| `pages/architecture.html` | 五阶段工作流、调用链路、工具依赖表、七层映射 | 纯静态 |
| `pages/rules.html` | 策略规则表容器 `[data-rules-table]` | `rules.js` |
| `tests/trace.test.js` | 数据契约 + `TracePlayback` 行为测试 | `node:test` |
| `tests/snapshots.test.js` | 快照逐字节一致性与落库测试 | `node:test`、`generate-snapshots.js` |

### 1.3 插件与工具依赖关系

样例轨迹只使用真实存在的工具形态，不虚构插件名或 API：

| 工具 / 能力 | 真实形态 | 承接的架构节点 | 典型轨迹层 |
| --- | --- | --- | --- |
| `github` | `gh` CLI：读取 Issue、创建 PR、查询 PR checks | 触发、交付 | `trigger` / `summary` |
| `filesystem` | `read` / `write` / `edit` 文件工具 | 评估、执行、文档 | `tool_call` / `tool_result` |
| `shell` | `pwsh` / 命令行：`npm test`、`npm run snapshots`、`node scripts/…` | 执行、验证 | `tool_call` / `tool_result` |
| `node:test` | Node 内置测试运行器（`node --test`） | 自检与验收 | `tool_result` |
| `git` | `git` CLI：`fetch` / `checkout` / `commit` / `push` | 基线确认、分支与提交 | `tool_call` / `tool_result` |
| `orchestrator` | DSH Super-Agent 编排器 | 评估、拆解、分支、汇总 | `reasoning` / `plan` / `branch` / `summary` |
| `worker` | 执行子任务的 Agent 角色 | 实现与自检 | `reasoning` |

标准轨迹中的工具调用步骤共 18 条 `tool_call` 与 18 条 `tool_result`，覆盖 `git`（6 步）、`filesystem`（20 步）、`shell`（4 步）、`node-test`（2 步）、`github`（5 步）等角色；具体命令与返回原文见 `scripts/trace-data.js` 的 `SAMPLE_TRACE.steps`。

### 1.4 数据流与一致性

单一数据源，避免文档、页面与测试各写一份：

```text
scripts/trace-data.js
   ├── SAMPLE_TICKET / SAMPLE_TRACE
   │       ├── scripts/trace-render.js ──► pages/trace.html / pages/demo.html（浏览器渲染）
   │       ├── scripts/trace-playback.js ◄─ scripts/trace-page.js（回放状态）
   │       └── scripts/generate-snapshots.js ──► tests/snapshots/*.json
   └── TRACE_LAYERS ──► 七层图例 / 渲染 source / 测试断言

tests/trace.test.js       校验数据契约与回放行为
tests/snapshots.test.js   比较快照 → 通过后落库
.github/workflows/ci.yml  单测 → 生成快照 → git diff 校验
```

任何对 `SAMPLE_TICKET` / `SAMPLE_TRACE` 的改动都会影响快照；必须运行 `npm run snapshots` 重新生成并提交差异，否则 `npm test` 与 CI 会失败。

### 1.5 项目目录

```text
ai-agent-demo/
├── index.html
├── pages/{architecture,demo,trace,rules}.html
├── styles/main.css
├── scripts/{main,demo,rules,trace-data,trace-playback,trace-render,trace-page,generate-snapshots,serve}.js
├── tests/{demo,rules,trace,snapshots}.test.js
├── tests/snapshots/{sample-ticket,sample-trace}.json
├── docs/guide.md
├── .github/workflows/ci.yml
├── package.json
└── README.md
```

---

## 二、页面模块说明

### 2.1 五个页面

| 页面 | 路径 | 入口脚本 | 主要 `data-*` 钩子 | 作用 |
| --- | --- | --- | --- | --- |
| 首页 | `index.html` | `scripts/main.js` | `data-nav-toggle` | 总览七层轨迹、标准样例、回放能力、项目结构与命令 |
| 架构 | `pages/architecture.html` | `scripts/main.js` | 无 | 五阶段 + DSH 调用链路 + 工具依赖 + 七层映射 |
| 演示 | `pages/demo.html` | `scripts/demo.js` + 内联 module | `data-demo-page`、`data-demo-ticket`、`data-demo-summary`、`data-demo`、`data-task-id`、`data-sim-status`、`data-sim-empty`、`data-sim-output`、`data-sim-announcer` | 标准样例工单、标准轨迹摘要、四类任务简化模拟器 |
| 轨迹 | `pages/trace.html` | `scripts/trace-page.js`（另加载 `scripts/main.js`） | `data-trace-page`、`data-trace-ticket`、`data-trace-legend`、`data-trace-controls`、`data-playback-play`、`data-playback-prev`、`data-playback-next`、`data-playback-reset`、`data-playback-count`、`data-playback-range`、`data-playback-progress`、`data-playback-announcer`、`data-trace-timeline` | 七层图例、回放控制条、执行时间线、字段导读 |
| 规则 | `pages/rules.html` | `scripts/rules.js`（另加载 `scripts/main.js`） | `data-rules-table` | 四类任务的策略规则表 |

五页的 header、导航（首页 / 架构 / 演示 / 轨迹 / 规则）与 footer 完全一致；`pages/trace.html` 的 `<script type="module" src="../scripts/trace-page.js">` 负责动态区域。

轨迹渲染出的每一步 DOM 都带稳定属性：`data-step-id`、`data-layer`、`data-source`（`agent` / `tool` / `event` / `unknown`）、`data-seq`，便于测试、截图断言与样式区分。

### 2.2 日志字段语义

每一步都是一个结构化对象（不是拼接字符串），由五个必备字段与若干层专属字段组成：

#### `role` · 角色

谁在执行或决策。标准轨迹中允许的取值（见 `tests/trace.test.js` 的 `ALLOWED_ROLES`）：

`orchestrator`（编排、拆解、分支、汇总）、`worker`（执行实现与自检）、`github`（gh CLI）、`shell`（命令执行）、`filesystem`（读写文件）、`node-test`（测试运行器）、`git`（版本操作）。

页面通过 `scripts/trace-render.js` 的 `ROLE_LABELS` 显示中文标签（如 `orchestrator · 编排器`、`github · GitHub (gh CLI)`），未收录的 role 直接显示原始值。

#### `timestamp` · 时间戳

这一步实际发生的时刻。数据中为 ISO 8601 字符串（如 `2026-11-04T09:41:01.000Z`），页面统一格式化为固定的 UTC 文本（`YYYY-MM-DD HH:mm:ss UTC`），避免本地时区导致截图与复盘不一致。测试要求所有时间戳落在 `startedAt` 与 `endedAt` 之间，且按 `seq` 非递减；最后一步时间戳等于 `endedAt`。

#### `input` · 输入

这一步接收的结构化输入，必须是对象。按层约定：

- `trigger`：`repository`、`event`、`action`；
- `reasoning`：判断依据与命中项，如 `ticketId`、`matchedRule`、`requirementChecks`、`checks`、`failedStep` / `exitCode`；
- `plan`：`ticketId`、`matchedRule`、`constraints`；
- `tool_call`：必须包含 `tool`，以及逐字下发参数 `command`（含 `cwd`）、`path` 或 `paths`、`action` 等；
- `tool_result`：通常为 `call`（对应 `tool_call` 的 step id）与 `tool`，测试步骤另带 `command`；
- `branch`：触发跳转的依据，如 `failedStep`、`exitCode`、`failedLayer`；
- `summary`：`traceId`、`ticketId`、`stepCount`、`prNumber`。

#### `output` · 输出

这一步产出的结构化结果，必须是对象。按层约定：

- `tool_call`：`dispatched: true`（表示指令已下发）；
- `tool_result`：`exitCode`、`durationMs`、`stdout` / `stderr` / `payload` 原始摘录，可带 `summary`、`files`、`commit`、`prNumber`、`prUrl`、`truncated`；
- `plan`：`goal`、`subtaskCount`（必须等于 `plan.subtasks.length`）；
- `reasoning`：`decision`、`ruleName`、`missing`、`nextAction`、`decisions`、`verdict`、`risks` 等判定结论；
- `branch`：`nextStep`、`handling` / `verdict`；
- `summary`：`status`、`tests`、`snapshots`、`exceptionHandled`、`prUrl`、`checks`。

`input` / `output` 在页面上用 `<pre><code>` 以缩进 JSON 展示（`formatStepValue`），不做 HTML 注入。

#### `reason` · 决策理由

为什么做这一步：命中了哪条规则、依据哪些证据、为什么走这条分支。它是消除“黑盒感”的关键字段，任何一步都必须能回答“为什么”，测试要求非空。

#### 层专属字段

- `plan` 步骤额外有 `plan.subtasks`：每个子任务含 `id`（如 `P1`）、`title`、`dependsOn`（依赖的子任务 id 数组，必须存在且不成环）、`tool`（所属工具）、`status`（`done` / `running` / `pending` / `blocked` / `failed`）。
- 归属于某个子任务的后续步骤带 `planStepId`（指向 plan 步骤 id，如 `step-03`）与 `subtaskId`（如 `P4`），页面据此把步骤挂到对应子任务的折叠区。
- `branch` 步骤带 `branch: { kind, from, to, errorType?, handling? }`：`kind` 为 `"normal"` 或 `"exception"`；`from` / `to` 必须是真实存在的 step id 且不同；异常分支必须有 `errorType` 与 `handling`。
- `summary` 步骤带 `artifacts`（产出物路径或 PR 地址）与 `nextActions`（后续动作）。

### 2.3 七层轨迹

| # | 层级 `id` | 中文名 | `source` | 语义 | 标准轨迹步数 |
| --- | --- | --- | --- | --- | --- |
| 1 | `trigger` | 工单原始输入 | `event` | Issue 来源、编号、提交者、时间戳与正文，整条轨迹的起点 | 1 |
| 2 | `plan` | 任务拆解规划 | `agent` | orchestrator 拆出带依赖与工具的 7 个子任务 | 1 |
| 3 | `tool_call` | 工具调用请求 | `tool` | 逐字记录下发的命令、cwd、文件路径等参数 | 18 |
| 4 | `tool_result` | 工具返回 Payload | `tool` | 退出码、耗时与 stdout / stderr 原始摘录（失败结果同样保留） | 18 |
| 5 | `reasoning` | Agent 决策推理 | `agent` | 判定结论、依据说明与规则命中项 | 3 |
| 6 | `branch` | 分支跳转 | `agent` | 正常推进或异常处置的 `from` / `to`、异常类型与处理方式 | 2 |
| 7 | `summary` | 最终汇总输出 | `agent` | 整体结论、产出物清单、后续动作 | 1 |
| | **合计** | | | | **44** |

七层顺序固定（`TRACE_LAYERS`，测试断言不可变），页面图例与快照测试都依赖它。标准轨迹的异常分支是 `step-27`（`branch.kind = "exception"`，`errorType = "snapshot-missing"`，`from: "step-26"`，`to: "step-28"`）；正常分支是 `step-34`（`from: "step-33"`，`to: "step-35"`）。

### 2.4 三种 `source` 来源

`source` 表示一条日志由谁产生，用于视觉与语义区分：

- `agent`：Agent 自身推理产出（`plan` / `reasoning` / `branch` / `summary`），页面以蓝色系徽标标识；
- `tool`：工具执行与返回（`tool_call` / `tool_result`），页面以青绿色系徽标标识；
- `event`：外部事件输入（`trigger`），页面以紫色系徽标标识。

页面对每一步同时显示**层级徽标**、**来源徽标**与**角色徽标**，左侧边框颜色也按 `data-source` 区分，因此“Agent 推理”与“工具执行”在视觉上一眼可分。

### 2.5 回放语义

`scripts/trace-playback.js` 的 `TracePlayback` 是与 DOM 解耦的纯状态机：

- `cursor` 表示“已展示步数”，范围 `1..total`（空轨迹为 `0`）；
- `playing` 只由 `play()` / `pause()` / `toggle()` / `reset()` 改变，不隐含自动暂停；
- `next()` / `prev()` 在边界保持不动；`reset()` 回到第 1 步并停止播放；
- `seek(n)` 自动夹紧到合法范围，非法输入（`NaN`、`Infinity`、`null`、字符串、对象等）返回 `false` 且不改变状态；
- `getSnapshot()` 返回 `{ cursor, total, playing, progress, atStart, atEnd }`，`progress` 为 `0..1`；
- 只有状态真正变化时才通知订阅者。

页面层（`scripts/trace-page.js`）用 `setInterval`（1200ms）驱动自动播放，到末尾自动暂停；每次状态变化只重新渲染 `visibleCount` 之前的步骤。`<details>` 的折叠状态保存在页面内存 `Set` 中（key 形如 `step-03:P4`），重新渲染后仍保持用户选择。

---

## 三、运行演示教程

### 3.1 环境与启动

需要 Node.js 20 或更高版本（`package.json` 的 `engines.node` 为 `>=20`）。项目零依赖，无需 `npm install`。

```bash
# 在仓库根目录启动零依赖静态服务器
npm run serve
```

默认地址为 <http://127.0.0.1:8000/>。自定义端口：

```bash
# macOS / Linux
PORT=9000 npm run serve

# Windows PowerShell
$env:PORT=9000; npm run serve
```

`scripts/serve.js` 支持 `GET` / `HEAD`、正确 MIME（html / js / css / json / svg / png 等）、目录请求回退到 `index.html`，并拒绝路径穿越。注意：页面使用原生 ES modules，**必须通过静态服务器访问**；直接双击 HTML 会因 `file://` 的模块限制而无法执行脚本。

### 3.2 打开五个页面

| 页面 | URL |
| --- | --- |
| 首页 | <http://127.0.0.1:8000/> |
| 架构 | <http://127.0.0.1:8000/pages/architecture.html> |
| 演示 | <http://127.0.0.1:8000/pages/demo.html> |
| 轨迹 | <http://127.0.0.1:8000/pages/trace.html> |
| 规则 | <http://127.0.0.1:8000/pages/rules.html> |

建议阅读顺序：首页（总览）→ 架构（机制）→ 演示（标准案例）→ 轨迹（逐步回放）→ 规则（判定依据）。也可以直接打开轨迹页开始复盘。

### 3.3 如何看一条轨迹

轨迹页从上到下依次是：工单卡（`SAMPLE_TICKET`）→ 七层图例 → 回放控制条 → 执行时间线 → 字段导读。需要强调：页面读取的是 `scripts/trace-data.js` 中的**静态标准样例**，浏览、播放或 seek 都不会触发真实的 `git` / `gh` / `shell` 调用；样例轨迹记录的是标准工单闭环的真实命令与返回形态，用于教学复盘。

时间线中每一步包含：

1. 序号 `#01` … `#44`；
2. 层级徽标（如 `tool_call · 工具调用请求`）；
3. 来源徽标（Agent 推理 / 工具执行 / 外部事件）；
4. 角色徽标（如 `orchestrator · 编排器`）；
5. UTC 时间戳；
6. `reason · 决策理由`；
7. `input` / `output` 两个 JSON 面板；
8. 若该步是 `branch`，额外显示分支详情（`kind`、`from` → `to`、`errorType`、`handling`）；
9. 若该步是 `summary`，额外显示 `artifacts` 与 `nextActions`；
10. 若该步是 `plan`，显示 7 个可折叠子任务；展开后可见挂在各自子任务下的 `tool_call` / `tool_result`。

建议的阅读方法：先看 `reason` 理解动机，再用 `input` / `output` 核对证据，最后检查 `branch` 解释跳转。异常步骤 `step-26`（测试失败）与 `step-27`（异常分支）就是最好的练习点。

### 3.4 回放操作

- **播放 / 暂停**：点击“播放”后每 1.2 秒推进一步；到达第 44 步自动暂停。若已在末尾再点“播放”，会先回到第 1 步再开始。
- **上一步 / 下一步**：逐条前进或回退，边界处按钮禁用；计数显示 `当前步 / 44`。
- **重置**：回到第 1 步并停止播放。
- **seek**：拖动滑杆（范围 1–44）立即定位到目标步；页面只展示该步及之前的轨迹。
- **折叠 / 展开子任务**：plan 步骤内的每个 `<details>` 可单独展开；折叠选择在重渲染后保持。
- 键盘用户可聚焦按钮或滑杆后用方向键操作。

### 3.5 复现标准案例

```bash
# 1. 运行全部测试：4 个测试文件、36 个用例
npm test

# 2. 从样例常量重新生成两份标准快照
npm run snapshots
# 预期输出：
#   generated tests/snapshots/sample-ticket.json
#   generated tests/snapshots/sample-trace.json

# 3. 确认快照已随提交落库（无差异时命令退出码为 0）
git diff --exit-code -- tests/snapshots

# 4. 启动站点并打开轨迹页，确认 44 步与 7 层
npm run serve
```

快速核对标准数据的数字：

```bash
node -e 'import("./scripts/trace-data.js").then(({ SAMPLE_TRACE, TRACE_LAYERS }) => { const steps = SAMPLE_TRACE.steps; const count = (layer) => steps.filter((s) => s.layer === layer).length; console.log("steps:", steps.length); console.log("layers:", TRACE_LAYERS.map((l) => l.id + "=" + count(l.id)).join(", ")); const plan = steps.find((s) => s.layer === "plan"); console.log("subtasks:", plan.plan.subtasks.length); console.log("branches:", steps.filter((s) => s.layer === "branch").map((s) => s.id + ":" + s.branch.kind).join(", ")); })'
```

预期输出：`steps: 44`，七层 `trigger=1, plan=1, tool_call=18, tool_result=18, reasoning=3, branch=2, summary=1`，`subtasks: 7`，`branches: step-27:exception, step-34:normal`。

### 3.6 确认静态资源可访问

五个页面与关键静态资源都应返回 200。可以使用任意 HTTP 客户端，例如：

```bash
curl -s -o /dev/null -w "%{http_code} /\n" http://127.0.0.1:8000/
curl -s -o /dev/null -w "%{http_code} /pages/architecture.html\n" http://127.0.0.1:8000/pages/architecture.html
curl -s -o /dev/null -w "%{http_code} /pages/demo.html\n" http://127.0.0.1:8000/pages/demo.html
curl -s -o /dev/null -w "%{http_code} /pages/trace.html\n" http://127.0.0.1:8000/pages/trace.html
curl -s -o /dev/null -w "%{http_code} /pages/rules.html\n" http://127.0.0.1:8000/pages/rules.html
```

---

## 四、扩展开发指南

修改后请始终执行：`npm run snapshots` → `npm test` → `git diff --exit-code -- tests/snapshots`。以下行号以当前实现为准，结构变化时以常量 / 函数名为准。

### 4.1 新增工单类型

涉及两个数据文件与现有测试：

1. `scripts/rules.js`（约第 9–14 行）的 `TASK_TYPES`：新增 `typeKey: "中文名称"`。
2. `scripts/rules.js`（约第 22–80 行）的 `RULES`：新增规则对象，字段为 `id`、`name`、`appliesTo`（等于新 typeKey）、`scenario`、`example`、`requirements[]`（每项含 `id` / `label`）、`execution`、`delivery`。
3. `scripts/demo.js`（约第 16–63 行）的 `TASKS`：新增任务对象，字段为 `id`、`type`、`label`、`request`、`facts`；`facts` 的键必须与规则 `requirements[].id` 一一对应，缺项即“不接受”。
4. `pages/demo.html`（约第 91–108 行）的 `.task-grid`：新增按钮，带 `data-task-id="新 id"`，供 `initDemo()` 绑定。

测试会自动检查一致关系，无需改断言：`tests/rules.test.js` 要求 `RULES` 覆盖全部 `TASK_TYPES`；`tests/demo.test.js` 要求 `TASKS.length === Object.keys(TASK_TYPES).length`、任务 id 唯一且都能匹配到规则。新增后运行 `npm test` 即可验证。

若希望新工单类型也出现在标准轨迹中，需要按 4.2 / 4.3 修改 `scripts/trace-data.js`，并重新生成快照。

### 4.2 新增轨迹步骤 / 工具节点

文件：`scripts/trace-data.js`。

- **新增步骤**：向 `SAMPLE_TRACE.steps`（约第 118–1058 行）追加对象，字段必须包含：
  - `id`：形如 `step-45`（两位数字，唯一）；
  - `seq`：紧接上一步递增，且数组顺序一致；
  - `layer`：7 个 id 之一；
  - `role`：必须属于 `tests/trace.test.js` 的 `ALLOWED_ROLES`（`orchestrator`、`worker`、`github`、`shell`、`filesystem`、`node-test`、`git`）；
  - `timestamp`：ISO 字符串，落在 `startedAt` … `endedAt` 内且不早于前一步；
  - `reason`：非空决策理由；
  - `input` / `output`：非空对象。
- **新增工具调用**：`layer: "tool_call"` 的 `input` 必须含 `tool`，以及 `command`（可带 `cwd`）、`path` 或 `paths` 之一；`output` 必须为 `{ dispatched: true }`。对应的 `layer: "tool_result"` 必须含 `exitCode`（number）、`durationMs`（number）与 `stdout` / `stderr` / `payload` 之一。
- **归属 plan 子任务**：若该步骤属于某个子任务，添加 `planStepId`（plan 步骤 id，如 `step-03`）与 `subtaskId`（如 `P4`）；测试会校验二者指向真实存在的 plan 子任务。
- **新增层级（不推荐）**：七层是设计契约，`TRACE_LAYERS`（约第 25–75 行）顺序与数量被 `tests/trace.test.js` 的 `EXPECTED_LAYER_IDS` 固定。如确需新增，必须同步修改测试、`DESIGN.md` 契约、页面图例自动渲染与本文档，并重新生成快照。

修改后更新 `SAMPLE_TRACE.endedAt`（若时间跨度变化）与最后一步时间戳，再执行 `npm run snapshots`。

### 4.3 新增 / 修改 plan 子任务

文件：`scripts/trace-data.js` 的 plan 步骤（`step-03`，约第 163–232 行）。

- `plan.subtasks` 数组项字段：`id`（如 `P1`）、`title`、`dependsOn`（数组，只能引用同数组内的 id，不能自引用或成环）、`tool`（必须在 `ALLOWED_PLAN_TOOLS` 内：`orchestrator` / `github` / `shell` / `filesystem` / `node:test` / `git`）、`status`。
- 同步修改 `output.subtaskCount`，必须等于 `subtasks.length`（当前为 7）。
- **每个子任务都必须有挂载步骤**：测试要求 `SAMPLE_TRACE.steps` 中存在 `planStepId === "step-03"` 且 `subtaskId === 该子任务 id` 的步骤，否则折叠视图会出现空分组并导致测试失败。
- 若新增子任务，需按 4.2 增加归属步骤；若调整依赖顺序，确保依赖图无环。

### 4.4 新增分支规则

分支不是独立配置表，而是轨迹中的 `branch` 层步骤：

- 在 `scripts/trace-data.js` 的 `SAMPLE_TRACE.steps` 中新增 `layer: "branch"` 的步骤，并带 `branch` 对象：
  ```js
  branch: {
    kind: "normal" | "exception",
    from: "step-xx",       // 来源步骤 id，必须存在
    to: "step-yy",         // 目标步骤 id，必须存在且不同于 from
    errorType: "...",      // kind === "exception" 时必填
    handling: "...",       // kind === "exception" 时必填
  }
  ```
- 测试位置：`tests/trace.test.js` 的「branch 步骤包含正常分支与异常分支，并指向真实节点」（约第 376–411 行）。标准轨迹必须**同时**包含至少一个 `normal` 与一个 `exception`；`from` / `to` 必须指向真实步骤且不同；异常分支必须有非空 `errorType` / `handling`。
- 若调整异常路径，需同步确认后续步骤的引用关系与 `summary.exceptionHandled` / `nextActions` 的叙事一致。

### 4.5 扩展回放状态机

文件：`scripts/trace-playback.js`。

- `TracePlayback` 只做状态迁移，**不得**引入 `setInterval` / `setTimeout`（`tests/trace.test.js` 会扫描可执行代码）。
- 新增行为时保持不变量：`cursor` 夹紧在 `1..total`、`reset()` 后 `playing === false`、非法 `seek` 返回 `false` 且不改状态、仅在状态变化时通知订阅者。
- 对应测试：`tests/trace.test.js` 中 `TracePlayback` 相关用例（约第 446–698 行）。
- 浏览器驱动在 `scripts/trace-page.js`：`PLAYBACK_INTERVAL_MS = 1200`（约第 23 行），`startTimer()` 中创建 `setInterval` 并在末尾暂停；若改间隔，只改这里。

### 4.6 扩展渲染、页面与样式

- **渲染函数**：`scripts/trace-render.js`
  - `ROLE_LABELS`（约第 15–26 行）新增 role 中文标签；
  - `SOURCE_LABELS`（约第 29–34 行）新增来源标签（一般只有 `agent` / `tool` / `event` / `unknown`）；
  - `formatTimestamp()` 固定 UTC 文本；`formatStepValue()` 输出缩进 JSON；
  - `renderStepCard()`（约第 432 行）单步卡片；`renderTicketCard()`（约第 497 行）工单卡；`renderLayerLegend()`（约第 601 行）七层图例；`renderTraceTimeline()`（约第 659 行）时间线；`renderTraceSummary()`（约第 740 行）标准摘要。
  - 新增渲染字段时，务必使用 `textContent` / `createElement`，不要把数据拼进 `innerHTML`。
- **页面**：新增页面时复制现有页面的 header / nav / footer 结构，保持五页导航一致；页面 `<title>` 命名为「页面名 · Super-Agent 工单自动化编排演示」；同时更新全部 5 个页面的导航与 `README.md` / 本文档的页面表。
- **样式**：`styles/main.css` 使用 CSS 变量（颜色、间距、字号、圆角）；轨迹组件样式追加在文件末尾（约第 1297 行之后），`agent` / `tool` / `event` 分别使用 `--color-agent*`、`--color-tool*`、`--color-event*` 变量。
- **交互**：事件统一用 `addEventListener`，不要内联 `onclick`；窄屏导航复用 `scripts/main.js`。

### 4.7 修改后的验收清单

```bash
npm run snapshots
npm test
git diff --exit-code -- tests/snapshots
npm run serve
```

然后打开五个页面，确认：轨迹页可播放 / 暂停 / 重置 / seek，plan 子任务可折叠，`step-27` 异常分支与 `step-44` 汇总正常展示，演示页摘要数字与轨迹页一致。

---

## 五、调试方案

### 5.1 定位 Agent 决策异常

按“`reason` → `input` → `output` → `branch`”的顺序排查：

1. 在轨迹页找到可疑步骤（可用 seek 直接跳转），先读 `reason`，确认 Agent 自述的动机是否与规则一致；
2. 对照 `input` 检查它当时看到的上下文 / 命中规则 / 退出码；
3. 对照 `output` 检查它实际产出的结论或工具返回（尤其是 `exitCode !== 0`、`stderr`、`truncated`）；
4. 如果下一步发生了跳转，检查 `branch.kind`、`branch.from` / `to`、`errorType`、`handling` 是否解释了原因；
5. 最后看后续步骤是否真正收敛（测试重跑通过、异常被处置）。

标准轨迹内置了一个可练习的异常：`step-26` 测试失败 → `step-27` 异常分支（`snapshot-missing`）→ `step-28` 生成快照 → `step-32` / `step-33` 重跑通过 → `step-34` 正常分支 → `step-44` 汇总。

在 Node 中直接查看某一步（无需浏览器）：

```bash
node -e 'import("./scripts/trace-data.js").then(({ SAMPLE_TRACE, getTraceStep }) => { console.log(JSON.stringify(getTraceStep(SAMPLE_TRACE, "step-27"), null, 2)); })'
```

如需只跑轨迹契约测试：

```bash
node --test tests/trace.test.js
node --test tests/snapshots.test.js
```

### 5.2 导出执行轨迹用于复盘

三种方式：

1. **快照文件（推荐，随提交落库）**：`tests/snapshots/sample-ticket.json` 与 `tests/snapshots/sample-trace.json`，由 `npm run snapshots` 生成，内容与 `SAMPLE_TICKET` / `SAMPLE_TRACE` 完全同源，可直接 diff、归档或附在 Issue / PR 中。重新生成时终端会输出两行 `generated tests/snapshots/...`。
2. **浏览器控制台复制**：打开轨迹页或首页，在 DevTools Console 执行：

   ```js
   const { SAMPLE_TRACE } = await import("../scripts/trace-data.js"); // 轨迹页在 pages/ 下用 ../；首页用 ./scripts/...
   copy(JSON.stringify(SAMPLE_TRACE, null, 2));
   ```

   Chromium 系浏览器可用 `copy()` 直接写入剪贴板；其他浏览器可 `console.log` 后右键“另存为”。也可以只导出单步：

   ```js
   const { getTraceStep } = await import("../scripts/trace-data.js");
   copy(JSON.stringify(getTraceStep(SAMPLE_TRACE, "step-27"), null, 2));
   ```

3. **脚本导出到文件**（在仓库根目录执行）：

   ```bash
   node -e 'import("./scripts/trace-data.js").then(({ SAMPLE_TRACE }) => { require("node:fs").writeFileSync("trace-export.json", JSON.stringify(SAMPLE_TRACE, null, 2) + "\n"); })'
   ```

   注意：页面导出的数据是静态样例，不含用户输入；导出的 `input` / `output` 中可能包含本地路径与命令原文，分享前请检查。

### 5.3 快照漂移

症状：`npm test` 失败，报错类似：

```text
✖ 已提交快照与当前代码生成结果逐字节一致
  ... 不一致。快照与代码生成结果不一致：请运行 `npm run snapshots` 重新生成，并提交 tests/snapshots/ 下的差异。
```

处理：

1. 确认改动确实来自 `SAMPLE_TICKET` / `SAMPLE_TRACE`，而不是测试或环境问题；
2. 运行 `npm run snapshots` 重新生成；
3. 再运行 `npm test`，确认 36 个用例全部通过；
4. 检查 `git diff -- tests/snapshots`，确认差异符合预期后随提交落库；
5. CI 的 `Verify snapshots are committed` 步骤会用 `git diff --exit-code -- tests/snapshots` 再次确认；若失败，说明只改了代码或只改了快照，二者不一致。

`tests/snapshots.test.js` 的机制是“先比较、后写入”：比较失败时不会覆盖已提交快照，避免用测试运行悄悄掩盖漂移。

### 5.4 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 页面空白 / 控制台报 module、CORS 或 `Failed to fetch dynamically imported module` | 用 `file://` 直接打开了 HTML，浏览器阻止 ES module | 用 `npm run serve` 启动静态服务器后访问 `http://127.0.0.1:8000/` |
| 启动时报 `端口 8000 已被占用` | 端口被其他进程占用 | `PORT=9000 npm run serve`（PowerShell：`$env:PORT=9000; npm run serve`） |
| 页面 404 | 静态服务器根目录不是仓库根目录，或访问路径写错 | 在仓库根目录执行 `npm run serve`；路径区分大小写，页面在 `pages/` 下 |
| `npm test` 报 `缺少已提交快照 tests/snapshots/sample-ticket.json` | 尚未生成快照 | 运行 `npm run snapshots`，再运行 `npm test` 并提交快照 |
| `npm test` 报快照不一致 | 改了 `SAMPLE_*` 但未重新生成快照 | 运行 `npm run snapshots`，核对 diff 后提交 |
| 测试报 `step.role 不是真实存在的角色` | 新增步骤使用了未登记的角色 | 改用 `ALLOWED_ROLES` 中的角色，或同步扩展 `tests/trace.test.js` 的 `ALLOWED_ROLES` |
| 测试报 `子任务 Px 没有任何挂载步骤` | 新增 plan 子任务但没有归属步骤 | 添加带 `planStepId` / `subtaskId` 的步骤，或删除该子任务 |
| 测试报 `plan 子任务依赖成环` / 依赖不存在 | `dependsOn` 写错 | 只引用同 plan 内已存在的 id，且避免环 |
| 测试报 `seq 应为 N` / 时间戳非法 | 新增步骤顺序、编号或时间写错 | `seq` 从 1 连续递增；时间戳非递减且落在 `startedAt`…`endedAt` 内 |
| 七层图例或时间线某层缺失 | 轨迹没有覆盖该层 | 保证 7 个 layer 都至少有一条步骤（当前分布 1/1/18/18/3/2/1） |
| 轨迹页折叠状态在重渲染后丢失 | 自定义渲染没有复用 `collapsed` Set | 参照 `scripts/trace-page.js` 的 `collapsed` 与 `renderTraceTimeline(..., { collapsed })` |
| 自动播放不停止 | 页面层没有在末步调用 `pause()` | 参照 `trace-page.js` 的 `startTimer()`：`atEnd` 时 `stopTimer()` + `pause()` |

### 5.5 一次完整复盘的检查顺序

1. **数据层**：`node --test tests/trace.test.js` 与 `tests/snapshots.test.js` 是否通过？
2. **快照层**：`npm run snapshots` 后 `git diff --exit-code -- tests/snapshots` 是否为空？
3. **页面层**：`npm run serve` 后五个页面是否 200？轨迹页控制条是否可用？
4. **证据层**：轨迹页 `step-26` / `step-27` 的失败与处置、`step-44` 的 `artifacts` / `nextActions` 是否与 `tests/snapshots/sample-trace.json` 一致？
5. **交付层**：把上述命令输出与截图附在 PR 描述中，供评审复核。

---

维护提示：修改样例数据、页面或测试后，请同步 `README.md` 与本文档中的数字（44 步、7 层、7 个子任务、2 个分支、36 个用例、快照路径），并重新生成快照，确保文档与实现不漂移。
