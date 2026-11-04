import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TRACE_LAYERS,
  SAMPLE_TICKET,
  SAMPLE_TRACE,
  getTraceLayer,
  getTraceStep,
} from "../scripts/trace-data.js";
import { TracePlayback } from "../scripts/trace-playback.js";

/** 契约规定的 7 层，顺序不可变。 */
const EXPECTED_LAYER_IDS = [
  "trigger",
  "plan",
  "tool_call",
  "tool_result",
  "reasoning",
  "branch",
  "summary",
];

const ALLOWED_SOURCES = new Set(["agent", "tool", "event"]);
/** 只允许真实存在的 DSH 角色/工具形态，避免样例虚构插件。 */
const ALLOWED_ROLES = new Set([
  "orchestrator",
  "worker",
  "github",
  "shell",
  "filesystem",
  "node-test",
  "git",
]);
const ALLOWED_PLAN_TOOLS = new Set([
  "orchestrator",
  "github",
  "shell",
  "filesystem",
  "node:test",
  "git",
]);

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertNonEmptyString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.ok(value.trim().length > 0, message);
}

function assertNonEmptyStringArray(value, message) {
  assert.ok(Array.isArray(value), `${message}：应为数组`);
  assert.ok(value.length > 0, `${message}：不应为空`);
  for (const item of value) {
    assertNonEmptyString(item, `${message}：数组元素应为非空字符串`);
  }
}

// ---------------------------------------------------------------------------
// 数据契约：TRACE_LAYERS / SAMPLE_TICKET
// ---------------------------------------------------------------------------

test("TRACE_LAYERS 恰好是 7 层且顺序固定", () => {
  assert.ok(Array.isArray(TRACE_LAYERS));
  assert.deepEqual(
    TRACE_LAYERS.map((layer) => layer.id),
    EXPECTED_LAYER_IDS,
  );

  for (const layer of TRACE_LAYERS) {
    assertNonEmptyString(layer.label, `${layer.id}.label 不应为空`);
    assertNonEmptyString(
      layer.description,
      `${layer.id}.description 不应为空`,
    );
    assert.ok(
      ALLOWED_SOURCES.has(layer.source),
      `${layer.id}.source 非法：${layer.source}`,
    );
  }

  assert.equal(getTraceLayer("plan"), TRACE_LAYERS[1]);
  assert.equal(getTraceLayer("unknown"), null);
  assert.equal(getTraceLayer(""), null);
  assert.equal(getTraceLayer(undefined), null);
});

test("SAMPLE_TICKET 忠实描述 GitHub Issue #11", () => {
  assert.equal(SAMPLE_TICKET.id, "issue-11");
  assert.equal(SAMPLE_TICKET.source, "github");
  assert.equal(SAMPLE_TICKET.sourceLabel, "GitHub Issue");
  assert.equal(SAMPLE_TICKET.number, 11);
  assertNonEmptyString(SAMPLE_TICKET.title, "title 不应为空");
  assert.match(SAMPLE_TICKET.title, /Super-Agent/);
  assert.equal(SAMPLE_TICKET.author, "TravisWangchn");
  assert.equal(SAMPLE_TICKET.createdAt, "2026-11-04T09:40:37.000Z");
  assert.equal(
    SAMPLE_TICKET.url,
    "https://github.com/TravisWangchn/ai-agent-demo/issues/11",
  );
  assertNonEmptyStringArray(SAMPLE_TICKET.labels, "labels");
  assert.equal(SAMPLE_TICKET.state, "open");
  assertNonEmptyString(SAMPLE_TICKET.body, "body 不应为空");
  assert.ok(
    SAMPLE_TICKET.body.length > 100,
    "body 应包含可阅读的工单正文摘要",
  );
});

