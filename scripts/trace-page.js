/**
 * 执行轨迹页浏览器入口。
 *
 * 职责：
 * - 渲染工单卡、七层图例与时间线（渲染细节在 trace-render.js）；
 * - 用 TracePlayback 管理回放状态，用 setInterval 驱动自动播放；
 * - 绑定播放/暂停、上一步、下一步、重置、range seek；
 * - 跨重渲染保留 plan 子任务 <details> 的折叠状态；
 * - 暴露 destroy() 清理 interval 与事件监听。
 *
 * 本文件只在浏览器运行，不 import 任何 node: 模块。
 */

import { SAMPLE_TICKET, SAMPLE_TRACE, TRACE_LAYERS } from "./trace-data.js";
import { TracePlayback } from "./trace-playback.js";
import {
  renderLayerLegend,
  renderTicketCard,
  renderTraceTimeline,
} from "./trace-render.js";

/** 自动播放间隔（毫秒）。 */
const PLAYBACK_INTERVAL_MS = 1200;

/** 当前页面控制器，供 destroy() 与 pagehide 使用。 */
let activeController = null;

/**
 * 初始化轨迹页。
 * @param {Document|HTMLElement} [root]
 * @returns {{ destroy: () => void, playback?: InstanceType<typeof TracePlayback> }}
 */
export function initTracePage(root = document) {
  const ownerDocument = root.ownerDocument ?? root;
  const timelineHost = root.querySelector("[data-trace-timeline]");

  if (!timelineHost) {
    return { destroy() {} };
  }

  const trace = SAMPLE_TRACE;
  const steps = Array.isArray(trace && trace.steps)
    ? trace.steps.filter((step) => step && typeof step === "object")
    : [];

  if (steps.length === 0) {
    timelineHost.replaceChildren(
      createMessage(ownerDocument, "轨迹数据缺失，暂时无法回放。"),
    );
    return { destroy() {} };
  }

  const ticketHost = root.querySelector("[data-trace-ticket]");
  const legendHost = root.querySelector("[data-trace-legend]");
  if (ticketHost) {
    ticketHost.replaceChildren(renderTicketCard(ownerDocument, SAMPLE_TICKET));
  }
  if (legendHost) {
    legendHost.replaceChildren(renderLayerLegend(ownerDocument, TRACE_LAYERS));
  }

  const playButton = root.querySelector("[data-playback-play]");
  const prevButton = root.querySelector("[data-playback-prev]");
  const nextButton = root.querySelector("[data-playback-next]");
  const resetButton = root.querySelector("[data-playback-reset]");
  const range = root.querySelector("[data-playback-range]");
  const count = root.querySelector("[data-playback-count]");
  const announcer = root.querySelector("[data-playback-announcer]");
  const progressBar = root.querySelector("[data-playback-progress]");

  const playback = new TracePlayback(steps.length, {
    initial: 1,
    intervalMs: PLAYBACK_INTERVAL_MS,
  });
  const collapsed = new Set();
  const cleanups = [];
  let timerId = null;

  const addListener = (target, type, handler, options) => {
    if (!target) {
      return;
    }
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  if (range) {
    range.min = "1";
    range.max = String(steps.length);
    range.value = "1";
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const snapshot = playback.getSnapshot();
      if (!snapshot.playing) {
        stopTimer();
        return;
      }
      if (snapshot.atEnd) {
        stopTimer();
        playback.pause();
        return;
      }
      playback.next();
      if (playback.getSnapshot().atEnd) {
        stopTimer();
        playback.pause();
      }
    }, PLAYBACK_INTERVAL_MS);
  }

  function updateInterface(snapshot) {
    timelineHost.replaceChildren(
      renderTraceTimeline(ownerDocument, trace, {
        visibleCount: snapshot.cursor,
        collapsed,
      }),
    );

    if (playButton) {
      playButton.textContent = snapshot.playing ? "暂停" : "播放";
      playButton.setAttribute("aria-pressed", String(snapshot.playing));
      playButton.dataset.playing = String(snapshot.playing);
      playButton.setAttribute(
        "aria-label",
        snapshot.playing ? "暂停自动回放" : "播放自动回放",
      );
    }
    if (prevButton) {
      prevButton.disabled = snapshot.atStart;
    }
    if (nextButton) {
      nextButton.disabled = snapshot.atEnd;
    }
    if (resetButton) {
      resetButton.disabled = snapshot.atStart && !snapshot.playing;
    }
    if (range) {
      range.value = String(snapshot.cursor);
      range.setAttribute(
        "aria-valuetext",
        `第 ${snapshot.cursor} 步，共 ${snapshot.total} 步`,
      );
    }
    if (count) {
      count.textContent = `${snapshot.cursor} / ${snapshot.total}`;
    }
    if (progressBar) {
      progressBar.style.setProperty(
        "--seek-progress",
        `${Math.round(snapshot.progress * 100)}%`,
      );
    }
    if (announcer) {
      announcer.textContent = `第 ${snapshot.cursor} 步，共 ${snapshot.total} 步${
        snapshot.playing ? "，正在自动播放" : ""
      }`;
    }
  }

  const unsubscribe = playback.subscribe(updateInterface);
  updateInterface(playback.getSnapshot());

  addListener(playButton, "click", () => {
    const snapshot = playback.getSnapshot();
    if (snapshot.playing) {
      stopTimer();
      playback.pause();
      return;
    }
    if (snapshot.atEnd) {
      playback.seek(1);
    }
    playback.play();
    startTimer();
  });

  addListener(prevButton, "click", () => {
    playback.prev();
  });

  addListener(nextButton, "click", () => {
    playback.next();
    const snapshot = playback.getSnapshot();
    if (snapshot.playing && snapshot.atEnd) {
      stopTimer();
      playback.pause();
    }
  });

  addListener(resetButton, "click", () => {
    stopTimer();
    playback.reset();
  });

  addListener(range, "input", () => {
    const value = Number(range.value);
    playback.seek(value);
  });

  // toggle 不冒泡，用捕获阶段记录用户对 plan 子任务的折叠选择。
  addListener(
    timelineHost,
    "toggle",
    (event) => {
      const target = event.target;
      if (!target || target.tagName !== "DETAILS") {
        return;
      }
      const key = target.dataset.subtaskKey;
      if (!key) {
        return;
      }
      if (target.open) {
        collapsed.delete(key);
      } else {
        collapsed.add(key);
      }
    },
    true,
  );

  const controller = {
    playback,
    destroy() {
      stopTimer();
      unsubscribe();
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };

  return controller;
}

function createMessage(doc, text) {
  const paragraph = doc.createElement("p");
  paragraph.className = "trace-empty";
  paragraph.textContent = text;
  return paragraph;
}

/**
 * 清理当前轨迹页实例（主要给 pagehide / 测试使用）。
 */
export function destroy() {
  if (activeController) {
    activeController.destroy();
    activeController = null;
  }
}

// 模块脚本天然 defer，执行时 DOM 已就绪。
if (typeof document !== "undefined") {
  activeController = initTracePage(document);
  window.addEventListener("pagehide", () => destroy());
}
