import test from "node:test";
import assert from "node:assert/strict";

import {
  RULES,
  TASK_TYPES,
  getRuleByTaskType,
  renderRulesTable,
} from "../scripts/rules.js";

const REQUIRED_TEXT_FIELDS = [
  "id",
  "name",
  "appliesTo",
  "scenario",
  "example",
  "execution",
  "delivery",
];

test("规则表覆盖全部任务类型，且规则 id 唯一", () => {
  assert.ok(Array.isArray(RULES));
  assert.equal(RULES.length, Object.keys(TASK_TYPES).length);

  const ids = RULES.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length, "规则 id 不应重复");

  const appliedTypes = RULES.map((rule) => rule.appliesTo).sort();
  const expectedTypes = Object.keys(TASK_TYPES).sort();
  assert.deepEqual(appliedTypes, expectedTypes);
});

test("每条规则都包含完整文本字段与至少一个接受条件", () => {
  for (const rule of RULES) {
    for (const field of REQUIRED_TEXT_FIELDS) {
      assert.equal(
        typeof rule[field],
        "string",
        `${rule.id}.${field} 应为字符串`,
      );
      assert.ok(
        rule[field].trim().length > 0,
        `${rule.id}.${field} 不应为空`,
      );
    }

    assert.ok(Array.isArray(rule.requirements), `${rule.id} 应包含接受条件`);
    assert.ok(
      rule.requirements.length > 0,
      `${rule.id} 至少需要一个接受条件`,
    );

    const requirementIds = rule.requirements.map((item) => item.id);
    assert.equal(
      new Set(requirementIds).size,
      requirementIds.length,
      `${rule.id} 的接受条件 id 不应重复`,
    );
    for (const requirement of rule.requirements) {
      assert.ok(requirement.id, `${rule.id} 的条件缺少 id`);
      assert.ok(requirement.label, `${rule.id} 的条件缺少 label`);
    }
  }
});

test("getRuleByTaskType 按类型返回规则，未知类型返回 null", () => {
  for (const type of Object.keys(TASK_TYPES)) {
    const rule = getRuleByTaskType(type);
    assert.ok(rule, `${type} 应匹配到规则`);
    assert.equal(rule.appliesTo, type);
  }

  assert.equal(getRuleByTaskType("unknown"), null);
});

test("renderRulesTable 缺少容器时抛出明确错误", () => {
  assert.throws(() => renderRulesTable(null), /tbody/);
});
