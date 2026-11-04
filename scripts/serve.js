/**
 * 零依赖静态服务器：用 node:http + node:fs 提供仓库根目录下的静态资源。
 *
 * 用法：
 *   npm run serve                 # 默认 http://127.0.0.1:8000/
 *   PORT=9000 npm run serve       # 自定义端口
 *
 * 行为：
 *   - 目录请求返回该目录下的 index.html（仓库根目录 / 即首页）；
 *   - 根据扩展名返回正确的 MIME，文本类型带 charset=utf-8；
 *   - 拒绝路径穿越（含编码后的 .. 与绝对路径），越界返回 403；
 *   - 仅允许 GET / HEAD，其余方法返回 405；不存在的资源返回 404。
 */

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** 站点根目录（仓库根目录）。 */
export const SITE_ROOT = resolve(MODULE_DIR, "..");

/** 默认端口，可用 PORT 环境变量覆盖。 */
export const DEFAULT_PORT = 8000;

/** 扩展名 → Content-Type。 */
export const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/**
 * 根据文件扩展名返回 MIME 类型，未知类型回退 octet-stream。
 * @param {string} filePath
 * @returns {string}
 */
export function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * 把请求 URL 解析为根目录内的绝对文件路径；越界或非法返回 null。
 * @param {string} rootDir 站点根目录
 * @param {string} requestUrl 原始请求 URL（已编码）
 * @returns {string | null}
 */
export function resolveRequestPath(rootDir, requestUrl) {
  const root = resolve(rootDir);

  // 先用原始 URL 检查穿越：WHATWG URL 会把 %2e%2e 当作 .. 归一化，若只看
  // pathname 会漏掉 `/../package.json` 这类请求，因此这里直接检查解码后的原始路径。
  const rawPath = String(requestUrl ?? "/").split(/[?#]/, 1)[0] || "/";
  let decodedRawPath;
  try {
    decodedRawPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decodedRawPath.includes("\0")) {
    return null;
  }
  const rawSegments = decodedRawPath
    .replace(/^[/\\]+/, "")
    .split(/[/\\]+/);
  if (rawSegments.includes("..")) {
    return null;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  if (pathname.includes("\0")) {
    return null;
  }

  const relativePath = normalize(pathname).replace(/^[/\\]+/, "");
  const filePath = resolve(root, relativePath);

  if (filePath === root) {
    return root;
  }
  if (!filePath.startsWith(root + sep)) {
    return null;
  }
  return filePath;
}

function sendText(response, statusCode, message, method, headers = {}) {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  response.end(method === "HEAD" ? undefined : body);
}

function handleRequest(root, request, response) {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    sendText(response, 405, "Method Not Allowed", method, { Allow: "GET, HEAD" });
    return;
  }

  const requestedPath = resolveRequestPath(root, request.url ?? "/");
  if (!requestedPath) {
    sendText(response, 403, "Forbidden", method);
    return;
  }

  let filePath = requestedPath;
  try {
    if (statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    const fileInfo = statSync(filePath);
    if (!fileInfo.isFile()) {
      sendText(response, 404, "Not Found", method);
      return;
    }

    response.writeHead(200, {
      "Content-Type": getMimeType(filePath),
      "Content-Length": fileInfo.size,
      "Cache-Control": "no-cache",
    });
    if (method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath)
      .on("error", () => {
        if (!response.headersSent) {
          sendText(response, 500, "Internal Server Error", method);
        } else {
          response.destroy();
        }
      })
      .pipe(response);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      sendText(response, 404, "Not Found", method);
      return;
    }
    sendText(response, 500, "Internal Server Error", method);
  }
}

/**
 * 创建静态服务器实例（不自动监听）。
 * @param {{ root?: string }} [options]
 */
export function createStaticServer({ root = SITE_ROOT } = {}) {
  return createServer((request, response) => handleRequest(root, request, response));
}

function resolvePort(rawPort) {
  if (rawPort === undefined || rawPort === "") {
    return DEFAULT_PORT;
  }
  const port = Number(rawPort);
  if (Number.isInteger(port) && port >= 0 && port <= 65535) {
    return port;
  }
  console.warn(`PORT="${rawPort}" 不是合法端口，回退到默认端口 ${DEFAULT_PORT}。`);
  return DEFAULT_PORT;
}

/**
 * 启动静态服务器并打印访问地址。
 * @param {{ port?: number, host?: string, root?: string }} [options]
 */
export function startServer({
  port = resolvePort(process.env.PORT),
  host = process.env.HOST || "127.0.0.1",
  root = SITE_ROOT,
} = {}) {
  const server = createStaticServer({ root });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.error(`端口 ${port} 已被占用，可通过 PORT 环境变量指定其他端口。`);
    } else {
      console.error(`静态服务器启动失败：${error?.message ?? error}`);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    const displayHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
    console.log(
      `Super-Agent 工单自动化编排演示 · 静态服务器已启动: http://${displayHost}:${actualPort}/`,
    );
  });

  return server;
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

if (isDirectExecution()) {
  startServer();
}