test("SAMPLE_TRACE 引用同一工单，并声明 7 层与时间范围", () => {
  assert.equal(SAMPLE_TRACE.id, "trace-issue-11");
  assert.equal(SAMPLE_TRACE.ticketId, SAMPLE_TICKET.id);
  assertNonEmptyString(SAMPLE_TRACE.title, "trace.title 不应为空");
  assert.deepEqual(SAMPLE_TRACE.layers, EXPECTED_LAYER_IDS);

  const startedAt = Date.parse(SAMPLE_TRACE.startedAt);
  const endedAt = Date.parse(SAMPLE_TRACE.endedAt);
  assert.ok(Number.isFinite(startedAt), "startedAt 应为合法时间");
  assert.ok(Number.isFinite(endedAt), "endedAt 应为合法时间");
  assert.ok(startedAt < endedAt, "startedAt 应早于 endedAt");

  assert.ok(Array.isArray(SAMPLE_TRACE.steps));
  assert.ok(
    SAMPLE_TRACE.steps.length >= 18,
    `steps 至少 18 步，当前 ${SAMPLE_TRACE.steps.length} 步`,
  );
});

// ---------------------------------------------------------------------------
// 数据契约：逐步字段、时间顺序、7 层覆盖
// ---------------------------------------------------------------------------

test("每一步都有连续 seq、唯一 id、合法 layer 与五要素", () => {
  const { steps } = SAMPLE_TRACE;
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
  assert.equal(new Set(steps.map((step) => step.seq)).size, steps.length);

  steps.forEach((step, index) => {
    assert.equal(step.seq, index + 1, `第 ${index + 1} 步的 seq 应为 ${index + 1}`);
    assert.match(step.id, /^step-\d{2}$/, `${step.id} 不符合 step-NN 形式`);
    assert.ok(
      EXPECTED_LAYER_IDS.includes(step.layer),
      `${step.id}.layer 非法：${step.layer}`,
    );
    assertNonEmptyString(step.role, `${step.id}.role 不应为空`);
    assert.ok(
      ALLOWED_ROLES.has(step.role),
      `${step.id}.role 不是真实存在的角色：${step.role}`,
    );
    assertNonEmptyString(step.reason, `${step.id}.reason 不应为空`);
    assert.ok(isPlainObject(step.input), `${step.id}.input 应为对象`);
    assert.ok(
      Object.keys(step.input).length > 0,
      `${step.id}.input 不应为空对象`,
    );
    assert.ok(isPlainObject(step.output), `${step.id}.output 应为对象`);
    assert.ok(
      Object.keys(step.output).length > 0,
      `${step.id}.output 不应为空对象`,
    );
  });
});

test("所有 step 时间戳落在轨迹区间内且按 seq 非递减", () => {
  const startedAt = Date.parse(SAMPLE_TRACE.startedAt);
  const endedAt = Date.parse(SAMPLE_TRACE.endedAt);
  let previous = startedAt;

  for (const step of SAMPLE_TRACE.steps) {
    const timestamp = Date.parse(step.timestamp);
    assert.ok(Number.isFinite(timestamp), `${step.id}.timestamp 非法`);
    assert.ok(
      timestamp >= startedAt,
      `${step.id} 早于轨迹 startedAt`,
    );
    assert.ok(timestamp <= endedAt, `${step.id} 晚于轨迹 endedAt`);
    assert.ok(
      timestamp >= previous,
      `${step.id} 的时间戳小于前一步，轨迹时间必须非递减`,
    );
    previous = timestamp;
  }

  assert.equal(
    Date.parse(SAMPLE_TRACE.steps.at(-1).timestamp),
    endedAt,
    "endedAt 应等于最后一步的时间戳",
  );
});

test("7 个 layer 在 steps 中全部出现，且覆盖 agent/tool/event 三类来源", () => {
  const layers = new Set(SAMPLE_TRACE.steps.map((step) => step.layer));
  for (const layerId of EXPECTED_LAYER_IDS) {
    assert.ok(layers.has(layerId), `layer「${layerId}」没有任何步骤`);
  }

  const sources = new Set(
    SAMPLE_TRACE.steps.map((step) => getTraceLayer(step.layer).source),
  );
  assert.deepEqual(
    [...sources].sort(),
    ["agent", "event", "tool"],
    "轨迹应同时体现 Agent 推理、工具执行与外部事件",
  );
});

// ---------------------------------------------------------------------------
// 数据契约：plan 子任务（依赖、所属工具、归属关系）
// ---------------------------------------------------------------------------

