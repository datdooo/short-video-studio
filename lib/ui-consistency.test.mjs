import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
async function sources(folder) {
  const entries = await readdir(new URL(folder, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sources(`${folder}/${entry.name}`)
    : entry.name.endsWith('.tsx') ? [`${folder}/${entry.name}`] : []));
  return nested.flat();
}
function openings(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result.map((node) => ({
    tag: node.tagName.getText(tree),
    attrs: Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map((attr) =>
      [attr.name.getText(tree), attr.initializer?.getText(tree)])),
  }));
}

// Layout exceptions are deliberately enumerated, counted and explained in each
// source file. Adding data-ui-exception to a new raw button does not bypass this guard.
const exceptions = {
  'components/background-panel.tsx': { 'sample-card': 1 },
  'components/overlay-panel.tsx': { 'sample-card': 1 },
  'components/text-style-panel.tsx': { 'sample-card': 1 },
  'components/video-filter-panel.tsx': { 'sample-card': 1 },
  'components/visual-template-panel.tsx': { 'sample-card': 1 },
  'components/editor-workspace.tsx': { 'drawer-backdrop': 1 },
  'components/teaser-candidate-review.tsx': { 'candidate-card': 1, 'media-hit-area': 2 },
};

test('UI guard: no native selects or caller details/summary; raw buttons require an enumerated exception', async () => {
  const seen = {};
  let nativeDisclosures = 0;
  for (const file of [...await sources('app'), ...await sources('components')]) {
    const source = await read(file);
    for (const { tag, attrs } of openings(file, source)) {
      assert.notEqual(tag, 'select', `${file}: use shared Select`);
      if (tag === 'details' || tag === 'summary') {
        assert.equal(file, 'components/ui/disclosure.tsx', `${file}: use shared Disclosure`);
        if (tag === 'details') nativeDisclosures++;
      }
      if (tag === 'button') {
        const reason = attrs['data-ui-exception']?.replaceAll('"', '');
        assert.ok(exceptions[file]?.[reason], `${file}: unapproved raw button (${reason})`);
        assert.match(source, /UI exception/, `${file}: explain the exception in a source comment`);
        seen[file] ??= {};
        seen[file][reason] = (seen[file][reason] || 0) + 1;
      }
      if (tag === 'Button') {
        if (attrs.size?.startsWith('"')) assert.match(attrs.size, /^"(?:sm|md|lg|icon)"$/, `${file}: no size aliases`);
        if (attrs.variant?.startsWith('"')) assert.match(attrs.variant, /^"(?:primary|secondary|ghost|destructive|icon|segmented)"$/);
      }
    }
  }
  assert.equal(nativeDisclosures, 1, 'only the native Disclosure primitive owns details');
  assert.deepEqual(seen, exceptions);
});

test('UI controls share size, radius, weight, active tabs and portal-safe roles', async () => {
  const css = await read('app/globals.css');
  for (const [name, value] of Object.entries({
    'control-height': '36px', 'control-compact-height': '32px',
    'control-lg-height': '40px', 'control-icon-size': '32px',
    'control-radius': '8px', 'control-font-size': '13px',
  })) assert.ok(css.includes(`--${name}: ${value};`), name);
  assert.doesNotMatch(css, /border-radius:\s*\d+px|(?<![\w-])(?:min-height|height):\s*(?:24|30|32|36|40|44)px/);
  const button = await read('components/ui/button.tsx');
  assert.match(button, /defaultVariants: \{ variant: "primary", size: "md" \}/);
  assert.doesNotMatch(button, /\b(?:xs|action|timeline|icon-xs|icon-sm|icon-lg):/);
  assert.match(css, /\.studio-button\[data-slot\]\[data-variant\]\[data-size\]\s*\{[^}]*font-size: var\(--control-font-size\); font-weight: 500/s);
  assert.match(css, /data-variant="segmented"\]\[data-state="active"\]/);
  assert.match(await read('components/ui/tabs.tsx'), /buttonVariants\(\{ variant: "segmented", size: "md" \}\)/);
  const header = await read('components/studio-header.tsx');
  assert.equal((header.match(/<StatusChip\b/g) || []).length, 3, 'Worker, provider and saved use StatusChip');
  const headerButtons = openings('header', header).filter(({ tag }) => tag === 'Button');
  assert.equal(headerButtons.find(({ attrs }) => attrs.className === '"studio-session-save"').attrs.size, '"sm"');
  assert.match(header, /<Button\s+variant="secondary"\s+size="sm"\s+type="button"\s+disabled=\{!ready\}\s*>/);
  assert.match(await read('components/preserved-drafts.tsx'), /<Button\s+variant="secondary"\s+size="sm"/);
  assert.match(await read('components/shortcut-help.tsx'), /<Button\s+variant="secondary"\s+size="icon"/);
  for (const file of ['components/preserved-drafts.tsx', 'components/editor-render-list.tsx', 'components/media-library-panel.tsx', 'components/editor/batch-view.tsx']) {
    const buttons = openings(file, await read(file)).filter(({ tag }) => tag === 'Button');
    for (const { attrs } of buttons) {
      if (/onDelete|onStop|deleteBatchVideo|handleStorageAction\("(?:move|purge)"|act\(draft.key, true\)/.test(attrs.onClick || '')) {
        assert.equal(attrs.variant, '"destructive"', `${file}: deletion/cancellation role`);
      }
    }
  }
});

