import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { createRouter, routeTable } from "./routes/router.mjs";
import { createRequestHandler } from "./routes/http-handler.mjs";
import { createRequestOriginPolicy } from "./request-origin.mjs";
import { createHealthRoutes } from "./routes/health.mjs";
import { createCodexRoutes } from "./routes/codex.mjs";
import { createSourcesRoutes } from "./routes/sources.mjs";
import { createMusicRoutes } from "./routes/music.mjs";
import { createStorageRoutes } from "./routes/storage.mjs";
import { createBatchRoutes } from "./routes/batch.mjs";
import { createRenderRoutes } from "./routes/render.mjs";
const factories = [
  createHealthRoutes,
  createCodexRoutes,
  createSourcesRoutes,
  createMusicRoutes,
  createStorageRoutes,
  createBatchRoutes,
  createRenderRoutes,
];
test("route table preserves the captured order, exact conditions and regex matchers", async () => {
  const expected = JSON.parse(await readFile(new URL("./routes/route-table.snapshot.json", import.meta.url), "utf8"));
  assert.equal(expected.length, 41);
  assert.deepEqual(routeTable(factories.flatMap((f) => f({}))), expected);
  assert.throws(() => createRouter([{ order: 1 }, { order: 1 }]), /Duplicate/);
});
test("router stops after a handled undefined response, preserves order and never consumes unmatched bodies", async () => {
  const calls = [];
  const route = createRouter([
    {
      order: 4,
      handle: async () => {
        calls.push("later");
        return true;
      },
    },
    {
      order: 1,
      handle: async () => {
        calls.push("miss");
        return false;
      },
    },
    {
      order: 2,
      handle: async () => {
        calls.push("handled");
      },
    },
  ]);
  assert.equal(await route({}, {}, new URL("http://localhost/")), true);
  assert.deepEqual(calls, ["miss", "handled"]);
  assert.equal(await createRouter([])({}, {}, new URL("http://localhost/")), false);
});
function result() {
  return {
    status: null,
    body: null,
    send(_request, _response, status, body) {
      this.status = status;
      this.body = body;
    },
  };
}
test("representative existing handlers keep Codex status and missing job error contracts", async () => {
  const capture = result(),
    sendJson = capture.send.bind(capture),
    calls = [];
  const codex = createRouter(
    createCodexRoutes({
      codexStatus: async (options) => {
        calls.push(options);
        return { installed: true, loggedIn: true, version: "9.9.9", model: "gpt-6.1-terra", reasoning: "high" };
      },
      sendJson,
    }),
  );
  await codex({ method: "GET" }, {}, new URL("http://localhost/api/chatgpt/session?refresh=1"));
  assert.deepEqual(calls, [{ force: true }]);
  assert.equal(capture.status, 200);
  assert.deepEqual(capture.body.session, {
    available: true, connected: true, sharing: true, installed: true, version: "9.9.9", model: "gpt-6.1-terra", reasoning: "high",
  });
  await codex({ method: "GET" }, {}, new URL("http://localhost/api/codex/status"));
  assert.deepEqual(calls.at(-1), { force: false });
  for (const gone of ["/api/chatgpt/auth/start", "/api/chatgpt/auth/status", "/api/chatgpt/models", "/auth/callback"])
    assert.equal(await codex({ method: "POST" }, {}, new URL(`http://localhost${gone}`)), false, gone);
  const signedOut = createRouter(
    createCodexRoutes({ codexStatus: async () => ({ installed: true, loggedIn: false }), sendJson }),
  );
  await signedOut({ method: "GET" }, {}, new URL("http://localhost/api/codex/status"));
  assert.equal(capture.body.session.sharing, false);
  assert.match(capture.body.session.error, /codex login/);
  const render = createRouter(createRenderRoutes({ sendJson, assertId: (id) => id, jobs: new Map() }));
  await render({ method: "GET" }, {}, new URL("http://localhost/api/jobs/11111111-1111-4111-8111-111111111111"));
  assert.equal(capture.status, 404);
  assert.match(capture.body.error, /không tồn tại/);
});
async function withServer(run) {
  let hits = 0;
  const sendJson = (_q, r, status, body) => {
    r.writeHead(status, { "Content-Type": "application/json" });
    r.end(JSON.stringify(body));
  };
  const policy = createRequestOriginPolicy({ webPort: 5373, workerPort: 8987 });
  const handler = createRequestHandler({
    host: "127.0.0.1",
    port: 8987,
    requestOrigins: policy,
    corsHeaders: () => ({ "Access-Control-Allow-Origin": "http://127.0.0.1:5373" }),
    sendJson,
    dispatchRoutes: async (q, r, url) => {
      hits++;
      if (url.pathname === "/api/fail") throw Object.assign(Error("Synthetic body limit"), { status: 413 });
      if (url.pathname === "/missing") return false;
      sendJson(q, r, 200, { path: url.pathname });
      return true;
    },
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const call = (pathname, { method = "GET", headers = {}, body = "" } = {}) =>
    new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method,
          headers: {
            Host: "127.0.0.1:8987",
            ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
            ...headers,
          },
        },
        (response) => {
          let data = "";
          response.on("data", (c) => (data += c));
          response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: data }));
        },
      );
      request.on("error", reject);
      request.end(body);
    });
  try {
    await run(call, () => hits);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test("HTTP boundary enforces Host/Origin before mutation, keeps OPTIONS and JSON/raw upload policy", async () =>
  withServer(async (call, hits) => {
    let r = await call("/api/storage/delete", {
      method: "POST",
      headers: { Origin: "https://evil.test", "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(r.status, 403);
    assert.equal(hits(), 0);
    r = await call("/auth/callback", { headers: { Host: "evil.test:8987", Origin: "https://auth.openai.com" } });
    assert.equal(r.status, 403);
    assert.equal(hits(), 0);
    const before = hits();
    r = await call("/api/batches", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:5373" } });
    assert.equal(r.status, 204);
    assert.equal(hits(), before);
    assert.equal(r.headers["access-control-allow-origin"], "http://127.0.0.1:5373");
    r = await call("/api/batches", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(r.status, 415);
    assert.equal(hits(), before);
    r = await call("/api/sources/upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: "synthetic",
    });
    assert.equal(r.status, 200);
    r = await call("/api/fail");
    assert.equal(r.status, 413);
    assert.equal(JSON.parse(r.body).error, "Synthetic body limit");
    r = await call("/missing");
    assert.equal(r.status, 404);
    assert.equal(JSON.parse(r.body).error, "Route không tồn tại.");
  }));

test('composed worker routes retain shared dependencies and representative terminal handlers',async()=>{
 const {createWorkerRoutes}=await import('./routes/index.mjs');const capture=result();const dispatch=createWorkerRoutes({sendJson:capture.send.bind(capture),assertId:id=>id,jobs:new Map(),codexStatus:async()=>({installed:false,loggedIn:false})});
 await dispatch({method:'GET'},{},new URL('http://localhost/api/jobs/11111111-1111-4111-8111-111111111111'));assert.equal(capture.status,404);assert.match(capture.body.error,/không tồn tại/);
 await dispatch({method:'GET'},{},new URL('http://localhost/api/codex/status'));assert.equal(capture.status,200);assert.equal(capture.body.session.installed,false);assert.match(capture.body.session.error,/Codex/);
 assert.equal(await dispatch({method:'GET'},{},new URL('http://localhost/not-a-route')),false);
});
