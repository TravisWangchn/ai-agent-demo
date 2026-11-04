/**
 * 轨迹数据模块：七层执行日志的 schema、标准样例工单与标准执行轨迹。
 *
 * 本文件只包含纯数据与查询函数，不依赖 DOM 与 Node 内置模块，因此可以同时被
 * 浏览器（轨迹页、演示页、快照摘要）和 node:test（数据契约测试）导入。
 *
 * 七层定义（顺序固定，页面图例与快照测试都依赖它）：
 *   trigger     → 外部事件输入（GitHub Issue）
 *   plan        → Agent 的任务拆解与依赖规划
 *   tool_call   → 下发给工具的指令原文与参数
 *   tool_result → 工具返回的原始 payload（退出码 / 耗时 / 输出）
 *   reasoning   → Agent 的判定结论、依据与规则命中项
 *   branch      → 正常推进或异常处置的节点跳转
 *   summary     → 整体结论、产出物与后续动作
 */

/**
 * 七层执行日志的层级定义。
 *
 * source 语义：
 *   - agent：Agent 自身推理产出（规划、决策、分支、汇总）
 *   - tool：工具执行与返回（指令下发、原始 payload）
 *   - event：外部事件输入（工单触发）
 */
export const TRACE_LAYERS = [
  {
    id: "trigger",
    label: "工单原始输入",
    source: "event",
    description:
      "外部系统推入的原始事件：Issue 来源、编号、提交者、时间戳与正文，是整条轨迹的起点。",
  },
  {
    id: "plan",
    label: "任务拆解规划",
    source: "agent",
    description:
      "orchestrator 把工单拆成带依赖顺序的子任务，并指定每个子任务由哪个工具承接。",
  },
  {
    id: "tool_call",
    label: "工具调用请求",
    source: "tool",
    description:
      "逐字记录下发给工具的真实指令与参数（命令、工作目录、文件路径），不做概述改写。",
  },
  {
    id: "tool_result",
    label: "工具返回 Payload",
    source: "tool",
    description:
      "工具返回的原始 payload 摘录：退出码、耗时与关键输出；失败结果同样保留，不粉饰。",
  },
  {
    id: "reasoning",
    label: "Agent 决策推理",
    source: "agent",
    description:
      "Agent 依据策略规则与上一步结果做出的判定结论、依据说明与规则命中项。",
  },
  {
    id: "branch",
    label: "分支跳转",
    source: "agent",
    description:
      "流程在节点之间的跳转：正常推进、失败重试或异常处置，记录来源节点、目标节点与处置方式。",
  },
  {
    id: "summary",
    label: "最终汇总输出",
    source: "agent",
    description:
      "orchestrator 汇总整条轨迹的结论，列出产出物清单与后续动作，形成可复盘的闭环交付。",
  },
];

/**
 * 标准样例工单：GitHub Issue #11 的真实元信息与正文摘要。
 *
 * 正文是工单内容的结构化摘要，不虚构仓库中不存在的需求。
 */
export const SAMPLE_TICKET = {
  id: "issue-11",
  source: "github",
  sourceLabel: "GitHub Issue",
  number: 11,
  title:
    "feat: 将 ai-agent-demo 重塑为 DSH Super-Agent 工单自动化编排与全链路可观测教学演示站",
  author: "TravisWangchn",
  createdAt: "2026-11-04T09:40:37.000Z",
  url: "https://github.com/TravisWangchn/ai-agent-demo/issues/11",
  labels: ["feature"],
  state: "open",
  body:
    "当前仓库只演示硬编码的规则说明：scripts/demo.js 的 TASKS 与 scripts/rules.js 的 RULES 均为写死常量，" +
    "simulateTask() 是浏览器内的纯函数，仓库中不存在对 GitHub 或后端的真实调用。" +
    "需要把项目重塑为「Super-Agent 工单自动化编排演示」：新增七层可观测执行轨迹（trigger、plan、tool_call、" +
    "tool_result、reasoning、branch、summary），支持单步回放与子任务折叠；测试同时产出标准样例工单与标准执行轨迹快照，" +
    "CI 在单测后生成快照并校验一致性，防止文档与实现漂移。" +
    "技术约束：零依赖、零构建、ES modules + node:test、保留原有目录结构。",
};