test('nine migrated selectors retain their accessible names and shared Radix options', async () => {
  const expected = {
    'components/editor/timeline-view.tsx': ['"Transition Hook → Main"'],
    'components/editor/inspector-view.tsx': ['"Font phụ đề"', '"Vị trí phụ đề"'],
    'components/music-panel.tsx': ['"Lọc mood nhạc"', '"Nhạc nền"', '"Nhạc riêng part"', '"Nguồn nhạc import"'],
    'components/text-style-panel.tsx': ['"text-font"'],
    'components/text-animation-panel.tsx': ['"title-animation"'],
  };
  for (const [file, labels] of Object.entries(expected)) {
    const source = await read(file);
    const triggers = openings(file, source).filter(({ tag }) => tag === 'SelectTrigger');
    assert.deepEqual(triggers.map(({ attrs }) => attrs['aria-label'] || attrs.id), labels);
    assert.ok(openings(file, source).some(({ tag }) => tag === 'SelectItem'), file);
    for (const { tag, attrs } of openings(file, source)) if (tag === 'Select') assert.ok(attrs.onValueChange, `${file}: controlled Radix Select`);
  }
  const music = await read('components/music-panel.tsx');
  assert.equal((music.match(/selected === "__studio_empty__" \? "" : selected/g) || []).length, 2, 'empty music values round-trip through Radix without changing persisted values');
  assert.match(music, /<SelectGroup key=\{mood\}>\s*<SelectLabel>\{mood\}<\/SelectLabel>/);
});

test('floating primitives share surfaces/layers and icon controls have keyboard-aware Vietnamese tooltips', async () => {
  const css = await read('app/globals.css');
  for (const [name, value] of [['dropdown', 50], ['dialog', 60], ['toast', 70]]) assert.ok(css.includes(`--layer-${name}: ${value};`));
  for (const file of ['select', 'popover', 'dropdown-menu', 'dialog', 'alert-dialog']) {
    assert.match(await read(`components/ui/${file}.tsx`), new RegExp(`z-\\(--layer-${file.includes('dialog') ? 'dialog' : 'dropdown'}\\)`));
    assert.ok(css.includes(`[data-slot="${file}-content"]`), file);
  }
  assert.doesNotMatch(css, /z-index:\s*(?:10|20|21|25|30|35)\s*;/);
  assert.match(await read('components/ui/tooltip.tsx'), /TooltipPrimitive\.Trigger asChild/);
  assert.match(await read('components/ui/button.tsx'), /size === "icon" \? props.title \|\| props\["aria-label"\]/);
  assert.match(await read('components/shortcut-help.tsx'), /tooltip="Phím tắt · \?"/);
  assert.match(await read('components/editor/preview-view.tsx'), /tooltip=\{`[^`]+Space`\}/);
  assert.match(await read('components/ui/dialog.tsx'), /tooltip="Đóng hộp thoại · Esc"/);
});

test('control palette text contrast meets 4.5:1 on its shared surfaces', async () => {
  const css = await read('app/globals.css');
  const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map((m) => [m[1], m[2]]));
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  for (const [fg, bg] of [['primary-foreground', 'primary'], ['foreground', 'panel'], ['muted-foreground', 'panel'], ['destructive', 'panel'], ['success', 'panel'], ['warning', 'panel'], ['selection-text', 'panel']]) {
    const a = luminance(palette[fg]), b = luminance(palette[bg]);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${fg} / ${bg}`);
  }
});

