import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatGPTStore } from './chatgpt-store.mjs';

const helper = 'C:\\Program Files\\ShortCut Studio\\chatgpt-credential-store.exe';
const dataRoot = 'C:\\Users\\Test User\\AppData\\Local\\ShortCut Studio\\media';
const fake = { client_id: 'oaiapp_fake_qa', access_token: 'FAKE-QA-ACCESS', refresh_token: 'FAKE-QA-REFRESH', scopes: ['chatgpt.tokens.use.direct'] };
test('Windows uses private stdin, not token argv or a shell; reconnect survives a new store', () => {
  const calls = []; let saved = null;
  const execute = (binary, args, options) => {
    calls.push(args[0]); assert.equal(binary, helper);
    assert.ok(args[1].endsWith('media\\chatgpt-credentials.dpapi'));
    assert.ok(!args.join(' ').includes('FAKE-QA')); assert.equal(options.shell, undefined); assert.equal(options.windowsHide, true);
    if (args[0] === 'write') saved = JSON.parse(options.input);
    if (args[0] === 'delete') saved = null;
    return { status: 0, stdout: JSON.stringify(saved) };
  };
  const options = { dataRoot, platform: 'win32', env: { CHATGPT_CREDENTIAL_HELPER: helper }, exists: () => true, execute };
  const store = createChatGPTStore(options);
  assert.equal(store.available, true); assert.equal(store.read(), null);
  store.write(fake); assert.deepEqual(createChatGPTStore(options).read(), fake);
  const rotated = { ...fake, access_token: 'FAKE-QA-NEW', refresh_token: 'FAKE-QA-ROTATED' };
  store.write(rotated); assert.deepEqual(store.read(), rotated);
  assert.equal(store.delete(), true); assert.equal(store.read(), null);
  assert.deepEqual(calls, ['read', 'write', 'read', 'write', 'read', 'delete', 'read']);
});
test('Windows storage corruption, OS denial and spawn failures fail closed without leaking output', () => {
  for (const result of [{ status: 1, stderr: 'private token FAKE-QA' }, { status: null, error: new Error('private token FAKE-QA') }, { status: 0, stdout: 'FAKE-QA invalid JSON' }, { status: 0, stdout: '[]' }]) {
    const store = createChatGPTStore({ dataRoot, platform: 'win32', env: { CHATGPT_CREDENTIAL_HELPER: helper }, exists: () => true, execute: () => result });
    assert.throws(() => store.read(), (error) => !error.message.includes('FAKE-QA'));
  }
});
test('missing Windows helper never falls back to plaintext or macOS Keychain', () => {
  const store = createChatGPTStore({ dataRoot, platform: 'win32', env: {}, exists: () => true, execute: () => assert.fail('must not start a process') });
  assert.equal(store.available, false); assert.equal(store.read(), null); assert.equal(store.delete(), false);
  assert.throws(() => store.write(fake), /cập nhật app/);
});
test('macOS retains the exact existing app-specific Keychain service/account', () => {
  const store = createChatGPTStore({ dataRoot: '/tmp/fake', platform: 'darwin', env: {}, exists: () => true,
    execute: (binary, args) => {
      assert.equal(binary, '/usr/bin/security');
      assert.equal(args[args.indexOf('-s') + 1], 'ShortCut Studio ChatGPT');
      assert.equal(args[args.indexOf('-a') + 1], 'default');
      return { status: 0, stdout: JSON.stringify(fake) };
    },
  });
  assert.equal(store.available, true); assert.deepEqual(store.read(), fake); store.write(fake); assert.equal(store.delete(), true);
});
test('missing macOS credential is disconnected, not a fabricated successful session', () => {
  const store = createChatGPTStore({ dataRoot: '/tmp/fake', platform: 'darwin', env: {}, exists: () => true, execute: () => ({ status: 44 }) });
  assert.equal(store.read(), null); assert.equal(store.delete(), false);
});