/**
 * 标准执行轨迹：Issue 触发的功能开发工单，完整覆盖「触发 → 规划 → 实现 → 页面与文档
 * → 快照与 CI → 提交推送 → 创建 PR → CI 校验 → 汇总」的闭环交付。
 *
 * 轨迹中的工具名、命令与参数都取自本仓库真实可复现的操作：
 * git、filesystem、shell、node:test、github（gh CLI）与 orchestrator / worker 角色。
 * 第 26 步保留了一次真实的测试失败，用于演示异常分支的判定与收敛。
 */
export const SAMPLE_TRACE = {
  id: "trace-issue-11",
  ticketId: "issue-11",
  title: "issue-11 标准执行轨迹",
  startedAt: "2026-11-04T09:40:37.000Z",
  endedAt: "2026-11-04T09:47:20.000Z",
  layers: TRACE_LAYERS.map((layer) => layer.id),
  steps: [
    {
      id: "step-01",
      seq: 1,
      layer: "trigger",
      role: "github",
      timestamp: "2026-11-04T09:40:37.000Z",
      reason:
        "GitHub 收到 Issue #11 的 opened 事件，它是本工单进入编排流程的唯一外部触发源。",
      input: {
        repository: "TravisWangchn/ai-agent-demo",
        event: "issues.opened",
        action: "opened",
      },
      output: {
        ticketId: "issue-11",
        number: 11,
        title:
          "feat: 将 ai-agent-demo 重塑为 DSH Super-Agent 工单自动化编排与全链路可观测教学演示站",
        author: "TravisWangchn",
        labels: ["feature"],
        state: "open",
      },
    },
    {
      id: "step-02",
      seq: 2,
      layer: "reasoning",
      role: "orchestrator",
      timestamp: "2026-11-04T09:40:39.400Z",
      reason:
        "工单同时说明要做什么、服务谁、怎样算完成，逐项命中「功能开发」规则；无需退回补充规格。",
      input: {
        ticketId: "issue-11",
        matchedRule: "feature",
        requirementChecks: { what: true, who: true, done: true },
      },
      output: {
        decision: "accepted",
        ruleName: "功能开发",
        missing: [],
        nextAction: "plan",
      },
    },
    {
      id: "step-03",
      seq: 3,
      layer: "plan",
      role: "orchestrator",
      timestamp: "2026-11-04T09:40:44.100Z",
      reason:
        "工单覆盖数据、回放、页面、文档、快照、CI 与交付，单一子任务无法独立验收；按依赖顺序拆成 7 步，前一步的产出是后一步的输入。",
      input: {
        ticketId: "issue-11",
        matchedRule: "feature",
        constraints: ["零依赖", "ES modules", "node:test"],
      },
      output: {
        goal: "交付可回放的七层执行轨迹页、标准快照与 CI 一致性校验，并完成分支提交与 PR。",
        subtaskCount: 7,
      },
      plan: {
        subtasks: [
          {
            id: "P1",
            title: "确认基线",
            dependsOn: [],
            tool: "git",
            status: "done",
          },
          {
            id: "P2",
            title: "读取契约与现有实现",
            dependsOn: ["P1"],
            tool: "filesystem",
            status: "done",
          },
          {
            id: "P3",
            title: "实现轨迹数据与回放模块",
            dependsOn: ["P2"],
            tool: "filesystem",
            status: "done",
          },
          {
            id: "P4",
            title: "实现轨迹页面与样式",
            dependsOn: ["P3"],
            tool: "filesystem",
            status: "done",
          },
          {
            id: "P5",
            title: "编写使用文档与 README",
            dependsOn: ["P4"],
            tool: "filesystem",
            status: "done",
          },
          {
            id: "P6",
            title: "生成标准快照并接入 CI",
            dependsOn: ["P5"],
            tool: "shell",
            status: "done",
          },
          {
            id: "P7",
            title: "提交分支、创建 PR 并校验 CI",
            dependsOn: ["P6"],
            tool: "github",
            status: "done",
          },
        ],
      },
    },
    {
      id: "step-04",
      seq: 4,
      layer: "tool_call",
      role: "git",
      timestamp: "2026-11-04T09:40:52.000Z",
      reason:
        "先确认基线提交，再在新分支上工作，保证轨迹引用的 origin/main 提交可复现。",
      input: {
        tool: "git",
        command:
          "git fetch origin main && git checkout -B agent/agent-trace-timeline-979fea801140 origin/main",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P1",
    },
    {
      id: "step-05",
      seq: 5,
      layer: "tool_result",
      role: "git",
      timestamp: "2026-11-04T09:40:53.300Z",
      reason:
        "fetch 与分支创建均成功，基线提交为 5dd7ea2，可以开始读取契约与现有实现。",
      input: { call: "step-04", tool: "git" },
      output: {
        exitCode: 0,
        durationMs: 1284,
        stdout:
          "From github.com:TravisWangchn/ai-agent-demo\n" +
          " * branch            main       -> FETCH_HEAD\n" +
          "Switched to a new branch 'agent/agent-trace-timeline-979fea801140'\n" +
          "HEAD is now at 5dd7ea2 feat: 将 ai-agent-demo 改造为多页面 AI Agent 教学演示站 (#10)",
        stderr: "",
      },
      planStepId: "step-03",
      subtaskId: "P1",
    },
    {
      id: "step-06",
      seq: 6,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:01.000Z",
      reason:
        "读取契约中要求保留的现有文件，确认零依赖、node:test 与 CI 结构后再动手。",
      input: {
        tool: "filesystem",
        action: "read",
        paths: [
          "package.json",
          "tests/demo.test.js",
          "tests/rules.test.js",
          ".github/workflows/ci.yml",
          "scripts/main.js",
        ],
      },
      output: { dispatched: true, fileCount: 5 },
      planStepId: "step-03",
      subtaskId: "P2",
    },
    {
      id: "step-07",
      seq: 7,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:01.900Z",
      reason:
        "现有测试只覆盖硬编码规则与规则表渲染；新增轨迹模块必须与 demo / rules 测试共存。",
      input: { call: "step-06", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 86,
        stdout:
          "package.json: type=module, engines.node>=20, scripts.test=node --test\n" +
          "tests/demo.test.js: 覆盖 simulateTask 与任务/规则匹配\n" +
          "tests/rules.test.js: 覆盖 RULES 与 renderRulesTable\n" +
          ".github/workflows/ci.yml: checkout -> setup-node -> npm test\n" +
          "scripts/main.js: 页面导航与初始化入口",
        truncated: false,
      },
      planStepId: "step-03",
      subtaskId: "P2",
    },
    {
      id: "step-08",
      seq: 8,
      layer: "reasoning",
      role: "worker",
      timestamp: "2026-11-04T09:41:07.500Z",
      reason:
        "页面只消费数据与状态机：回放时钟必须留在浏览器页面层，否则 node:test 无法直接验证状态迁移；渲染与交互也要拆成两个模块。",
      input: {
        contract: "DESIGN.md §2",
        constraints: ["零依赖", "ES modules", "无定时器"],
      },
      output: {
        decisions: [
          "trace-data 只导出纯数据、查询函数与常量",
          "TracePlayback 只做状态迁移，不创建定时器",
          "快照由生成器直接读取常量，禁止手工复制",
          "页面渲染（trace-render）与交互（trace-page）拆分为独立模块",
        ],
      },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-09",
      seq: 9,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:16.000Z",
      reason:
        "先落数据模块：7 层定义、样例工单、完整生命周期轨迹与查询函数，供渲染、回放与快照共用。",
      input: {
        tool: "filesystem",
        action: "write",
        path: "scripts/trace-data.js",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-10",
      seq: 10,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:16.300Z",
      reason:
        "写入成功；导出覆盖 7 层定义、样例工单、完整轨迹与查询函数，下一步实现与 DOM 解耦的回放状态类。",
      input: { call: "step-09", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 27,
        stdout: "wrote scripts/trace-data.js",
        files: ["scripts/trace-data.js"],
        layers: 7,
        steps: 44,
      },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-11",
      seq: 11,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:28.000Z",
      reason:
        "回放状态机单独成文件，模块内不创建定时器；浏览器由 trace-page.js 的 setInterval 驱动。",
      input: {
        tool: "filesystem",
        action: "write",
        path: "scripts/trace-playback.js",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-12",
      seq: 12,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:28.200Z",
      reason: "状态类落库，包含 play/pause/toggle/next/prev/reset/seek/subscribe/getSnapshot。",
      input: { call: "step-11", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 18,
        stdout: "wrote scripts/trace-playback.js",
        files: ["scripts/trace-playback.js"],
        timers: 0,
      },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-13",
      seq: 13,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:45.000Z",
      reason:
        "按 TDD 先写数据契约、回放行为与快照一致性测试，让后续实现有可执行的验收标准。",
      input: {
        tool: "filesystem",
        action: "write",
        paths: ["tests/trace.test.js", "tests/snapshots.test.js"],
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-14",
      seq: 14,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:41:45.400Z",
      reason:
        "测试文件落库；快照测试会先比较已提交快照，再调用 writeSnapshots() 由测试本身产出快照。",
      input: { call: "step-13", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 22,
        stdout: "wrote 2 test files",
        files: ["tests/trace.test.js", "tests/snapshots.test.js"],
      },
      planStepId: "step-03",
      subtaskId: "P3",
    },
    {
      id: "step-15",
      seq: 15,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:02.000Z",
      reason:
        "页面渲染单独成模块：所有数据经 textContent 写入，plan 子任务用原生 details 折叠，空轨迹安全降级。",
      input: {
        tool: "filesystem",
        action: "write",
        path: "scripts/trace-render.js",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-16",
      seq: 16,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:02.300Z",
      reason:
        "渲染模块落库，导出页面需要的角色标签、时间格式化与工单卡 / 图例 / 时间线渲染函数。",
      input: { call: "step-15", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 26,
        stdout: "wrote scripts/trace-render.js",
        files: ["scripts/trace-render.js"],
      },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-17",
      seq: 17,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:18.000Z",
      reason:
        "浏览器入口绑定回放控制条与 range seek，用 setInterval 驱动自动播放并在末步自动暂停。",
      input: {
        tool: "filesystem",
        action: "write",
        path: "scripts/trace-page.js",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-18",
      seq: 18,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:18.300Z",
      reason:
        "交互模块落库，包含播放/暂停、上一步/下一步、重置、range seek、折叠状态保持与 destroy() 清理。",
      input: { call: "step-17", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 31,
        stdout: "wrote scripts/trace-page.js",
        files: ["scripts/trace-page.js"],
      },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-19",
      seq: 19,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:40.000Z",
      reason:
        "新增轨迹页，复用全站 header / 导航 / footer，并提供工单卡、七层图例、回放控制与时间线容器。",
      input: {
        tool: "filesystem",
        action: "write",
        path: "pages/trace.html",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-20",
      seq: 20,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:40.500Z",
      reason:
        "轨迹页落库，带 data-trace-ticket / data-trace-legend / data-trace-timeline 等钩子与 noscript 降级说明。",
      input: { call: "step-19", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 24,
        stdout:
          "wrote pages/trace.html（工单卡 / 七层图例 / 回放控制条 / 时间线容器 / noscript）",
        files: ["pages/trace.html"],
      },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-21",
      seq: 21,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:58.000Z",
      reason:
        "在既有样式文件中追加轨迹组件样式，用 CSS 变量区分 agent / tool / event 三种来源，不改动原有设计语言。",
      input: {
        tool: "filesystem",
        action: "edit",
        path: "styles/main.css",
        changes: "新增轨迹卡片、回放控制、七层徽标与 source 来源区分样式变量",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-22",
      seq: 22,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:42:58.400Z",
      reason:
        "样式追加完成，轨迹页与全站视觉保持一致，Agent 推理与工具执行两类来源有明确的颜色区分。",
      input: { call: "step-21", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 19,
        stdout: "updated styles/main.css（追加轨迹组件样式，未改动既有选择器）",
        files: ["styles/main.css"],
      },
      planStepId: "step-03",
      subtaskId: "P4",
    },
    {
      id: "step-23",
      seq: 23,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:43:30.000Z",
      reason:
        "补齐面向使用者的文档：README 说明项目定位与命令，docs/guide.md 覆盖架构、页面、教程、扩展与调试五部分。",
      input: {
        tool: "filesystem",
        action: "write",
        paths: ["README.md", "docs/guide.md"],
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P5",
    },
    {
      id: "step-24",
      seq: 24,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:43:31.000Z",
      reason:
        "文档落库；其中的文件名、命令与快照路径必须与最终实现一致，避免文档与代码漂移。",
      input: { call: "step-23", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 35,
        stdout:
          "wrote README.md 与 docs/guide.md（整体架构 / 页面模块 / 运行教程 / 扩展开发 / 调试方案）",
        files: ["README.md", "docs/guide.md"],
      },
      planStepId: "step-03",
      subtaskId: "P5",
    },
    {
      id: "step-25",
      seq: 25,
      layer: "tool_call",
      role: "shell",
      timestamp: "2026-11-04T09:43:50.000Z",
      reason:
        "按 TDD 先跑全部相关测试，确认数据契约、回放与快照测试能暴露尚未落库的产物。",
      input: {
        tool: "shell",
        command:
          "node --test tests/trace.test.js tests/snapshots.test.js tests/demo.test.js tests/rules.test.js",
        cwd: "repo/",
        timeoutMs: 60000,
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-26",
      seq: 26,
      layer: "tool_result",
      role: "node-test",
      timestamp: "2026-11-04T09:43:51.100Z",
      reason:
        "失败原因是 tests/snapshots/ 下缺少已提交快照，而不是实现逻辑错误；需要先补生成步骤。",
      input: {
        call: "step-25",
        tool: "shell",
        command:
          "node --test tests/trace.test.js tests/snapshots.test.js tests/demo.test.js tests/rules.test.js",
      },
      output: {
        exitCode: 1,
        durationMs: 214,
        stdout:
          "▶ 已提交快照与当前代码生成结果逐字节一致\n" +
          "  ✖ 缺少已提交快照 tests/snapshots/sample-ticket.json：请运行 `npm run snapshots` 生成并提交。\n" +
          "ℹ tests 36\nℹ pass 34\nℹ fail 2",
        stderr: "",
        summary: { tests: 36, pass: 34, fail: 2 },
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-27",
      seq: 27,
      layer: "branch",
      role: "orchestrator",
      timestamp: "2026-11-04T09:43:53.000Z",
      reason:
        "失败原因不是实现缺陷，而是快照产物尚未落库；按规则先补生成步骤，禁止放宽断言绕过。",
      input: { failedStep: "step-26", exitCode: 1, failedLayer: "tool_result" },
      output: { nextStep: "step-28", handling: "generate-snapshots" },
      branch: {
        kind: "exception",
        from: "step-26",
        to: "step-28",
        errorType: "snapshot-missing",
        handling:
          "不修改断言绕过：运行 node scripts/generate-snapshots.js 从 SAMPLE_TICKET / SAMPLE_TRACE 生成快照，再重跑同一组测试。",
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-28",
      seq: 28,
      layer: "tool_call",
      role: "shell",
      timestamp: "2026-11-04T09:44:00.000Z",
      reason:
        "用生成器从样例常量直接产出 JSON，避免手工复制导致快照与实现漂移。",
      input: {
        tool: "shell",
        command: "node scripts/generate-snapshots.js",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-29",
      seq: 29,
      layer: "tool_result",
      role: "shell",
      timestamp: "2026-11-04T09:44:00.300Z",
      reason: "两个快照文件已落库，内容直接来自数据模块。",
      input: { call: "step-28", tool: "shell" },
      output: {
        exitCode: 0,
        durationMs: 124,
        stdout:
          "generated tests/snapshots/sample-ticket.json\n" +
          "generated tests/snapshots/sample-trace.json",
        stderr: "",
        files: [
          "tests/snapshots/sample-ticket.json",
          "tests/snapshots/sample-trace.json",
        ],
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-30",
      seq: 30,
      layer: "tool_call",
      role: "filesystem",
      timestamp: "2026-11-04T09:44:20.000Z",
      reason:
        "把快照一致性纳入 CI：单测后重新生成快照，再用 git diff 检查是否与已提交版本一致。",
      input: {
        tool: "filesystem",
        action: "edit",
        path: ".github/workflows/ci.yml",
        changes:
          "在 npm test 后新增 npm run snapshots 与 git diff --exit-code -- tests/snapshots",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-31",
      seq: 31,
      layer: "tool_result",
      role: "filesystem",
      timestamp: "2026-11-04T09:44:20.300Z",
      reason:
        "CI 配置更新完成，保留原 checkout / setup-node 结构，只追加快照生成与一致性校验步骤。",
      input: { call: "step-30", tool: "filesystem" },
      output: {
        exitCode: 0,
        durationMs: 16,
        stdout:
          "updated .github/workflows/ci.yml（新增 Generate demo snapshots 与 Verify snapshots are committed）",
        files: [".github/workflows/ci.yml"],
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-32",
      seq: 32,
      layer: "tool_call",
      role: "shell",
      timestamp: "2026-11-04T09:44:45.000Z",
      reason:
        "重跑全部相关测试，确认异常已解除且既有 demo/rules 测试未被破坏。",
      input: {
        tool: "shell",
        command:
          "node --test tests/trace.test.js tests/snapshots.test.js tests/demo.test.js tests/rules.test.js",
        cwd: "repo/",
        timeoutMs: 60000,
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-33",
      seq: 33,
      layer: "tool_result",
      role: "node-test",
      timestamp: "2026-11-04T09:44:46.400Z",
      reason: "四个测试文件全部通过，异常分支按预期收敛。",
      input: {
        call: "step-32",
        tool: "shell",
        command:
          "node --test tests/trace.test.js tests/snapshots.test.js tests/demo.test.js tests/rules.test.js",
      },
      output: {
        exitCode: 0,
        durationMs: 198,
        stdout: "ℹ tests 36\nℹ suites 0\nℹ pass 36\nℹ fail 0\nℹ duration_ms 198",
        stderr: "",
        summary: { tests: 36, pass: 36, fail: 0 },
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-34",
      seq: 34,
      layer: "branch",
      role: "orchestrator",
      timestamp: "2026-11-04T09:44:48.000Z",
      reason:
        "测试全部通过，满足进入自检与交付阶段的条件，按正常分支继续，无需人工介入。",
      input: { exitCode: 0, failed: 0 },
      output: { nextStep: "step-35", verdict: "continue" },
      branch: {
        kind: "normal",
        from: "step-33",
        to: "step-35",
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-35",
      seq: 35,
      layer: "reasoning",
      role: "worker",
      timestamp: "2026-11-04T09:44:55.000Z",
      reason:
        "连续两次运行生成器后 git diff 为空，package.json 无新增依赖，回放模块无 setInterval，CI 已加入快照一致性检查，满足提交条件。",
      input: {
        checks: [
          "快照生成幂等",
          "未新增依赖",
          "回放模块无定时器",
          "CI 含 git diff --exit-code -- tests/snapshots",
        ],
      },
      output: {
        verdict: "ready",
        risks: ["快照内容随样例数据变化，任何修改都必须重新生成并随提交落库"],
      },
      planStepId: "step-03",
      subtaskId: "P6",
    },
    {
      id: "step-36",
      seq: 36,
      layer: "tool_call",
      role: "git",
      timestamp: "2026-11-04T09:45:20.000Z",
      reason:
        "自检通过，把本轮全部改动提交到功能分支，形成可追溯的单一提交。",
      input: {
        tool: "git",
        command:
          "git add -A && git commit -m \"feat: 新增 Super-Agent 工单七层执行轨迹与回放演示\"",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-37",
      seq: 37,
      layer: "tool_result",
      role: "git",
      timestamp: "2026-11-04T09:45:21.000Z",
      reason: "提交成功，工作区干净，可以推送到远端。",
      input: { call: "step-36", tool: "git" },
      output: {
        exitCode: 0,
        durationMs: 342,
        stdout:
          "[agent/agent-trace-timeline-979fea801140] feat: 新增 Super-Agent 工单七层执行轨迹与回放演示\n工作区干净",
        stderr: "",
      },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-38",
      seq: 38,
      layer: "tool_call",
      role: "git",
      timestamp: "2026-11-04T09:45:40.000Z",
      reason: "把功能分支推送到 origin 并建立上游跟踪，为创建 PR 做准备。",
      input: {
        tool: "git",
        command: "git push -u origin agent/agent-trace-timeline-979fea801140",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-39",
      seq: 39,
      layer: "tool_result",
      role: "git",
      timestamp: "2026-11-04T09:45:42.000Z",
      reason:
        "远端分支创建成功并输出创建 PR 的链接，可以交给 gh CLI 创建 PR。",
      input: { call: "step-38", tool: "git" },
      output: {
        exitCode: 0,
        durationMs: 1543,
        stdout:
          "remote: \n" +
          "remote: Create a pull request for 'agent/agent-trace-timeline-979fea801140' on GitHub by visiting:\n" +
          "remote:      https://github.com/TravisWangchn/ai-agent-demo/pull/new/agent/agent-trace-timeline-979fea801140\n" +
          "remote: \n" +
          "To github.com:TravisWangchn/ai-agent-demo.git\n" +
          " * [new branch]      agent/agent-trace-timeline-979fea801140 -> agent/agent-trace-timeline-979fea801140\n" +
          "branch 'agent/agent-trace-timeline-979fea801140' set up to track 'origin/agent/agent-trace-timeline-979fea801140'.",
        stderr: "",
      },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-40",
      seq: 40,
      layer: "tool_call",
      role: "github",
      timestamp: "2026-11-04T09:46:10.000Z",
      reason:
        "用 gh CLI 向 main 发起 PR，标题与正文描述七层轨迹、回放、快照与 CI 校验的交付内容。",
      input: {
        tool: "github",
        command:
          "gh pr create --repo TravisWangchn/ai-agent-demo --base main --head agent/agent-trace-timeline-979fea801140 --title \"feat: 新增 Super-Agent 工单七层执行轨迹与回放演示\" --body \"新增七层执行轨迹、单步回放、标准快照与 CI 一致性校验；详见 docs/guide.md。\"",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-41",
      seq: 41,
      layer: "tool_result",
      role: "github",
      timestamp: "2026-11-04T09:46:12.000Z",
      reason: "PR 创建成功，返回 PR #12 的地址，进入 CI 校验阶段。",
      input: { call: "step-40", tool: "github" },
      output: {
        exitCode: 0,
        durationMs: 1876,
        stdout: "https://github.com/TravisWangchn/ai-agent-demo/pull/12",
        stderr: "",
        prNumber: 12,
        prUrl: "https://github.com/TravisWangchn/ai-agent-demo/pull/12",
      },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-42",
      seq: 42,
      layer: "tool_call",
      role: "github",
      timestamp: "2026-11-04T09:46:30.000Z",
      reason:
        "查询 PR #12 的检查结果，确认 CI 的单测与快照一致性步骤全部通过。",
      input: {
        tool: "github",
        command: "gh pr checks 12 --repo TravisWangchn/ai-agent-demo",
        cwd: "repo/",
      },
      output: { dispatched: true },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-43",
      seq: 43,
      layer: "tool_result",
      role: "github",
      timestamp: "2026-11-04T09:47:05.000Z",
      reason:
        "CI 检查全部通过，没有失败或待执行项，工单可以进入汇总与人工 review 阶段。",
      input: { call: "step-42", tool: "github" },
      output: {
        exitCode: 0,
        durationMs: 20420,
        stdout:
          "Unit tests\tpass\t1m 8s\n" +
          "All checks were successful\n" +
          "0 failing, 0 pending, 1 successful, 0 skipped, 1 neutral",
        stderr: "",
        failing: 0,
        pending: 0,
        successful: 1,
      },
      planStepId: "step-03",
      subtaskId: "P7",
    },
    {
      id: "step-44",
      seq: 44,
      layer: "summary",
      role: "orchestrator",
      timestamp: "2026-11-04T09:47:20.000Z",
      reason:
        "从 Issue 触发到 PR checks 通过，数据、页面、文档、快照、CI 与交付动作全部闭环；轨迹可由快照逐字节复现，满足工单验收条件。",
      input: {
        traceId: "trace-issue-11",
        ticketId: "issue-11",
        stepCount: 44,
        prNumber: 12,
      },
      output: {
        status: "completed",
        prUrl: "https://github.com/TravisWangchn/ai-agent-demo/pull/12",
        checks: "passed",
        tests: 36,
        snapshots: 2,
        exceptionHandled: "snapshot-missing",
      },
      artifacts: [
        "scripts/trace-data.js",
        "scripts/trace-playback.js",
        "scripts/trace-render.js",
        "scripts/trace-page.js",
        "scripts/generate-snapshots.js",
        "scripts/serve.js",
        "tests/trace.test.js",
        "tests/snapshots.test.js",
        "tests/snapshots/sample-ticket.json",
        "tests/snapshots/sample-trace.json",
        "pages/trace.html",
        "styles/main.css",
        "README.md",
        "docs/guide.md",
        "package.json",
        ".github/workflows/ci.yml",
        "https://github.com/TravisWangchn/ai-agent-demo/pull/12",
      ],
      nextActions: [
        "等待维护者 review PR #12，按评审意见调整实现或补充测试。",
        "合并后在 main 上运行 npm test、npm run snapshots 与 npm run serve，验收 5 个页面与七层轨迹回放。",
        "后续可按 docs/guide.md 的扩展开发指南新增工单类型、工具节点与分支规则。",
      ],
    },
  ],
};

/**
 * 按 layer id 查询层级定义。
 * @param {string} layerId
 * @returns {(typeof TRACE_LAYERS)[number] | null}
 */
export function getTraceLayer(layerId) {
  return TRACE_LAYERS.find((layer) => layer.id === layerId) ?? null;
}

/**
 * 按 step id 查询轨迹中的某一步。
 * @param {{ steps?: Array<{ id: string }> } | null | undefined} trace
 * @param {string} stepId
 * @returns {object | null}
 */
export function getTraceStep(trace, stepId) {
  if (!trace || !Array.isArray(trace.steps)) {
    return null;
  }
  return trace.steps.find((step) => step.id === stepId) ?? null;
}