test("plan 层拆解出带依赖与所属工具的子任务，依赖合法且无环", () => {
  const planSteps = SAMPLE_TRACE.steps.filter(
    (step) => step.layer === "plan",
  );
  assert.ok(planSteps.length >= 1, "轨迹缺少 plan 层步骤");

  for (const planStep of planSteps) {
    const subtasks = planStep.plan?.subtasks;
    assert.ok(Array.isArray(subtasks) && subtasks.length > 0, `${planStep.id} 缺少 plan.subtasks`);
    assert.equal(
      planStep.output.subtaskCount,
      subtasks.length,
      `${planStep.id}.output.subtaskCount 应与子任务数一致`,
    );

    const byId = new Map(subtasks.map((subtask) => [subtask.id, subtask]));
    assert.equal(byId.size, subtasks.length, `${planStep.id} 子任务 id 不唯一`);

    for (const subtask of subtasks) {
      assertNonEmptyString(subtask.id, `${planStep.id} 子任务缺少 id`);
      assertNonEmptyString(subtask.title, `${subtask.id} 缺少 title`);
      assert.ok(
        Array.isArray(subtask.dependsOn),
        `${subtask.id}.dependsOn 应为数组`,
      );
      assert.ok(
        ALLOWED_PLAN_TOOLS.has(subtask.tool),
        `${subtask.id}.tool 不是可承接的工具：${subtask.tool}`,
      );
      assertNonEmptyString(subtask.status, `${subtask.id} 缺少 status`);
      for (const dependencyId of subtask.dependsOn) {
        assert.notEqual(
          dependencyId,
          subtask.id,
          `${subtask.id} 不应依赖自身`,
        );
        assert.ok(
          byId.has(dependencyId),
          `${subtask.id} 依赖了不存在的子任务 ${dependencyId}`,
        );
      }
    }

    // 依赖图不得成环。
    const visiting = new Set();
    const visited = new Set();
    const visit = (id, trail) => {
      if (visited.has(id)) {
        return;
      }
      assert.ok(
        !visiting.has(id),
        `plan 子任务依赖成环：${[...trail, id].join(" -> ")}`,
      );
      visiting.add(id);
      for (const dependencyId of byId.get(id).dependsOn) {
        visit(dependencyId, [...trail, id]);
      }
      visiting.delete(id);
      visited.add(id);
    };
    for (const subtask of subtasks) {
      visit(subtask.id, []);
    }

    // 每个子任务都应有后续步骤挂载，否则折叠视图会得到空分组。
    const attached = new Set(
      SAMPLE_TRACE.steps
        .filter((step) => step.planStepId === planStep.id)
        .map((step) => step.subtaskId),
    );
    for (const subtask of subtasks) {
      assert.ok(
        attached.has(subtask.id),
        `子任务 ${subtask.id} 没有任何挂载步骤`,
      );
    }
  }
});

test("后续步骤的 planStepId / subtaskId 指向真实存在的 plan 子任务", () => {
  const planSteps = new Map(
    SAMPLE_TRACE.steps
      .filter((step) => step.layer === "plan")
      .map((step) => [step.id, step]),
  );

  for (const step of SAMPLE_TRACE.steps) {
    if (step.planStepId === undefined) {
      continue;
    }
    const planStep = planSteps.get(step.planStepId);
    assert.ok(planStep, `${step.id}.planStepId 指向不存在的步骤`);
    assert.ok(
      planStep.seq < step.seq,
      `${step.id} 归属的 plan 步骤应更早出现`,
    );
    const subtaskIds = planStep.plan.subtasks.map((subtask) => subtask.id);
    assert.ok(
      subtaskIds.includes(step.subtaskId),
      `${step.id}.subtaskId 不在 ${planStep.id} 的子任务中`,
    );
  }
});

// ---------------------------------------------------------------------------
// 数据契约：tool_call / tool_result
// ---------------------------------------------------------------------------

