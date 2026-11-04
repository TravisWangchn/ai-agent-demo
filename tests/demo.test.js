import test from "node:test";
import assert from "node:assert/strict";

import {
  TASKS,
  getTaskById,
  simulateTask,
} from "../scripts/demo.js";
import { TASK_TYPES, getRuleByTaskType } from "../scripts/rules.js";

const STAGE_IDS = ["trigger", "evaluate", "decide", "execute", "deliver"];

test("演示任务 id 唯一，且每个任务都能匹配到规则", () => {
  assert.ok(Array.isArray(TASKS));
  assert.equal(TASKS.length, Object.keys(TASK_TYPES).length);

  const ids = TASKS.map((task) => task.id);
  assert.equal(new Set(ids).size, ids.length, "任务 id 不应重复");

  for (const task of TASKS) {
    assert.ok(task.request.trim().length > 0, `${task.id} 缺少请求文本`);
    assert.ok(
      getRuleByTaskType(task.type),
      `${task.id} 的任务类型 ${task.type} 没有对应规则`,
    );
  }
});

test("演示任务覆盖四种任务类型", () => {
  const taskTypes = TASKS.map((task) => task.type).sort();
  assert.deepEqual(taskTypes, Object.keys(TASK_TYPES).sort());
});

test("条件齐全的任务被接受，并给出执行与交付动作", () => {
  for (const taskId of ["copy", "bugfix", "feature"]) {
    const result = simulateTask(taskId);

    assert.equal(result.accepted, true, `${taskId} 应被接受`);
    assert.deepEqual(result.missing, []);
    assert.ok(result.checks.every((check) => check.met));
    assert.equal(result.decision.status, "accepted");
    assert.equal(result.decision.label, "接受");
    assert.match(result.decision.detail, /执行/);
    assert.match(result.decision.nextStep, /交付/);

    assert.deepEqual(
      result.stages.map((stage) => stage.id),
      STAGE_IDS,
    );
    assert.ok(
      result.stages.every((stage) => stage.title && stage.text),
      "每个阶段都应有标题与说明",
    );
  }
});

test("缺少规格的视觉任务被暂不接受，并指出全部缺失条件", () => {
  const result = simulateTask("visual");

  assert.equal(result.accepted, false);
  assert.equal(result.decision.status, "rejected");
  assert.equal(result.decision.label, "暂不接受");
  assert.equal(result.missing.length, 3);
  assert.match(result.decision.detail, /缺少/);
  for (const missingItem of result.missing) {
    assert.ok(
      result.decision.detail.includes(missingItem),
      `决策说明应包含缺失条件：${missingItem}`,
    );
  }

  assert.ok(result.checks.some((check) => !check.met));
  assert.match(result.stages[3].text, /不进入执行/);
  assert.match(result.decision.nextStep, /不创建分支/);
});

test("模拟结果绑定正确的任务与规则", () => {
  const result = simulateTask("bugfix");

  assert.equal(result.task.id, "bugfix");
  assert.equal(result.rule.appliesTo, "bugfix");
  assert.equal(result.rule.id, "bugfix");
});

test("未知任务返回 null 或抛出明确错误", () => {
  assert.equal(getTaskById("unknown"), null);
  assert.throws(() => simulateTask("unknown"), /未知任务/);
});
