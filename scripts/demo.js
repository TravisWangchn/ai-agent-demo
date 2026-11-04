/**
 * 演示页的 Agent 流程模拟器。
 *
 * 纯逻辑部分（TASKS / simulateTask）不依赖 DOM，可在 node:test 中直接测试；
 * 页面交互由 initDemo 在浏览器中绑定。
 */

import { getRuleByTaskType } from "./rules.js";

/**
 * 演示页提供的四类任务。
 *
 * facts 描述请求中实际给出的信息，规则通过 requirements 逐项检查；
 * 缺少任一条件时，任务不会被接受。
 */
export const TASKS = [
  {
    id: "copy",
    type: "copy",
    label: "抄写修正",
    request:
      "把首页主标题中的「AI Agent 教学演示」改为「AI Agent 教学演示站」，其余文字保持不变。",
    facts: {
      exactTarget: true,
      replacement: true,
      scope: true,
    },
  },
  {
    id: "visual",
    type: "visual",
    label: "视觉调整",
    request: "把整站做得更好看一点，颜色也顺便调一调。",
    facts: {
      concreteElement: false,
      targetState: false,
      acceptance: false,
    },
  },
  {
    id: "bugfix",
    type: "bugfix",
    label: "Bug 修复",
    request:
      "移动端菜单点击后没有展开。复现步骤：窗口宽度小于 768px 时点击「菜单」按钮，预期菜单展开，实际没有响应。",
    facts: {
      reproduction: true,
      expected: true,
    },
  },
  {
    id: "feature",
    type: "feature",
    label: "新增功能",
    request:
      "规则页增加按任务类型筛选的按钮，方便第一次接触策略的读者快速定位；完成标准是点击任一类型后表格只显示该类型规则，并且所有按钮都能用键盘操作。",
    facts: {
      what: true,
      who: true,
      done: true,
    },
  },
];

/**
 * 按 id 查找演示任务。
 * @param {string} taskId
 * @returns {(typeof TASKS)[number] | null}
 */
export function getTaskById(taskId) {
  return TASKS.find((task) => task.id === taskId) ?? null;
}

/**
 * 运行一次完整模拟：触发 → 评估 → 决策 → 执行 → 交付。
 * @param {string} taskId
 */
export function simulateTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    throw new RangeError(`未知任务：${taskId}`);
  }

  const rule = getRuleByTaskType(task.type);
  if (!rule) {
    throw new RangeError(`任务类型「${task.type}」没有匹配的规则`);
  }

  const checks = rule.requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: task.facts[requirement.id] === true,
  }));
  const missing = checks
    .filter((check) => !check.met)
    .map((check) => check.label);
  const accepted = missing.length === 0;

  const decision = accepted
    ? {
        status: "accepted",
        label: "接受",
        title: `接受为「${rule.name}」任务`,
        detail: `进入执行：${rule.execution}`,
        nextStep: `交付：${rule.delivery}`,
      }
    : {
        status: "rejected",
        label: "暂不接受",
        title: "要求补充规格",
        detail: `缺少：${missing.join("、")}。方向未确定时，Agent 不应自行替请求人做决定。`,
        nextStep: "向请求人补充这些信息；不创建分支，也不改动代码。",
      };

  const stages = [
    {
      id: "trigger",
      title: "触发",
      text: task.request,
    },
    {
      id: "evaluate",
      title: "评估",
      text: `匹配策略规则「${rule.name}」。${rule.scenario}`,
    },
    {
      id: "decide",
      title: "决策",
      text: accepted
        ? "接受条件全部满足，任务被接受。"
        : `接受条件未全部满足：缺少${missing.join("、")}。`,
    },
    {
      id: "execute",
      title: "执行",
      text: accepted
        ? rule.execution
        : "不进入执行阶段，避免在方向未确定时改动代码。",
    },
    {
      id: "deliver",
      title: "交付",
      text: accepted
        ? rule.delivery
        : "交付一条具体的补充规格请求，说明还需要哪些信息。",
    },
  ];

  return {
    task,
    rule,
    checks,
    missing,
    accepted,
    decision,
    stages,
  };
}