test("tool_call 携带真实下发参数，tool_result 携带退出码、耗时与原始输出", () => {
  const toolCalls = SAMPLE_TRACE.steps.filter(
    (step) => step.layer === "tool_call",
  );
  const toolResults = SAMPLE_TRACE.steps.filter(
    (step) => step.layer === "tool_result",
  );
  assert.ok(toolCalls.length >= 3, "轨迹缺少足够的工具调用步骤");
  assert.equal(
    toolCalls.length,
    toolResults.length,
    "每条 tool_call 都应有对应的 tool_result",
  );

  for (const step of toolCalls) {
    assertNonEmptyString(step.input.tool, `${step.id}.input.tool 不应为空`);
    assert.ok(
      ["command", "path", "paths"].some((key) => key in step.input),
      `${step.id}.input 缺少逐字下发的参数（command/path/paths）`,
    );
    assert.equal(step.output.dispatched, true, `${step.id} 应标记已下发`);
  }

  for (const step of toolResults) {
    assert.equal(typeof step.output.exitCode, "number", `${step.id} 缺少 exitCode`);
    assert.equal(
      typeof step.output.durationMs,
      "number",
      `${step.id} 缺少 durationMs`,
    );
    assert.ok(step.output.durationMs >= 0, `${step.id}.durationMs 不应为负`);
    const payload = ["stdout", "stderr", "payload"].find(
      (key) =>
        typeof step.output[key] === "string" && step.output[key].length > 0,
    );
    assert.ok(payload, `${step.id} 缺少原始输出摘录`);
  }

  assert.ok(
    toolResults.some((step) => step.output.exitCode !== 0),
    "轨迹应保留一次真实的失败工具返回（异常分支的依据）",
  );
});

// ---------------------------------------------------------------------------
// 数据契约：branch / summary
// ---------------------------------------------------------------------------

test("branch 步骤包含正常分支与异常分支，并指向真实节点", () => {
  const stepIds = new Set(SAMPLE_TRACE.steps.map((step) => step.id));
  const branches = SAMPLE_TRACE.steps.filter(
    (step) => step.layer === "branch",
  );
  assert.ok(branches.length >= 2, "至少需要正常分支与异常分支各一个");

  const kinds = new Set();
  for (const step of branches) {
    const branch = step.branch;
    assert.ok(isPlainObject(branch), `${step.id}.branch 应为对象`);
    assert.ok(
      branch.kind === "normal" || branch.kind === "exception",
      `${step.id}.branch.kind 非法：${branch.kind}`,
    );
    assertNonEmptyString(branch.from, `${step.id}.branch.from 不应为空`);
    assertNonEmptyString(branch.to, `${step.id}.branch.to 不应为空`);
    assert.ok(stepIds.has(branch.from), `${step.id}.branch.from 指向不存在的步骤`);
    assert.ok(stepIds.has(branch.to), `${step.id}.branch.to 指向不存在的步骤`);
    assert.notEqual(branch.from, branch.to, `${step.id} 的 from 与 to 不应相同`);
    kinds.add(branch.kind);

    if (branch.kind === "exception") {
      assertNonEmptyString(
        branch.errorType,
        `${step.id}.branch.errorType 不应为空`,
      );
      assertNonEmptyString(
        branch.handling,
        `${step.id}.branch.handling 不应为空`,
      );
    }
  }

  assert.deepEqual([...kinds].sort(), ["exception", "normal"]);
});

test("summary 步骤给出整体结论、产出物清单与后续动作", () => {
  const summaries = SAMPLE_TRACE.steps.filter(
    (step) => step.layer === "summary",
  );
  assert.equal(summaries.length, 1, "标准轨迹应有一个最终汇总");

  const [summary] = summaries;
  assert.equal(summary.seq, SAMPLE_TRACE.steps.length, "summary 应为最后一步");
  assertNonEmptyStringArray(summary.artifacts, "summary.artifacts");
  assertNonEmptyStringArray(summary.nextActions, "summary.nextActions");

  // 产出物必须指向本仓库真实存在的交付文件、快照路径或 PR 地址，避免空泛罗列。
  for (const artifact of summary.artifacts) {
    assert.match(
      artifact,
      /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$|^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/\d+$/,
      `产出物路径不可识别：${artifact}`,
    );
  }
});

test("getTraceStep 按 id 返回唯一步骤，未知输入返回 null", () => {
  const first = SAMPLE_TRACE.steps[0];
  assert.equal(getTraceStep(SAMPLE_TRACE, first.id), first);
  assert.equal(getTraceStep(SAMPLE_TRACE, "step-999"), null);
  assert.equal(getTraceStep(null, first.id), null);
  assert.equal(getTraceStep({}, first.id), null);
});

