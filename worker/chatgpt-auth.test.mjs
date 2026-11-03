import test from "node:test";
import assert from "node:assert/strict";
import { createChatGPTAuth } from "./chatgpt-auth.mjs";

test("extracted OAuth domain preserves injected store identity, public redaction and unavailable session behavior", async () => {
  let value = null,
    reads = 0,
    deletes = 0;
  const store = {
    available: false,
    read() {
      reads++;
      return value;
    },
    write() {
      throw Error("Unexpected write");
    },
    delete() {
      deletes++;
      value = null;
    },
  };
  const auth = createChatGPTAuth(
    () => ({ dataRoot: "/synthetic-only", host: "127.0.0.1", port: 8987, betaRuntime: { name: "Synthetic Beta" } }),
    {
      createStore: ({ dataRoot }) => {
        assert.equal(dataRoot, "/synthetic-only");
        return store;
      },
    },
  );
  assert.equal(auth.chatGPTStore, store);
  assert.equal(reads, 0);
  assert.deepEqual(auth.publicChatGPTSession(null), { available: false, connected: false, sharing: false });
  await assert.rejects(auth.startChatGPTAuthorization(), /kho lưu phiên/);
  assert.equal(reads, 0);
  await assert.rejects(auth.activeChatGPTCredentials(), /AUTH_REQUIRED/);
  value = {
    access_token: "SYNTHETIC-SECRET",
    refresh_token: "SYNTHETIC-REFRESH",
    scopes: ["chatgpt.tokens.use.direct"],
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    email: "fixture@example.test",
  };
  assert.equal(await auth.activeChatGPTCredentials(), value);
  const publicValue = JSON.stringify(auth.publicChatGPTSession(value));
  assert.doesNotMatch(publicValue, /SYNTHETIC/);
  assert.match(publicValue, /fixture@example.test/);
  auth.pendingChatGPTAuth.add({ state: "synthetic" });
  auth.pendingChatGPTAuth.take("synthetic");
  assert.throws(() => auth.pendingChatGPTAuth.take("synthetic"));
  auth.deleteChatGPTCredentials();
  assert.equal(deletes, 1);
  assert.equal(value, null);
});
