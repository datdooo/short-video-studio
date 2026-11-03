import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestOriginPolicy} from './request-origin.mjs';

const policy = createRequestOriginPolicy({webPort: 5373, workerPort: 8987});
const request = (headers = {}, method = 'POST') => ({method, headers: {host: '127.0.0.1:8987', ...headers}});
const forbidden = (headers, pathname = '/api/jobs', method) => {
  assert.throws(() => policy.assert(request(headers, method), pathname), error => error.status === 403);
};

test('Host must be loopback on the configured worker port, including callback-looking paths and static GET', () => {
  for (const host of ['example.com:8987', '127.0.0.1:8787', 'localhost:5373', 'user@localhost:8987', 'localhost:8987/path']) {
    forbidden({host});
    forbidden({host}, '/auth/callback', 'GET');
    forbidden({host}, '/', 'GET');
  }
  for (const host of ['127.0.0.1:8987', 'localhost:8987']) {
    assert.doesNotThrow(() => policy.assert(request({host}), '/api/jobs'));
  }
});

test('mutation and API requests accept only exact configured local origins', () => {
  for (const origin of ['https://evil.example', 'http://localhost:8787', 'http://localhost:5373.evil.example', 'null']) forbidden({origin});
  for (const origin of ['http://127.0.0.1:5373', 'http://localhost:5373', 'http://127.0.0.1:8987', 'http://localhost:8987']) {
    assert.equal(policy.allowsOrigin(origin), true);
    assert.doesNotThrow(() => policy.assert(request({origin}), '/api/jobs'));
  }
  forbidden({origin: 'https://evil.example'}, '/api/source', 'GET');
  forbidden({origin: 'https://evil.example'}, '/upload', 'PUT');
});

test('cross-site browsers cannot omit Origin to bypass checks; local media Referer remains valid', () => {
  for (const referer of [undefined, '', 'not a URL', 'https://evil.example/', 'http://localhost:5173/']) {
    forbidden({'sec-fetch-site': 'cross-site', ...(referer === undefined ? {} : {referer})});
  }
  for (const referer of ['http://localhost:5373/editor', 'http://127.0.0.1:5373/']) {
    assert.doesNotThrow(() => policy.assert(request({'sec-fetch-site': 'cross-site', referer}), '/api/source/media'));
  }
  assert.doesNotThrow(() => policy.assert(request(), '/api/jobs')); // Native/local callers.
});

test('no OAuth exception remains: callback-looking POST and API paths are forbidden cross-site', () => {
  const headers = {origin: 'https://provider.example', 'sec-fetch-site': 'cross-site'};
  forbidden(headers, '/auth/callback', 'POST');
  forbidden(headers, '/api/auth/callback', 'GET');
});

test('non-API GET/HEAD retain static-route behavior and invalid policy ports fail closed', () => {
  for (const method of ['GET', 'HEAD']) {
    assert.doesNotThrow(() => policy.assert(request({origin: 'https://other.example'}, method), '/static/asset'));
  }
  for (const workerPort of [0, 65536, 'bad']) assert.throws(() => createRequestOriginPolicy({webPort: 5373, workerPort}));
});