// ---------------------------------------------------------------------------
// TracePlayback：纯状态机，不创建任何定时器
// ---------------------------------------------------------------------------

test("trace-playback 代码不包含 setInterval / setTimeout 调用", () => {
  const source = readFileSync(
    new URL("../scripts/trace-playback.js", import.meta.url),
    "utf8",
  );
  // 注释中说明「定时器留在页面层」是允许的，只检查可执行代码。
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(
    code,
    /\bset(?:Interval|Timeout)\b/,
    "回放状态类不得创建定时器，时钟由浏览器页面驱动",
  );
});

test("TracePlayback 构造时夹紧初始值与总步数", () => {
  const playback = new TracePlayback(5);
  assert.equal(playback.total, 5);
  assert.equal(playback.cursor, 1);
  assert.equal(playback.playing, false);
  assert.equal(playback.intervalMs, 1200);

  assert.equal(new TracePlayback(5, { initial: 3 }).cursor, 3);
  assert.equal(new TracePlayback(5, { initial: 99 }).cursor, 5);
  assert.equal(new TracePlayback(5, { initial: 0 }).cursor, 1);
  assert.equal(new TracePlayback(5, { initial: -2 }).cursor, 1);
  assert.equal(
    new TracePlayback(5, { intervalMs: 300 }).intervalMs,
    300,
  );
  assert.equal(
    new TracePlayback(5, { intervalMs: -1 }).intervalMs,
    1200,
    "非法 intervalMs 应回退默认值",
  );

  assert.throws(() => new TracePlayback(-1), TypeError);
  assert.throws(() => new TracePlayback(Number.NaN), TypeError);
  assert.throws(() => new TracePlayback("5"), TypeError);
});

test("TracePlayback 空轨迹（total=0）安全降级", () => {
  const playback = new TracePlayback(0);
  assert.equal(playback.total, 0);
  assert.equal(playback.cursor, 0);
  assert.deepEqual(playback.getSnapshot(), {
    cursor: 0,
    total: 0,
    playing: false,
    progress: 0,
    atStart: true,
    atEnd: true,
  });

  playback.next();
  playback.prev();
  assert.equal(playback.cursor, 0);
  assert.equal(playback.seek(1), false);
  assert.equal(playback.seek(0), false);
});

test("play / pause / toggle 只由显式调用改变，并在变化时通知订阅者", () => {
  const playback = new TracePlayback(3);
  const states = [];
  playback.subscribe((snapshot) => states.push(snapshot));

  playback.play();
  assert.equal(playback.playing, true);
  assert.equal(states.length, 1);
  assert.equal(states[0].playing, true);

  playback.play();
  assert.equal(states.length, 1, "重复 play 不应产生额外通知");

  playback.pause();
  assert.equal(playback.playing, false);
  assert.equal(states.length, 2);

  playback.toggle();
  assert.equal(playback.playing, true);
  assert.equal(states.length, 3);

  playback.toggle();
  assert.equal(playback.playing, false);
  assert.equal(states.length, 4);
});

test("next / prev 在边界处保持游标，且不重复通知", () => {
  const playback = new TracePlayback(3);
  const states = [];
  playback.subscribe((snapshot) => states.push(snapshot));

  playback.next();
  assert.equal(playback.cursor, 2);
  playback.next();
  assert.equal(playback.cursor, 3);
  playback.next();
  assert.equal(playback.cursor, 3, "到达末步后 next 应保持");
  assert.equal(states.length, 2, "边界处无状态变化，不应通知");

  playback.prev();
  assert.equal(playback.cursor, 2);
  playback.prev();
  assert.equal(playback.cursor, 1);
  playback.prev();
  assert.equal(playback.cursor, 1, "到达首步后 prev 应保持");
  assert.equal(states.length, 4);
});

test("reset 回到首步并停止播放，重复 reset 不通知", () => {
  const playback = new TracePlayback(4);
  const states = [];
  playback.subscribe((snapshot) => states.push(snapshot));

  playback.seek(3);
  playback.play();
  playback.reset();

  assert.equal(playback.cursor, 1);
  assert.equal(playback.playing, false);
  assert.equal(states.length, 3);

  playback.reset();
  assert.equal(states.length, 3, "已在初始状态时 reset 不应通知");
});

