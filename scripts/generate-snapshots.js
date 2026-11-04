/**
 * 标准样例工单 / 执行轨迹的快照生成器。
 *
 * 快照内容直接来自 `scripts/trace-data.js` 的 SAMPLE_TICKET / SAMPLE_TRACE，
 * 不手工复制；`serializeSnapshot` 统一使用 2 空格缩进并保留行尾换行，保证快照
 * 可稳定 diff、可逐字节比较。
 *
 * 用法：
 *   node scripts/generate-snapshots.js   # 生成并写入 tests/snapshots/
 *   npm run snapshots
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SAMPLE_TICKET, SAMPLE_TRACE } from "./trace-data.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** 快照输出目录（仓库内 tests/snapshots）。 */
export const SNAPSHOT_DIR = resolve(MODULE_DIR, "..", "tests", "snapshots");

/** 快照文件名映射：ticket → 样例工单，trace → 样例轨迹。 */
export const SNAPSHOT_FILES = {
  ticket: "sample-ticket.json",
  trace: "sample-trace.json",
};

/**
 * 把快照值序列化为可 diff 的 JSON 文本（末尾保留换行）。
 * @param {unknown} value
 * @returns {string}
 */
export function serializeSnapshot(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * 构建快照映射：文件名 → 快照值。
 * 返回深拷贝，避免调用方修改快照时反向污染数据模块的常量。
 * @returns {Record<string, object>}
 */
export function buildSnapshots() {
  return {
    [SNAPSHOT_FILES.ticket]: JSON.parse(JSON.stringify(SAMPLE_TICKET)),
    [SNAPSHOT_FILES.trace]: JSON.parse(JSON.stringify(SAMPLE_TRACE)),
  };
}

/**
 * 生成并写入 tests/snapshots/ 下的快照文件。
 * @returns {string[]} 相对仓库根目录的写入路径，如 "tests/snapshots/sample-ticket.json"
 */
export function writeSnapshots() {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const written = [];
  for (const [fileName, value] of Object.entries(buildSnapshots())) {
    // 显式使用 LF：Windows 上默认换行为 CRLF，会让「代码生成结果」与
    // 「已提交快照」跨平台不一致，进而让 CI 的快照校验必然失败。
    writeFileSync(
      join(SNAPSHOT_DIR, fileName),
      serializeSnapshot(value),
      { encoding: "utf8", newline: "\n" },
    );
    written.push(`tests/snapshots/${fileName}`);
  }
  return written;
}

function isDirectExecution() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

// 直接执行时生成快照；被测试导入时不产生副作用。
if (isDirectExecution()) {
  const written = writeSnapshots();
  for (const filePath of written) {
    console.log(`generated ${filePath}`);
  }
}
