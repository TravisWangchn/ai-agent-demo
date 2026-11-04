/**
 * Super-Agent 工单自动化编排演示的策略规则数据与规则表渲染。
 *
 * 数据与展示分离：`RULES` 只描述规则，`renderRulesTable` 负责生成 DOM，
 * 因此本模块可以在浏览器外被 node:test 直接导入和校验。
 */

/** 策略规则支持的任务类型，规则页与标准样例的“教学对照”模拟器共用。 */
export const TASK_TYPES = {
  copy: "抄写修正",
  visual: "视觉调整",
  bugfix: "Bug 修复",
  feature: "新增功能",
};

/**
 * Super-Agent 工单自动化编排演示使用的策略规则。
 *
 * requirements 是接受任务前必须满足的条件；演示页会用任务的 facts
 * 逐项检查这些条件，全部满足才会进入执行阶段。
 */
export const RULES = [
  {
    id: "copy",
    name: "文字抄写修正",
    appliesTo: "copy",
    scenario:
      "只涉及已确定的文案、标题或术语替换，目标文字与替换内容都明确。",
    example: "把首页标题中的「工单编排演示」改为「工单自动化编排演示」。",
    requirements: [
      { id: "exactTarget", label: "指出要修改的具体文字" },
      { id: "replacement", label: "给出替换后的文字" },
      { id: "scope", label: "确认改动只涉及文案，不改变结构" },
    ],
    execution: "创建分支，替换目标文字，运行现有检查，不扩大改动范围。",
    delivery: "提交一个小型 PR，在描述中说明改动位置与检查结果。",
  },
  {
    id: "visual",
    name: "视觉调整",
    appliesTo: "visual",
    scenario:
      "调整页面视觉表现。请求必须指出具体页面、元素和期望状态，缺一项就不接受。",
    example: "把演示页主按钮改为深蓝色，并保持文字对比度不低于 4.5:1。",
    requirements: [
      { id: "concreteElement", label: "指明页面与具体元素" },
      { id: "targetState", label: "说明期望的视觉状态" },
      { id: "acceptance", label: "给出可观察的验收方式" },
    ],
    execution: "按既定目标修改样式，在相同视口与页面状态下截取 Before/After 证据。",
    delivery: "提交带 Before/After 截图的 PR，并说明截图使用的视口与主题。",
  },
  {
    id: "bugfix",
    name: "Bug 修复",
    appliesTo: "bugfix",
    scenario: "报告可复现的缺陷。请求需要给出复现步骤和期望行为。",
    example: "宽度小于 768px 时点击菜单按钮无响应，期望菜单展开。",
    requirements: [
      { id: "reproduction", label: "给出可复现步骤" },
      { id: "expected", label: "说明期望行为与实际行为的差异" },
    ],
    execution: "先复现，再定位根因，补充回归测试或等效验证。",
    delivery: "提交修复 PR，附复现结果与验证证据。",
  },
  {
    id: "feature",
    name: "功能开发",
    appliesTo: "feature",
    scenario: "新增用户可见能力。请求需要说明做什么、服务谁、怎样算完成。",
    example: "规则页增加按任务类型筛选的按钮，并支持键盘操作。",
    requirements: [
      { id: "what", label: "说明要新增的能力" },
      { id: "who", label: "说明服务的对象或使用场景" },
      { id: "done", label: "给出可观察的完成标准" },
    ],
    execution: "按规格实现并补充测试、文档，保持改动聚焦。",
    delivery: "提交可运行的 PR，说明验证方式与已知限制。",
  },
];

/**
 * 按任务类型查找规则。
 * @param {string} taskType
 * @returns {(typeof RULES)[number] | null}
 */
export function getRuleByTaskType(taskType) {
  return RULES.find((rule) => rule.appliesTo === taskType) ?? null;
}

/**
 * 把规则数据渲染到规则表的 <tbody>。
 * @param {HTMLTableSectionElement | null} tbody
 * @param {typeof RULES} rules
 */
export function renderRulesTable(tbody, rules = RULES) {
  if (!tbody) {
    throw new TypeError("renderRulesTable 需要一个 <tbody> 容器");
  }

  const doc = tbody.ownerDocument;
  const rows = rules.map((rule) => {
    const row = doc.createElement("tr");

    const nameCell = doc.createElement("th");
    nameCell.scope = "row";
    const name = doc.createElement("span");
    name.className = "rule-table__name";
    name.textContent = rule.name;
    const type = doc.createElement("span");
    type.className = "rule-table__type";
    type.textContent = TASK_TYPES[rule.appliesTo] ?? rule.appliesTo;
    nameCell.append(name, type);

    const scenarioCell = doc.createElement("td");
    scenarioCell.className = "rule-table__scenario";
    scenarioCell.textContent = rule.scenario;

    const exampleCell = doc.createElement("td");
    exampleCell.className = "rule-table__example";
    exampleCell.textContent = rule.example;

    const requirementsCell = doc.createElement("td");
    const requirementList = doc.createElement("ul");
    requirementList.className = "rule-table__list";
    for (const requirement of rule.requirements) {
      const item = doc.createElement("li");
      item.textContent = requirement.label;
      requirementList.append(item);
    }
    requirementsCell.append(requirementList);

    const decisionCell = doc.createElement("td");
    decisionCell.className = "rule-table__decision";
    const execution = doc.createElement("p");
    execution.textContent = `执行：${rule.execution}`;
    const delivery = doc.createElement("p");
    delivery.textContent = `交付：${rule.delivery}`;
    decisionCell.append(execution, delivery);

    row.append(
      nameCell,
      scenarioCell,
      exampleCell,
      requirementsCell,
      decisionCell,
    );
    return row;
  });

  tbody.replaceChildren(...rows);
}

// 在浏览器中自动渲染规则页；在 Node 测试环境中不会触碰 DOM。
if (typeof document !== "undefined") {
  const tbody = document.querySelector("[data-rules-table]");
  if (tbody) {
    renderRulesTable(tbody);
  }
}
