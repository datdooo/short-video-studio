import test from "node:test";
import assert from "node:assert/strict";
import { parseWebJson } from "./web-json.mjs";
test("web clipboard wrappers/inline fences and outside-string Unicode spacing preserve exact values", () => {
  for (const raw of [
    'Lời dẫn\n```json\n{"id":"a","quote":"x } { y"}\n```\nGhi chú.',
    '```json{"id":"a","quote":"x } { y"}```',
    '{\n\u00a0\u200b"id":"a","quote":"x } { y"}',
  ])
    assert.deepEqual(parseWebJson(raw), { id: "a", quote: "x } { y" });
  assert.equal(parseWebJson('{"text":"a\u00a0b\u200bc"}').text, "a\u00a0b\u200bc");
});
test("ambiguous, truncated and invalid JSON reject without silent syntax repair or leaking source text", () => {
  assert.throws(() => parseWebJson('{"id":1} {"id":2}'), /nhiều/);
  assert.throws(
    () => parseWebJson('{"secret":"SOURCE_PRIVATE'),
    (e) => e.code === "WEB_JSON_INCOMPLETE" && !e.message.includes("SOURCE_PRIVATE"),
  );
  for (const raw of ['{"a":1,}', "{“a”:1}", '{"a":[1,]}'])
    assert.throws(
      () => parseWebJson(raw),
      (e) => e.code === "WEB_JSON_SYNTAX",
    );
  assert.throws(
    () => parseWebJson('{\n"secret":"SOURCE_PRIVATE",\n"bad":@}'),
    (e) => /dòng 3/.test(e.message) && !e.message.includes("SOURCE_PRIVATE"),
  );
});

test("escape sequences and braces inside quoted values do not split the object", () => {
  const value = { quote: 'He said "yes } {"', path: "C:\\tmp\\source", id: "request" };
  assert.deepEqual(parseWebJson('Ghi chú "chưa đóng\n```json' + JSON.stringify(value) + "```"), value);
});
