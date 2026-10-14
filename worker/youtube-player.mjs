import vm from 'node:vm';

// YouTube.js supplies a function BODY (including `return`), not a script.
// Do not execute it in the worker's Node/global scope or expose its credentials.
export function evaluatePlayer(data) {
  if (typeof data.output !== 'string' || data.output.length > 5 * 1024 * 1024) throw new Error('Invalid player script');
  return new vm.Script(`(function() {\n${data.output}\n})()`).runInNewContext(Object.create(null), {
    timeout: 1500, contextCodeGeneration: { strings: false, wasm: false },
  });
}
