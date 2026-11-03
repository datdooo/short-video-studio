import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewDecks } from "./preview-decks.mjs";
class Video extends EventTarget {
  currentTime = 0;
  readyState = 4;
  seeking = false;
  paused = true;
  muted = false;
  ended = false;
  src = "";
  loads = 0;
  plays = 0;
  getAttribute(name) {
    return name === "src" ? this.src || null : null;
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
  load() {
    this.loads++;
  }
  pause() {
    this.paused = true;
  }
  play() {
    this.plays++;
    this.paused = false;
    return this.pending || Promise.resolve();
  }
}
function fixture(videos = [new Video(), new Video()], start = 1) {
  const events = [];
  return {
    videos,
    events,
    controller: createPreviewDecks({
      videos,
      url: "synthetic-source",
      segments: [
        { start, end: start + 2 },
        { start: start + 4, end: start + 6 },
      ],
      onActive: (...a) => events.push(["active", ...a]),
      onClock: (t) => events.push(["clock", t]),
      onBuffer: (v) => events.push(["buffer", v]),
      onError: (m) => events.push(["error", m]),
      onEnded: () => events.push(["ended"]),
    }),
  };
}
test("pause during pending preview play stops late completion and keeps source clock", async () => {
  const f = fixture();
  let finish;
  f.videos[0].pending = new Promise((r) => (finish = r));
  const pending = f.controller.play();
  f.controller.pause();
  finish();
  await pending;
  assert.equal(f.videos[0].paused, true);
  assert.equal(f.controller.clock(), 0);
  f.controller.dispose();
});
test("source/part ownership replacement suppresses old callbacks and does not autoplay the new decks", async () => {
  const old = fixture();
  let finish;
  old.videos[0].pending = new Promise((r) => (finish = r));
  const pending = old.controller.play();
  old.controller.dispose();
  const current = fixture(old.videos, 10);
  const before = structuredClone(current.events);
  finish();
  await pending;
  old.controller.tick();
  old.controller.seek(1);
  assert.deepEqual(current.events, before);
  assert.equal(current.videos[0].paused, true);
  assert.equal(current.videos[0].currentTime, 10);
  current.controller.dispose();
});
test("handoff uses next source range; disposed deck removes handlers and cannot start again", async () => {
  const f = fixture();
  await f.controller.play();
  f.videos[1].dispatchEvent(new Event("canplay"));
  f.videos[0].currentTime = 3;
  f.controller.tick();
  assert.ok(f.events.some((e) => e[0] === "active" && e[1] === 1 && e[2] === 1));
  assert.equal(f.videos[1].currentTime, 5);
  f.controller.dispose();
  const count = f.events.length;
  f.videos[1].dispatchEvent(new Event("ended"));
  await f.controller.play();
  assert.equal(f.events.length, count);
  assert.equal(f.videos[1].paused, true);
});
