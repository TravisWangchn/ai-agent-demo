import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SNAPSHOT_FILES,
  SNAPSHOT_DIR,
  buildSnapshots,
  serializeSnapshot,
  writeSnapshots,
} from "../scripts/generate-snapshots.js";
import { SAMPLE_TICKET, SAMPLE_TRACE } from "../scripts/trace-data.js";

const SNAPSHOT_HINT =
  "快照与代码生成结果不一致：请运行 `npm run snapshots` 重新生成，并提交 tests/snapshots/ 下的差异。";

/** 上一步比较是否通过；未通过时禁止覆盖已提交快照。 */
let comparisonPassed = false;

/**
 * 归一化换行符：把 CRLF / CR 统一成 LF。
 *
 * 快照必须逐字节可复现，但平台的默认换行（Windows CRLF / POSIX LF）
 * 不应导致误报——仓库通过 .gitattributes 把快照固定为 eol=lf，
 * 这里再做一次归一化，保证即便检出时被改写也不会误判为内容漂移。
 */
function normalizeNewlines(text) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

test("serializeSnapshot 输出稳定、可 diff 的 JSON 文本", () => {
  assert.equal(serializeSnapshot({ a: 1 }), '{\n  "a": 1\n}\n');
  assert.equal(serializeSnapshot([]), "[]\n");
  assert.equal(serializeSnapshot({}), "{}\n");
  assert.ok(serializeSnapshot({ a: 1, b: [1, 2] }).endsWith("\n"));
});

test("buildSnapshots 直接来自样例工单与样例轨迹", () => {
  const snapshots = buildSnapshots();
  assert.deepEqual(Object.keys(snapshots).sort(), [
    SNAPSHOT_FILES.ticket,
    SNAPSHOT_FILES.trace,
  ]);
  assert.deepEqual(snapshots[SNAPSHOT_FILES.ticket], SAMPLE_TICKET);
  assert.deepEqual(snapshots[SNAPSHOT_FILES.trace], SAMPLE_TRACE);
  assert.notEqual(
    snapshots[SNAPSHOT_FILES.ticket],
    SAMPLE_TICKET,
    "快照应为独立副本，避免调用方修改常量",
  );
});

test("已提交快照与当前代码生成结果逐字节一致", () => {
  const snapshots = buildSnapshots();

  for (const [fileName, value] of Object.entries(snapshots)) {
    const snapshotPath = join(SNAPSHOT_DIR, fileName);
    let committed;
    try {
      committed = readFileSync(snapshotPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        assert.fail(
          `缺少已提交快照 tests/snapshots/${fileName}：请运行 \`npm run snapshots\` 生成并提交。`,
        );
      }
      throw error;
    }

    assert.equal(
      normalizeNewlines(committed),
      serializeSnapshot(value),
      `${fileName} 不一致。${SNAPSHOT_HINT}`,
    );
  }

  comparisonPassed = true;
});

test("比较通过后由测试落库快照，且内容可被 JSON 解析", () => {
  assert.ok(
    comparisonPassed,
    "快照比较未通过，拒绝覆盖 tests/snapshots/ 下的已提交快照",
  );

  const written = writeSnapshots();
  assert.ok(Array.isArray(written));
  assert.equal(written.length, 2);
  assert.deepEqual(
    written.map((filePath) => filePath.replaceAll("\\", "/")).sort(),
    [
      `tests/snapshots/${SNAPSHOT_FILES.ticket}`,
      `tests/snapshots/${SNAPSHOT_FILES.trace}`,
    ].sort(),
    "writeSnapshots 应返回 tests/snapshots/ 下的相对路径",
  );

  const expected = buildSnapshots();
  for (const [fileName, value] of Object.entries(expected)) {
    const content = readFileSync(join(SNAPSHOT_DIR, fileName), "utf8");
    assert.equal(normalizeNewlines(content), serializeSnapshot(value));
    assert.ok(content.endsWith("\n"));

    const parsed = JSON.parse(content);
    assert.deepEqual(parsed, value);
  }

  const ticketSnapshot = JSON.parse(
    readFileSync(join(SNAPSHOT_DIR, SNAPSHOT_FILES.ticket), "utf8"),
  );
  assert.equal(ticketSnapshot.id, "issue-11");
  assert.equal(ticketSnapshot.number, 11);
  assert.equal(ticketSnapshot.author, "TravisWangchn");

  const traceSnapshot = JSON.parse(
    readFileSync(join(SNAPSHOT_DIR, SNAPSHOT_FILES.trace), "utf8"),
  );
  assert.equal(traceSnapshot.id, "trace-issue-11");
  assert.equal(traceSnapshot.ticketId, ticketSnapshot.id);
  assert.equal(traceSnapshot.steps.length, SAMPLE_TRACE.steps.length);
  assert.ok(traceSnapshot.steps.length >= 18);

  const layerIds = new Set(traceSnapshot.steps.map((step) => step.layer));
  assert.equal(layerIds.size, 7, "快照中的轨迹应覆盖全部 7 层");
});