test('Batch and Kho share workspace primitives and prohibit legacy panel/color classes', async () => {
  for (const file of ['components/editor/batch-view.tsx', 'components/media-library-panel.tsx', 'components/editor-render-list.tsx']) {
    const source = await read(file);
    assert.doesNotMatch(source, /(?:emerald|amber|red)-\d|rounded-2xl/, file);
    for (const tag of ['Panel', 'EmptyState', 'InlineNotice', 'Toolbar', 'StatusChip']) {
      assert.ok(openings(file, source).some((node) => node.tag === tag), `${file}: ${tag}`);
    }
    if (!file.endsWith('editor-render-list.tsx')) {
      const title = file.endsWith('batch-view.tsx') ? 'Xử lý hàng loạt' : 'Kho';
      assert.match(source, new RegExp(`<h1 className="sr-only">${title}</h1>`), `${file}: accessible page title`);
      assert.ok(!openings(file, source).some((node) => node.tag === 'WorkspaceHeader'), `${file}: no visible workspace header`);
    }
  }
});

test('Kho keeps refresh in the search and tabs toolbar', async () => {
  const file = 'components/media-library-panel.tsx';
  const source = await read(file);
  const toolbar = source.match(/<Toolbar>[\s\S]*?<\/Toolbar>/)?.[0];
  assert.ok(toolbar, 'Kho has a toolbar');
  const controls = openings(file, toolbar);
  assert.ok(controls.some(({ tag, attrs }) => tag === 'Input' && attrs['aria-label'] === '"Tìm trong Kho"'));
  assert.ok(controls.some(({ tag, attrs }) => tag === 'TabsList' && attrs['aria-label'] === '"Nội dung Kho"'));
  const refresh = controls.find(({ tag, attrs }) => tag === 'Button' && attrs.onClick === '{() => void refresh()}');
  assert.ok(refresh, 'refresh remains in the toolbar with its callback');
  assert.equal(refresh.attrs.variant, '"secondary"');
  assert.equal(refresh.attrs.size, '"sm"');
  assert.equal(refresh.attrs.className, '"ml-auto"');
  assert.equal(refresh.attrs.disabled, '{!ready || loading || working}');
  assert.match(toolbar, /Làm mới/);
  assert.match(await read('app/globals.css'), /\.studio-batch-grid\s*\{[^}]*margin-top: 0;/s);
});

test('Batch setup uses content height with intentional workspace and queue scrolling', async () => {
  const css = await read('app/globals.css');
  assert.doesNotMatch(css, /grid-template-rows:\s*minmax\(0, 0\.9fr\)/);
  assert.match(css, /\.studio-batch-grid\s*\{[^}]*grid-template-rows: auto minmax\(160px, 1fr\)/s);
  assert.match(css, /\.studio-batch-setup\s*\{[^}]*overflow: visible/s);
  assert.match(css, /\.prototype-shell > \.studio-batch-workspace\s*\{[^}]*overflow: auto;[^}]*scrollbar-gutter: stable/s);
});

test('select controls, sample labels and visual customization disclosure use control typography', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /:not\(\[data-slot="select-trigger"\]\):not\(\[data-slot="select-item"\]\)/);
  assert.match(css, /\.prototype-shell button\[data-slot="select-trigger"\]\[data-size\],[\s\S]*?\[data-ui-exception="sample-card"\] > span:last-child\s*\{\s*font-size: var\(--control-font-size\)/);
  for (const match of css.matchAll(/\.studio-inspector-body \.visual-customize > summary\s*\{([^}]*)\}/g)) {
    assert.doesNotMatch(match[1], /font-size: 12px/);
  }
  assert.match(css, /\.visual-customize > summary\s*\{[^}]*font-size: var\(--control-font-size\);[^}]*border-radius: var\(--control-radius\)/s);
});

test('destructive red stays distinct from brand/warning and readable on dark and tinted surfaces', async () => {
  const css = await read('app/globals.css');
  const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map((m) => [m[1], m[2]]));
  assert.equal(palette.destructive, '#ff6b7a');
  for (const token of ['primary', 'warning', 'success']) assert.notEqual(palette.destructive, palette[token]);
  const rgb = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255);
  const luminance = (channels) => channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fg = rgb(palette.destructive);
  for (const surface of ['background', 'surface', 'panel']) {
    for (const tint of [0, 0.08, 0.12]) {
      const bg = rgb(palette[surface]).map((v, i) => (1 - tint) * v + tint * fg[i]);
      const a = luminance(fg), b = luminance(bg);
      assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${surface}, tint ${tint}`);
    }
  }
  assert.match(css, /--destructive-hover-background: color-mix\(in srgb, var\(--destructive\) 12%, var\(--panel\)\)/);
  assert.match(css, /--destructive-background: color-mix\(in srgb, var\(--destructive\) 8%, var\(--panel\)\)/);
  assert.match(css, /data-variant="destructive"\][^{]*\{\s*background: var\(--destructive-background\)/);
});