function createElement(doc, tagName, className, text) {
  const element = doc.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function renderChecklist(doc, checks) {
  const list = createElement(doc, "ul", "checklist");
  for (const check of checks) {
    const item = createElement(
      doc,
      "li",
      `checklist__item checklist__item--${check.met ? "met" : "missing"}`,
    );
    const mark = createElement(
      doc,
      "span",
      "checklist__mark",
      check.met ? "✓" : "✕",
    );
    mark.setAttribute("aria-hidden", "true");

    const label = createElement(doc, "span");
    const statusText = createElement(
      doc,
      "span",
      "visually-hidden",
      check.met ? "满足：" : "缺少：",
    );
    label.append(statusText, doc.createTextNode(check.label));

    item.append(mark, label);
    list.append(item);
  }
  return list;
}

function renderStages(doc, simulation) {
  const list = createElement(doc, "ol", "sim-stages");
  simulation.stages.forEach((stage, index) => {
    const item = createElement(doc, "li", "sim-stage");

    const number = createElement(
      doc,
      "span",
      "sim-stage__index",
      String(index + 1),
    );
    number.setAttribute("aria-hidden", "true");

    const body = createElement(doc, "div", "sim-stage__body");
    body.append(createElement(doc, "h4", "sim-stage__title", stage.title));

    if (stage.id === "trigger") {
      body.append(
        createElement(doc, "p", "sim-stage__request", stage.text),
      );
    } else {
      body.append(createElement(doc, "p", "sim-stage__text", stage.text));
    }

    if (stage.id === "decide") {
      body.append(renderChecklist(doc, simulation.checks));
    }

    item.append(number, body);
    list.append(item);
  });
  return list;
}

function renderDecision(doc, simulation) {
  const card = createElement(
    doc,
    "div",
    `decision-card decision-card--${simulation.decision.status}`,
  );
  card.append(
    createElement(
      doc,
      "h4",
      "decision-card__title",
      `产出决策：${simulation.decision.label} · ${simulation.decision.title}`,
    ),
    createElement(
      doc,
      "p",
      "decision-card__detail",
      simulation.decision.detail,
    ),
    createElement(
      doc,
      "p",
      "decision-card__next",
      `下一步：${simulation.decision.nextStep}`,
    ),
  );
  return card;
}

function renderSimulation(root, simulation) {
  const doc = root.ownerDocument;
  const status = root.querySelector("[data-sim-status]");
  const empty = root.querySelector("[data-sim-empty]");
  const output = root.querySelector("[data-sim-output]");
  const announcer = root.querySelector("[data-sim-announcer]");

  if (!status || !empty || !output) {
    return;
  }

  status.className = `badge badge--${simulation.decision.status}`;
  status.textContent = simulation.decision.label;
  empty.hidden = true;
  output.hidden = false;
  output.replaceChildren(
    renderStages(doc, simulation),
    renderDecision(doc, simulation),
  );

  if (announcer) {
    announcer.textContent = `${simulation.task.label}：${simulation.decision.label}。${simulation.decision.title}。`;
  }
}

/**
 * 绑定演示页的按钮与结果区域。
 * @param {ParentNode} root
 */
export function initDemo(root = document) {
  const demo = root.querySelector("[data-demo]");
  if (!demo) {
    return;
  }

  const buttons = Array.from(demo.querySelectorAll("[data-task-id]"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const other of buttons) {
        other.setAttribute(
          "aria-pressed",
          String(other === button),
        );
      }
      renderSimulation(demo, simulateTask(button.dataset.taskId));
    });
  }
}

// 在浏览器中自动初始化；Node 测试环境没有 document，不会执行。
if (typeof document !== "undefined") {
  initDemo(document);
}
