/**
 * 执行轨迹渲染模块。
 *
 * 输入是 `scripts/trace-data.js` 定义的结构化轨迹数据，输出是可直接插入页面的 DOM 节点。
 * 设计约束：
 * - 只使用传入的 document，浏览器与（可注入 document 的）测试环境均可使用；
 * - 不 import 任何 node: 模块；
 * - 所有来自数据的文本一律通过 textContent 写入，JSON 用 <pre><code> 展示，不做 HTML 注入；
 * - 未知 layer / 缺失字段 / 空轨迹都降级为可读文本，不抛异常。
 */

import { TRACE_LAYERS, getTraceLayer } from "./trace-data.js";

/** role -> 中文角色标签；未收录的 role 直接展示原始值。 */
export const ROLE_LABELS = Object.freeze({
  orchestrator: "编排器",
  worker: "执行 Worker",
  github: "GitHub (gh CLI)",
  shell: "Shell 终端",
  filesystem: "文件系统",
  git: "Git 版本控制",
  "node-test": "node:test 测试",
  agent: "Agent",
  human: "人类评审",
  ci: "CI 流水线",
});

/** source -> 中文来源标签。 */
export const SOURCE_LABELS = Object.freeze({
  agent: "Agent 推理",
  tool: "工具执行",
  event: "外部事件",
  unknown: "未知来源",
});

/** 子任务状态 -> 中文标签。 */
const SUBTASK_STATUS_LABELS = Object.freeze({
  done: "已完成",
  running: "进行中",
  pending: "待开始",
  blocked: "已阻塞",
  failed: "失败",
});

const KNOWN_SOURCES = new Set(["agent", "tool", "event"]);

function resolveDoc(doc) {
  if (doc && typeof doc.createElement === "function") {
    return doc;
  }
  if (typeof document !== "undefined") {
    return document;
  }
  throw new TypeError("轨迹渲染需要提供 document。");
}

function createElement(doc, tagName, className, text) {
  const element = doc.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }
  return element;
}

