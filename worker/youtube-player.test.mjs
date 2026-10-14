import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePlayer } from './youtube-player.mjs';

test('player evaluator supports the YouTube.js function-body/return contract', () => {
  const result = evaluatePlayer({ output: 'function decode(v) { return v.split("").reverse().join(""); } return { sig: decode("abc"), n: "valid" };' });
  assert.equal(result.sig, 'cba'); assert.equal(result.n, 'valid');
});
test('player context has no process, filesystem, fetch or dynamic code generation', () => {
  assert.equal(evaluatePlayer({ output: 'return [typeof process, typeof require, typeof fetch].join(",");' }), 'undefined,undefined,undefined');
  assert.throws(() => evaluatePlayer({ output: 'return this.constructor.constructor("return process")();' }), /Code generation/);
});
