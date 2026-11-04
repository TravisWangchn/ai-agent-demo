/**
 * 轨迹回放状态机（纯逻辑，不依赖 DOM，也不创建任何定时器）。
 *
 * 浏览器中由 `scripts/trace-page.js` 用 setInterval 驱动 `next()`，到达末尾后自行
 * `pause()`；node:test 可直接创建实例并断言状态迁移。这样回放时钟与状态迁移解耦，
 * 测试不依赖真实时间，也不需要 fake timer。
 *
 * 状态约定：
 *   - cursor 表示「已展示步数」，取值范围 1..total；空轨迹（total=0）时为 0。
 *   - playing 只由 play / pause / toggle / reset 改变，不隐含自动暂停。
 *   - 只有状态真正变化时才通知订阅者；非法 seek 返回 false 且不改变状态。
 */

const DEFAULT_INTERVAL_MS = 1200;

export class TracePlayback {
  #total;
  #cursor;
  #playing = false;
  #intervalMs;
  #listeners = new Set();

  /**
   * @param {number} totalSteps 轨迹总步数（非负整数；页面用 trace.steps.length）
   * @param {{ initial?: number, intervalMs?: number }} [options]
   */
  constructor(totalSteps, options = {}) {
    if (typeof totalSteps !== "number" || !Number.isFinite(totalSteps) || totalSteps < 0) {
      throw new TypeError("TracePlayback 的 totalSteps 应为非负有限数字");
    }

    const settings = options ?? {};
    this.#total = Math.floor(totalSteps);
    this.#intervalMs =
      typeof settings.intervalMs === "number" &&
      Number.isFinite(settings.intervalMs) &&
      settings.intervalMs > 0
        ? settings.intervalMs
        : DEFAULT_INTERVAL_MS;
    this.#cursor = this.#clampCursor(settings.initial ?? 1);
  }

  /** 轨迹总步数。 */
  get total() {
    return this.#total;
  }

  /** 已展示步数：1..total；空轨迹为 0。 */
  get cursor() {
    return this.#cursor;
  }

  /** 是否处于播放态（不创建定时器，只描述状态）。 */
  get playing() {
    return this.#playing;
  }

  /** 自动播放建议间隔（毫秒），由页面决定是否使用。 */
  get intervalMs() {
    return this.#intervalMs;
  }

  /** 开始播放；已在播放态时无变化、不通知。 */
  play() {
    if (this.#playing) {
      return;
    }
    this.#playing = true;
    this.#emit();
  }

  /** 暂停播放；已暂停时无变化、不通知。 */
  pause() {
    if (!this.#playing) {
      return;
    }
    this.#playing = false;
    this.#emit();
  }

  /** 在播放/暂停之间切换。 */
  toggle() {
    if (this.#playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** 前进一步；已到末尾时保持不动。 */
  next() {
    this.#moveTo(this.#cursor + 1);
  }

  /** 后退一步；已在起点时保持不动。 */
  prev() {
    this.#moveTo(this.#cursor - 1);
  }

  /** 回到起点并停止播放。 */
  reset() {
    const target = this.#minCursor();
    const changed = this.#cursor !== target || this.#playing;
    this.#cursor = target;
    this.#playing = false;
    if (changed) {
      this.#emit();
    }
  }

  /**
   * 跳到指定步，自动夹紧到合法范围。
   * 非法输入（NaN、Infinity、null、字符串、对象等）不改变状态并返回 false。
   * @param {number} stepNumber
   * @returns {boolean} 输入是否合法（合法但未变化时同样返回 true）
   */
  seek(stepNumber) {
    if (
      typeof stepNumber !== "number" ||
      !Number.isFinite(stepNumber) ||
      this.#total === 0
    ) {
      return false;
    }
    this.#moveTo(Math.floor(stepNumber));
    return true;
  }

  /**
   * 当前状态快照（新对象，调用方修改不会影响内部状态）。
   * progress：首步 0、末步 1；单步轨迹视为已完成（1）；空轨迹 0。
   * @returns {{ cursor: number, total: number, playing: boolean, progress: number, atStart: boolean, atEnd: boolean }}
   */
  getSnapshot() {
    const total = this.#total;
    const cursor = this.#cursor;
    const progress =
      total === 0
        ? 0
        : total === 1
          ? 1
          : (cursor - 1) / (total - 1);

    return {
      cursor,
      total,
      playing: this.#playing,
      progress,
      atStart: cursor <= this.#minCursor(),
      atEnd: cursor >= this.#maxCursor(),
    };
  }

  /**
   * 订阅状态变化。
   * @param {(snapshot: ReturnType<TracePlayback["getSnapshot"]>) => void} listener
   * @returns {() => void} 退订函数
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("TracePlayback.subscribe 需要函数类型的监听器");
    }
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #minCursor() {
    return this.#total === 0 ? 0 : 1;
  }

  #maxCursor() {
    return this.#total;
  }

  #clampCursor(value) {
    if (this.#total === 0) {
      return 0;
    }
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 1;
    }
    return Math.min(this.#maxCursor(), Math.max(this.#minCursor(), Math.floor(value)));
  }

  #moveTo(target) {
    const nextCursor = Math.min(this.#maxCursor(), Math.max(this.#minCursor(), target));
    if (nextCursor === this.#cursor) {
      return;
    }
    this.#cursor = nextCursor;
    this.#emit();
  }

  #emit() {
    const snapshot = this.getSnapshot();
    for (const listener of [...this.#listeners]) {
      listener(snapshot);
    }
  }
}