test("seek 支持夹紧，非法输入返回 false 且不改变状态", () => {
  const playback = new TracePlayback(5);
  const states = [];
  playback.subscribe((snapshot) => states.push(snapshot));

  assert.equal(playback.seek(3), true);
  assert.equal(playback.cursor, 3);

  assert.equal(playback.seek(0), true);
  assert.equal(playback.cursor, 1);
  assert.equal(playback.seek(-7), true);
  assert.equal(playback.cursor, 1);
  assert.equal(playback.seek(999), true);
  assert.equal(playback.cursor, 5);

  const before = playback.getSnapshot();
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    null,
    undefined,
    "3",
    {},
    [],
  ]) {
    assert.equal(playback.seek(invalid), false, `seek(${String(invalid)}) 应返回 false`);
    assert.deepEqual(playback.getSnapshot(), before, "非法 seek 不应改变状态");
  }

  const notifyCount = states.length;
  assert.equal(playback.seek(5), true, "合法但未变化的 seek 返回 true");
  assert.equal(states.length, notifyCount, "状态未变化时不通知");
});

test("getSnapshot 提供自洽的进度与首尾标志", () => {
  const playback = new TracePlayback(5);

  const first = playback.getSnapshot();
  assert.deepEqual(Object.keys(first).sort(), [
    "atEnd",
    "atStart",
    "cursor",
    "playing",
    "progress",
    "total",
  ]);
  assert.equal(first.atStart, true);
  assert.equal(first.atEnd, false);
  assert.equal(first.progress, 0);

  playback.seek(3);
  const middle = playback.getSnapshot();
  assert.equal(middle.atStart, false);
  assert.equal(middle.atEnd, false);
  assert.ok(middle.progress > first.progress && middle.progress < 1);
  assert.ok(middle.progress >= 0 && middle.progress <= 1);

  playback.seek(5);
  const last = playback.getSnapshot();
  assert.equal(last.atStart, false);
  assert.equal(last.atEnd, true);
  assert.equal(last.progress, 1);

  // 快照是独立副本，修改它不影响内部状态。
  last.cursor = 1;
  assert.equal(playback.cursor, 5);

  // 单步轨迹既在起点也在终点，进度视为完成。
  const single = new TracePlayback(1);
  assert.deepEqual(single.getSnapshot(), {
    cursor: 1,
    total: 1,
    playing: false,
    progress: 1,
    atStart: true,
    atEnd: true,
  });
});

test("subscribe 支持多监听、逐个退订，通知内容即当时快照", () => {
  const playback = new TracePlayback(4);
  const firstStates = [];
  const secondStates = [];
  const unsubscribeFirst = playback.subscribe((snapshot) =>
    firstStates.push(snapshot),
  );
  const unsubscribeSecond = playback.subscribe((snapshot) =>
    secondStates.push(snapshot),
  );

  playback.next();
  assert.equal(firstStates.length, 1);
  assert.equal(secondStates.length, 1);
  assert.deepEqual(firstStates[0], playback.getSnapshot());
  assert.deepEqual(firstStates[0], secondStates[0]);

  unsubscribeFirst();
  playback.next();
  assert.equal(firstStates.length, 1, "退订后不应再收到通知");
  assert.equal(secondStates.length, 2);

  unsubscribeSecond();
  playback.next();
  assert.equal(secondStates.length, 2);

  assert.throws(() => playback.subscribe(null), TypeError);
});

test("播放全流程：逐条前进到末尾后由页面层暂停", () => {
  const playback = new TracePlayback(SAMPLE_TRACE.steps.length);
  const visited = [playback.cursor];
  playback.play();

  while (!playback.getSnapshot().atEnd) {
    playback.next();
    visited.push(playback.cursor);
  }

  assert.equal(visited.length, SAMPLE_TRACE.steps.length);
  assert.deepEqual(
    visited,
    Array.from({ length: SAMPLE_TRACE.steps.length }, (_, index) => index + 1),
  );
  assert.equal(playback.playing, true, "状态类不自动暂停，由页面驱动");
});