function createEmptyState(doc, text, className = "trace-empty") {
  return createElement(doc, "p", className, text);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 把 ISO 时间格式化为固定的 UTC 文本，避免依赖浏览器时区导致截图不确定。
 * 示例："2026-11-04 09:40:37 UTC"。
 * @param {unknown} iso
 * @returns {string}
 */
export function formatTimestamp(iso) {
  if (typeof iso !== "string" || iso.trim() === "") {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  );
}

/**
 * 把 input / output 对象格式化为可读的缩进 JSON 文本。
 * 非法值（undefined、循环引用等）降级为字符串，不抛异常。
 * @param {unknown} value
 * @returns {string}
 */
export function formatStepValue(value) {
  if (value === undefined) {
    return "{}";
  }
  try {
    const text = JSON.stringify(value, null, 2);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

function resolveRoleLabel(role) {
  if (typeof role !== "string" || role.trim() === "") {
    return { role: "未知角色", label: null };
  }
  const label = ROLE_LABELS[role] ?? null;
  return { role, label: label && label !== role ? label : null };
}

function resolveSource(step, layer) {
  const candidates = [
    step && typeof step === "object" ? step.source : null,
    layer && typeof layer === "object" ? layer.source : null,
  ];
  for (const candidate of candidates) {
    if (KNOWN_SOURCES.has(candidate)) {
      return candidate;
    }
  }
  return "unknown";
}

function resolveLayer(step) {
  if (!step || typeof step !== "object" || typeof step.layer !== "string") {
    return null;
  }
  try {
    return getTraceLayer(step.layer);
  } catch {
    return null;
  }
}

function createSourceBadge(doc, source) {
  const normalized = KNOWN_SOURCES.has(source) ? source : "unknown";
  return createElement(
    doc,
    "span",
    `source-badge source-badge--${normalized}`,
    SOURCE_LABELS[normalized],
  );
}

function createLayerBadge(doc, layerId, layer) {
  const label = layer && layer.label ? layer.label : "未定义层级";
  const id = layerId || "unknown";
  const badge = createElement(
    doc,
    "span",
    "step-badge step-badge--layer",
    `${id} · ${label}`,
  );
  badge.dataset.layer = id;
  return badge;
}

function createRoleBadge(doc, role) {
  const { role: roleId, label } = resolveRoleLabel(role);
  const badge = createElement(
    doc,
    "span",
    "step-badge step-badge--role",
    label ? `${roleId} · ${label}` : roleId,
  );
  badge.dataset.role = roleId;
  return badge;
}

function createTimeElement(doc, timestamp) {
  const time = createElement(doc, "time", "step-card__time", formatTimestamp(timestamp));
  if (typeof timestamp === "string" && timestamp.trim() !== "") {
    time.setAttribute("datetime", timestamp);
  }
  return time;
}

function appendStepField(doc, parent, key, label, value) {
  const field = createElement(doc, "div", `step-field step-field--${key}`);
  const heading = createElement(doc, "p", "step-field__heading");
  heading.append(
    createElement(doc, "span", "step-field__key", key),
    createElement(doc, "span", "step-field__label", label),
  );
  const pre = createElement(doc, "pre", "step-field__json");
  const code = createElement(doc, "code");
  code.textContent = formatStepValue(value);
  pre.append(code);
  field.append(heading, pre);
  parent.append(field);
}

function renderBranchDetail(doc, step) {
  if (!isPlainObject(step.branch)) {
    return null;
  }
  const kind = step.branch.kind === "exception" ? "exception" : "normal";
  const section = createElement(
    doc,
    "div",
    `step-branch step-branch--${kind}`,
  );
  const head = createElement(doc, "div", "step-branch__head");
  head.append(
    createElement(
      doc,
      "span",
      "step-badge step-badge--branch",
      kind === "exception" ? "异常分支" : "正常分支",
    ),
  );
  if (step.branch.kind && step.branch.kind !== kind) {
    head.append(
      createElement(doc, "span", "step-branch__kind", step.branch.kind),
    );
  }
  section.append(head);

  const facts = createElement(doc, "dl", "step-branch__facts");
  const addFact = (term, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const item = createElement(doc, "div", "step-branch__fact");
    item.append(
      createElement(doc, "dt", null, term),
      createElement(doc, "dd", null, String(value)),
    );
    facts.append(item);
  };
  addFact("跳转路径", `${step.branch.from ?? "?"} → ${step.branch.to ?? "?"}`);
  addFact("异常类型", step.branch.errorType);
  addFact("处置方式", step.branch.handling);
  section.append(facts);
  return section;
}

function renderSummaryDetail(doc, step) {
  const artifacts = safeArray(step.artifacts);
  const nextActions = safeArray(step.nextActions);
  if (artifacts.length === 0 && nextActions.length === 0) {
    return null;
  }
  const section = createElement(doc, "div", "step-summary");

  const addList = (title, items, className) => {
    if (items.length === 0) {
      return;
    }
    const block = createElement(doc, "div", `step-summary__block ${className}`);
    block.append(createElement(doc, "h5", "step-summary__title", title));
    const list = createElement(doc, "ul", "step-summary__list");
    for (const item of items) {
      list.append(createElement(doc, "li", null, String(item)));
    }
    block.append(list);
    section.append(block);
  };

  addList("产出物 artifacts", artifacts, "step-summary__block--artifacts");
  addList("后续动作 nextActions", nextActions, "step-summary__block--next");
  return section;
}

function createStepCardBase(doc, step, layer) {
  const source = resolveSource(step, layer);
  const article = createElement(doc, "article", "step-card");
  article.dataset.stepId = typeof step.id === "string" ? step.id : "";
  article.dataset.layer = typeof step.layer === "string" ? step.layer : "unknown";
  article.dataset.source = source;
  article.dataset.seq = Number.isFinite(step.seq) ? String(step.seq) : "";
  article.dataset.sourceLabel = SOURCE_LABELS[source];
  return { article, source };
}

function renderPlanSubtasks(doc, step, options) {
  const subtasks = safeArray(step.plan && step.plan.subtasks);
  if (subtasks.length === 0) {
    return null;
  }
  const collapsed =
    options && options.collapsed instanceof Set ? options.collapsed : new Set();
  const relatedSteps = safeArray(options && options.relatedSteps);
  const section = createElement(doc, "div", "step-plan");
  section.append(
    createElement(
      doc,
      "h4",
      "step-plan__title",
      `子任务清单 · ${subtasks.length} 项`,
    ),
  );

  const knownSubtaskIds = new Set();
  for (const rawSubtask of subtasks) {
    if (!isPlainObject(rawSubtask)) {
      continue;
    }
    const subtaskId = String(rawSubtask.id ?? "?");
    knownSubtaskIds.add(subtaskId);
    const key = `${articleKey(step)}:${subtaskId}`;

    const details = createElement(doc, "details", "subtask");
    details.dataset.subtaskId = subtaskId;
    details.dataset.planStepId = articleKey(step);
    details.dataset.subtaskKey = key;
    if (!collapsed.has(key)) {
      details.setAttribute("open", "");
    }

    const summary = createElement(doc, "summary", "subtask__summary");
    summary.append(
      createElement(doc, "span", "subtask__id", subtaskId),
      createElement(doc, "span", "subtask__title", String(rawSubtask.title ?? "未命名子任务")),
    );

    const meta = createElement(doc, "span", "subtask__meta");
    const dependsOn = safeArray(rawSubtask.dependsOn).map(String);
    meta.append(
      createElement(
        doc,
        "span",
        "subtask__meta-item",
        `依赖：${dependsOn.length > 0 ? dependsOn.join("、") : "无"}`,
      ),
      createElement(
        doc,
        "span",
        "subtask__meta-item",
        `工具：${rawSubtask.tool ?? "未指定"}`,
      ),
    );
    const status = String(rawSubtask.status ?? "");
    const statusLabel = SUBTASK_STATUS_LABELS[status] ?? status;
    if (statusLabel) {
      const statusBadge = createElement(
        doc,
        "span",
        `subtask__status subtask__status--${status || "unknown"}`,
        statusLabel,
      );
      meta.append(statusBadge);
    }
    summary.append(meta);

    const body = createElement(doc, "div", "subtask__body");
    const children = relatedSteps
      .filter((child) => child && String(child.subtaskId) === subtaskId)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    if (children.length > 0) {
      for (const child of children) {
        body.append(
          renderStepCard(doc, child, {
            layer: resolveLayer(child),
            collapsed,
          }),
        );
      }
    } else {
      body.append(
        createElement(
          doc,
          "p",
          "subtask__empty",
          "该子任务暂无挂载步骤；继续播放回放即可看到下挂的工具调用与返回。",
        ),
      );
    }

    details.append(summary, body);
    section.append(details);
  }

  const orphans = relatedSteps.filter(
    (child) => child && !knownSubtaskIds.has(String(child.subtaskId)),
  );
  if (orphans.length > 0) {
    section.append(
      createElement(
        doc,
        "p",
        "subtask__empty",
        "以下步骤的 subtaskId 不在本计划中，已按普通步骤展示：",
      ),
    );
    for (const child of orphans) {
      section.append(
        renderStepCard(doc, child, { layer: resolveLayer(child), collapsed }),
      );
    }
  }
  return section;
}

function articleKey(step) {
  if (step && typeof step.id === "string" && step.id !== "") {
    return step.id;
  }
  if (step && Number.isFinite(step.seq)) {
    return `seq-${step.seq}`;
  }
  return "step-unknown";
}

/**
 * 渲染单步卡片。
 *
 * @param {Document} doc
 * @param {object} step  DESIGN.md 2.2 定义的 step 形状
 * @param {{ layer?: object|null, collapsed?: Set<string>, relatedSteps?: object[] }} [options]
 *   layer: 可覆盖从 trace-data 解析出的层元数据；
 *   collapsed: 已折叠的 plan 子任务 key 集合（key 形如 `${planStepId}:${subtaskId}`）；
 *   relatedSteps: 挂载在当前 plan 步骤下的后续步骤（由 renderTraceTimeline 计算）。
 * @returns {HTMLElement}
 */
export function renderStepCard(doc, step, options = {}) {
  const ownerDoc = resolveDoc(doc);
  if (!isPlainObject(step)) {
    return createEmptyState(ownerDoc, "该步骤数据缺失，无法渲染。", "trace-empty trace-empty--step");
  }

  const layer = options.layer ?? resolveLayer(step);
  const { article } = createStepCardBase(ownerDoc, step, layer);

  const head = createElement(ownerDoc, "header", "step-card__head");
  const seq = Number.isFinite(step.seq) ? String(step.seq).padStart(2, "0") : "??";
  head.append(createElement(ownerDoc, "span", "step-card__seq", `#${seq}`));

  const badges = createElement(ownerDoc, "div", "step-card__badges");
  badges.append(
    createLayerBadge(ownerDoc, step.layer, layer),
    createSourceBadge(ownerDoc, article.dataset.source),
    createRoleBadge(ownerDoc, step.role),
  );
  head.append(badges, createTimeElement(ownerDoc, step.timestamp));
  article.append(head);

  const reason = createElement(ownerDoc, "p", "step-card__reason");
  reason.append(
    createElement(ownerDoc, "span", "step-card__reason-label", "reason · 决策理由"),
    createElement(
      ownerDoc,
      "span",
      "step-card__reason-text",
      typeof step.reason === "string" && step.reason.trim() !== ""
        ? step.reason
        : "（未提供决策理由）",
    ),
  );
  article.append(reason);

  const io = createElement(ownerDoc, "div", "step-card__io");
  appendStepField(ownerDoc, io, "input", "输入", step.input);
  appendStepField(ownerDoc, io, "output", "输出", step.output);
  article.append(io);

  const branch = renderBranchDetail(ownerDoc, step);
  if (branch) {
    article.append(branch);
  }

  const summary = renderSummaryDetail(ownerDoc, step);
  if (summary) {
    article.append(summary);
  }

  const plan = renderPlanSubtasks(ownerDoc, step, options);
  if (plan) {
    article.append(plan);
  }

  return article;
}

/**
 * 渲染工单卡。
 * @param {Document} doc
 * @param {object} ticket SAMPLE_TICKET 形状
 * @returns {HTMLElement}
 */
export function renderTicketCard(doc, ticket) {
  const ownerDoc = resolveDoc(doc);
  if (!isPlainObject(ticket)) {
    return createEmptyState(ownerDoc, "暂无可展示的工单数据。", "ticket-empty");
  }

  const card = createElement(ownerDoc, "article", "ticket-card");
  card.dataset.ticketId = String(ticket.id ?? "");
  card.dataset.ticketSource = String(ticket.source ?? "");

  const head = createElement(ownerDoc, "div", "ticket-card__head");
  const sourceLabel = String(ticket.sourceLabel ?? ticket.source ?? "未知来源");
  const numberText =
    ticket.number === undefined || ticket.number === null ? "" : ` · #${ticket.number}`;
  head.append(
    createElement(ownerDoc, "span", "ticket-card__source", `${sourceLabel}${numberText}`),
  );
  if (ticket.state) {
    head.append(createElement(ownerDoc, "span", "ticket-card__state", String(ticket.state)));
  }
  card.append(head);

  card.append(
    createElement(
      ownerDoc,
      "h3",
      "ticket-card__title",
      String(ticket.title ?? "未命名工单"),
    ),
  );

  const bodyText = typeof ticket.body === "string" ? ticket.body.trim() : "";
  card.append(
    createElement(
      ownerDoc,
      "p",
      "ticket-card__body",
      bodyText || "（未提供工单正文）",
    ),
  );

  const facts = createElement(ownerDoc, "dl", "ticket-card__facts");
  const addFact = (term, value, isTime = false) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const item = createElement(ownerDoc, "div", "ticket-fact");
    item.append(createElement(ownerDoc, "dt", "ticket-fact__term", term));
    const dd = createElement(ownerDoc, "dd", "ticket-fact__value");
    if (isTime) {
      dd.append(createTimeElement(ownerDoc, value));
    } else {
      dd.textContent = String(value);
    }
    item.append(dd);
    facts.append(item);
  };
  addFact("提交者", ticket.author);
  addFact("创建时间", ticket.createdAt, true);
  addFact("来源", sourceLabel);
  addFact("编号", ticket.number === undefined ? null : `#${ticket.number}`);
  card.append(facts);

  const labels = safeArray(ticket.labels).filter(
    (label) => typeof label === "string" && label.trim() !== "",
  );
  if (labels.length > 0) {
    const labelList = createElement(ownerDoc, "ul", "ticket-card__labels");
    for (const label of labels) {
      labelList.append(createElement(ownerDoc, "li", "ticket-chip", label));
    }
    card.append(labelList);
  }

  const href = safeHref(ticket.url);
  if (href) {
    const link = createElement(ownerDoc, "a", "ticket-card__link", "在 GitHub 查看原始 Issue →");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }

  return card;
}

function safeHref(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const url = new URL(value, "https://github.com/");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * 渲染七层图例。
 * @param {Document} doc
 * @param {Array<object>} layers TRACE_LAYERS 形状；未知/缺失项降级展示
 * @returns {HTMLElement}
 */
export function renderLayerLegend(doc, layers) {
  const ownerDoc = resolveDoc(doc);
  const items = safeArray(layers).filter(isPlainObject);
  if (items.length === 0) {
    return createEmptyState(ownerDoc, "暂无层级定义。", "layer-legend layer-legend--empty");
  }

  const list = createElement(ownerDoc, "ol", "layer-legend");
  items.forEach((layer, index) => {
    const source = KNOWN_SOURCES.has(layer.source) ? layer.source : "unknown";
    const item = createElement(
      ownerDoc,
      "li",
      `layer-legend__item layer-legend__item--${source}`,
    );
    item.dataset.layer = String(layer.id ?? `layer-${index + 1}`);
    item.dataset.source = source;

    const number = createElement(
      ownerDoc,
      "span",
      "layer-legend__index",
      String(index + 1).padStart(2, "0"),
    );
    number.setAttribute("aria-hidden", "true");

    const body = createElement(ownerDoc, "div", "layer-legend__body");
    body.append(
      createElement(
        ownerDoc,
        "h4",
        "layer-legend__name",
        String(layer.label ?? layer.id ?? "未命名层级"),
      ),
      createElement(
        ownerDoc,
        "p",
        "layer-legend__desc",
        typeof layer.description === "string" && layer.description.trim() !== ""
          ? layer.description
          : "（未提供该层说明）",
      ),
    );

    item.append(number, body, createSourceBadge(ownerDoc, source));
    list.append(item);
  });
  return list;
}

/**
 * 渲染轨迹时间线：只展示前 visibleCount 步。
 *
 * @param {Document} doc
 * @param {object} trace SAMPLE_TRACE 形状
 * @param {{ visibleCount?: number, collapsed?: Set<string> }} [options]
 * @returns {HTMLElement}
 */
export function renderTraceTimeline(doc, trace, options = {}) {
  const ownerDoc = resolveDoc(doc);
  const steps = safeArray(trace && trace.steps).filter(isPlainObject);
  if (steps.length === 0) {
    return createEmptyState(ownerDoc, "该轨迹没有步骤数据，无法回放。", "trace-empty trace-empty--timeline");
  }

  const collapsed =
    options && options.collapsed instanceof Set ? options.collapsed : new Set();
  const requested = options ? options.visibleCount : steps.length;
  const visibleCount = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 0), steps.length)
    : steps.length;
  const visible = steps.slice(0, visibleCount);
  if (visible.length === 0) {
    return createEmptyState(ownerDoc, "回放尚未开始，点击“播放”或“下一步”展示轨迹。", "trace-empty trace-empty--timeline");
  }

  // 先把可见的 plan 步骤与其子任务登记下来，后续步骤才能挂载到 <details> 内。
  const planSteps = new Map();
  for (const step of visible) {
    if (step.layer === "plan" && Array.isArray(step.plan && step.plan.subtasks)) {
      planSteps.set(articleKey(step), step);
    }
  }

  const childrenByPlan = new Map();
  const attached = new Set();
  for (const step of visible) {
    if (step.layer === "plan" || !step.planStepId) {
      continue;
    }
    const planStep = planSteps.get(String(step.planStepId));
    if (!planStep) {
      continue;
    }
    const subtaskIds = new Set(
      safeArray(planStep.plan.subtasks).map((subtask) => String(subtask && subtask.id)),
    );
    if (!subtaskIds.has(String(step.subtaskId))) {
      continue;
    }
    const planKey = articleKey(planStep);
    if (!childrenByPlan.has(planKey)) {
      childrenByPlan.set(planKey, []);
    }
    childrenByPlan.get(planKey).push(step);
    attached.add(step);
  }

  const timeline = createElement(ownerDoc, "ol", "trace-timeline");
  timeline.dataset.traceId = String(trace.id ?? "");
  timeline.dataset.total = String(steps.length);
  timeline.dataset.visibleCount = String(visible.length);

  for (const step of visible) {
    if (attached.has(step)) {
      continue;
    }
    const item = createElement(ownerDoc, "li", "trace-timeline__item");
    const relatedSteps = childrenByPlan.get(articleKey(step)) ?? [];
    item.append(
      renderStepCard(ownerDoc, step, {
        layer: resolveLayer(step),
        collapsed,
        relatedSteps,
      }),
    );
    timeline.append(item);
  }

  return timeline;
}

/**
 * 渲染标准轨迹摘要（用于演示页，也方便文档复用）。
 *
 * @param {Document} doc
 * @param {object} trace SAMPLE_TRACE 形状
 * @returns {HTMLElement}
 */
export function renderTraceSummary(doc, trace) {
  const ownerDoc = resolveDoc(doc);
  if (!isPlainObject(trace)) {
    return createEmptyState(ownerDoc, "暂无可展示的轨迹摘要。", "trace-summary trace-summary--empty");
  }

  const steps = safeArray(trace.steps).filter(isPlainObject);
  const wrapper = createElement(ownerDoc, "div", "trace-summary");
  wrapper.dataset.traceId = String(trace.id ?? "");

  const covered = new Set(
    steps.map((step) => (typeof step.layer === "string" ? step.layer : "unknown")),
  );
  const exceptionBranches = steps.filter(
    (step) => isPlainObject(step.branch) && step.branch.kind === "exception",
  );
  const knownLayers = safeArray(TRACE_LAYERS).filter(isPlainObject);
  const coveredCount = knownLayers.filter((layer) => covered.has(layer.id)).length;

  const stats = createElement(ownerDoc, "dl", "trace-summary__stats");
  const addStat = (term, value, hint, modifier) => {
    const item = createElement(ownerDoc, "div", "trace-summary__stat");
    if (modifier) {
      item.classList.add(modifier);
    }
    item.append(
      createElement(ownerDoc, "dt", "trace-summary__stat-term", term),
      createElement(ownerDoc, "dd", "trace-summary__stat-value", String(value)),
    );
    if (hint) {
      item.append(createElement(ownerDoc, "dd", "trace-summary__stat-hint", hint));
    }
    stats.append(item);
  };
  addStat("回放步骤", steps.length, "可逐步回放的日志条目");
  addStat("层级覆盖", `${coveredCount} / ${knownLayers.length || 7}`, "七层可观测模型");
  addStat("异常分支", exceptionBranches.length, "失败后按规则收敛的跳转");
  addStat(
    "时间跨度",
    `${formatTimestamp(trace.startedAt)} → ${formatTimestamp(trace.endedAt)}`,
    "固定 UTC 文本，便于复现截图",
    "trace-summary__stat--wide",
  );
  wrapper.append(stats);

  const coverage = createElement(ownerDoc, "div", "trace-summary__section");
  coverage.append(
    createElement(ownerDoc, "h4", "trace-summary__title", "七层覆盖"),
  );
  const coverageList = createElement(ownerDoc, "ul", "trace-coverage");
  for (const layer of knownLayers) {
    const count = steps.filter((step) => step.layer === layer.id).length;
    const item = createElement(
      ownerDoc,
      "li",
      "trace-coverage__item",
    );
    item.dataset.layer = String(layer.id);
    item.dataset.covered = String(count > 0);
    item.append(
      createElement(
        ownerDoc,
        "span",
        "trace-coverage__name",
        String(layer.label ?? layer.id),
      ),
      createElement(
        ownerDoc,
        "span",
        "trace-coverage__count",
        count > 0 ? `${count} 步` : "未覆盖",
      ),
    );
    coverageList.append(item);
  }
  coverage.append(coverageList);
  wrapper.append(coverage);

  if (exceptionBranches.length > 0) {
    const exception = createElement(ownerDoc, "div", "trace-summary__section trace-summary__section--exception");
    exception.append(
      createElement(ownerDoc, "h4", "trace-summary__title", "异常分支"),
    );
    for (const step of exceptionBranches) {
      const text = [
        step.branch.errorType ? `类型：${step.branch.errorType}` : null,
        step.branch.from || step.branch.to
          ? `路径：${step.branch.from ?? "?"} → ${step.branch.to ?? "?"}`
          : null,
        step.branch.handling ? `处置：${step.branch.handling}` : null,
      ]
        .filter(Boolean)
        .join("；");
      exception.append(
        createElement(ownerDoc, "p", "trace-summary__text", text || "未提供异常处置说明。"),
      );
    }
    wrapper.append(exception);
  }

  const summaryStep = steps.find((step) => step.layer === "summary");
  const artifacts = summaryStep ? safeArray(summaryStep.artifacts) : [];
  const nextActions = summaryStep ? safeArray(summaryStep.nextActions) : [];

  const addListSection = (title, values, modifier) => {
    if (values.length === 0) {
      return;
    }
    const section = createElement(
      ownerDoc,
      "div",
      `trace-summary__section trace-summary__section--${modifier}`,
    );
    section.append(createElement(ownerDoc, "h4", "trace-summary__title", title));
    const list = createElement(ownerDoc, "ul", "trace-summary__list");
    for (const value of values) {
      list.append(createElement(ownerDoc, "li", null, String(value)));
    }
    section.append(list);
    wrapper.append(section);
  };
  addListSection("最终产出 artifacts", artifacts, "artifacts");
  addListSection("后续动作 nextActions", nextActions, "next");

  if (artifacts.length === 0 && nextActions.length === 0) {
    wrapper.append(
      createElement(
        ownerDoc,
        "p",
        "trace-summary__text",
        "汇总步骤尚未就绪；完整轨迹请前往执行轨迹页查看。",
      ),
    );
  }

  return wrapper;
}
