// V10-01: measures the running app and src/style.css for the UI design review. Read-only against the app.
// Usage (from the repo root, PowerShell or bash):  node app/scripts/design-audit.mjs [--laptop] [baseUrl] [outDir]
//   --laptop  measure at 1280x800 with a mouse instead of 412x915 on a phone (V10-02); default outDir is then docs/screenshots/review-2026-11-after/laptop/
//   baseUrl  default http://localhost:4199 (a running `vite preview`; this script starts and builds nothing)
//   outDir   default docs/screenshots/review-2026-11/ (writes design-audit.json and design-audit.txt there)
// Joe's private avatar pack is blocked on purpose, as in screenshots.mjs, so no body is ever loaded and the stage is empty.
// The app's server calls (/api/packing-template, /api/identify) are answered by routes in this script; nothing is sent anywhere.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const LAPTOP = process.argv.includes('--laptop');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const base = (args[0] ?? 'http://localhost:4199').replace(/\/$/, '');
const out = args[1] ?? fileURLToPath(new URL(LAPTOP ? '../../docs/screenshots/review-2026-11-after/laptop/' : '../../docs/screenshots/review-2026-11/', import.meta.url));
const cssPath = fileURLToPath(new URL('../src/style.css', import.meta.url));
mkdirSync(out, { recursive: true });

const PHONE = LAPTOP ? { width: 1280, height: 800 } : { width: 412, height: 915 }; // the one viewport the run measures at
const WIDTHS = LAPTOP ? [1280] : [360, 412, 560];
const MIN_FONT = 12;
const MIN_TARGET = 44;

// ---------------------------------------------------------------------------------------------------------------------
// Part 1: style.css (parsed from the file)
// ---------------------------------------------------------------------------------------------------------------------

/** Every declaration in the stylesheet with its selector and media query. A small scanner, enough for this hand-written file. */
function parseCss(source) {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  const decls = [];
  let buf = '';
  let depth = 0;
  const flush = () => {
    const text = buf.trim();
    buf = '';
    const i = text.indexOf(':');
    if (!stack.length || i < 1) return;
    const selector = stack[stack.length - 1];
    if (selector.startsWith('@font-face')) return;
    decls.push({ selector, media: stack.find((s) => s.startsWith('@media')) ?? '', prop: text.slice(0, i).trim(), value: text.slice(i + 1).trim().replace(/\s+/g, ' ') });
  };
  for (const ch of src) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '{' && depth === 0) { stack.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; }
    else if (ch === '}' && depth === 0) { flush(); stack.pop(); }
    else if (ch === ';' && depth === 0) flush();
    else buf += ch;
  }
  return decls;
}

const countBy = (items, key = (x) => x) => {
  const m = new Map();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
};
const sortedEntries = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true }));
const lengthTokens = (value) => value.split(/\s+/).filter((t) => /^-?[\d.]+(px|rem|em|%|vh|vw|dvh)?$/.test(t) && !/^0(px)?$/.test(t));

function cssSpacing(decls) {
  const groups = {
    padding: (p) => /^padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/.test(p),
    margin: (p) => /^margin(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/.test(p),
    gap: (p) => /^(gap|row-gap|column-gap)$/.test(p),
    'border-radius': (p) => /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/.test(p),
    'font-size': (p) => p === 'font-size',
  };
  const result = {};
  for (const [name, test] of Object.entries(groups)) {
    const ds = decls.filter((d) => test(d.prop));
    const whole = countBy(ds, (d) => d.value);
    const parts = countBy(ds.flatMap((d) => lengthTokens(d.value)));
    result[name] = {
      declarations: ds.length,
      distinctValues: whole.size,
      distinctLengths: parts.size,
      values: sortedEntries(whole).map(([value, count]) => ({ value, count })),
      lengths: sortedEntries(parts).map(([value, count]) => ({ value, count })),
    };
  }
  return result;
}

const COLOUR_PROPS = /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color)$/;
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\b(white|black)\b/g;

function cssColours(decls) {
  const tokens = {};
  const literals = new Map();
  let tokenUses = 0;
  for (const d of decls) {
    if (d.selector === ':root' && d.prop.startsWith('--')) { tokens[d.prop] = d.value.replace(/\s*\/\*.*$/, ''); continue; }
    if (!COLOUR_PROPS.test(d.prop) && !d.prop.startsWith('--')) continue;
    tokenUses += (d.value.match(/var\(--/g) ?? []).length;
    const stripped = d.value.replace(/var\([^)]*\)/g, '');
    for (const lit of stripped.match(COLOUR_LITERAL) ?? []) {
      const key = lit.toLowerCase();
      const row = literals.get(key) ?? { count: 0, selectors: [] };
      row.count += 1;
      if (row.selectors.length < 4 && !row.selectors.includes(d.selector)) row.selectors.push(d.selector);
      literals.set(key, row);
    }
  }
  return {
    tokens,
    tokenUses,
    literalCount: [...literals.values()].reduce((a, r) => a + r.count, 0),
    literals: [...literals.entries()].sort((a, b) => b[1].count - a[1].count).map(([colour, r]) => ({ colour, ...r })),
  };
}

function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function cssContrast(tokens) {
  const hexOf = (name) => (/^#[0-9a-f]{6}$/i.test(tokens[name] ?? '') ? tokens[name] : null);
  const rows = [];
  for (const fg of ['--ink', '--text-2', '--muted', '--danger']) {
    for (const bg of ['--ground', '--surface', '--sunken', '--stage']) {
      if (!hexOf(fg) || !hexOf(bg)) continue;
      const ratio = contrast(hexOf(fg), hexOf(bg));
      rows.push({ text: fg, on: bg, fg: hexOf(fg), bg: hexOf(bg), ratio: Math.round(ratio * 100) / 100, aa: ratio >= 4.5, aaLarge: ratio >= 3 });
    }
  }
  if (hexOf('--surface') && hexOf('--ink')) {
    const ratio = contrast(hexOf('--surface'), hexOf('--ink'));
    rows.push({ text: 'white (--surface)', on: '--ink', fg: hexOf('--surface'), bg: hexOf('--ink'), ratio: Math.round(ratio * 100) / 100, aa: ratio >= 4.5, aaLarge: ratio >= 3 });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// Part 2: the live app at phone size, screen by screen. The screens and states mirror screenshots.mjs.
// ---------------------------------------------------------------------------------------------------------------------

const item = (id, garment, colour, name, savedAt, neckline) => ({ v: 2, id, garment, ...(neckline && { neckline }), colour, name, savedAt });
const SEED = {
  wardrobe: [
    item('i1', 'tee', '#1f2a5a', 'Navy tee', 6),
    item('i2', 'tee', '#f4f4f2', 'White tee', 5, 'v'),
    item('i3', 'trousers', '#6b4f3a', 'Brown trousers', 4),
    item('i4', 'sweatshirt', '#8c8c8c', 'Grey sweatshirt', 3),
    item('i5', 'shorts', '#b8ad98', 'Stone shorts', 2),
    item('i6', 'tee', '#1e7a55', 'Emerald tee', 1, 'scoop'),
  ],
  outfits: [
    { v: 1, id: 'o1', name: 'Weekend', top: 'i1', bottom: 'i3', savedAt: 3 },
    { v: 1, id: 'o2', name: 'Stone and grey', top: 'i4', bottom: 'i5', savedAt: 2 },
    { v: 1, id: 'o3', name: 'Emerald', top: 'i6', bottom: 'deleted', savedAt: 1 },
  ],
  outfit: { Top: 'T-shirt', Bottom: 'Trousers' },
  colours: { tee: '#1f2a5a', trousers: '#6b4f3a' },
  neckline: 'crew',
  favourites: [
    { hex: '#1f2a5a', fromPalette: false },
    { hex: '#6b4f3a', fromPalette: true },
    { hex: '#c8b89a', fromPalette: true },
  ],
};
const line = (ref, label, extra = {}) => ({ kind: 'template', ref, packed: false, text: extra.quantity > 1 ? `${extra.quantity} × ${label}` : label, label, ...extra });
const TRIPS = [
  {
    v: 1, id: 't1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', savedAt: 1,
    entries: [
      { kind: 'item', ref: 'i1', packed: false, via: ['o1'], own: true },
      { kind: 'item', ref: 'i3', packed: true, via: ['o1'] },
      { kind: 'item', ref: 'i4', packed: false, own: true },
      { kind: 'outfit', ref: 'o1', packed: false },
      line('l1', 'White T-shirt', { group: 'Tops', type: 'tee', colour: '#f4f4f2', matches: ['i2'] }),
      line('l2', 'Shorts', { group: 'Bottoms', type: 'shorts', colour: '#b8ad98', matches: ['i5'], quantity: 2 }),
      line('l3', 'Walking shoes', { group: 'Shoes', type: 'trainers', colour: '#f4f4f2' }),
      line('l4', 'Passport', { group: 'Documents' }),
      line('l5', 'Sweatshirt', { group: 'Layers', type: 'sweatshirt', colour: '#8c8c8c', matchedTo: ['i4'] }),
    ],
  },
  { v: 1, id: 't2', name: 'Cardiff day trip', starts: '2026-12-20', ends: '2026-12-20', savedAt: 2, entries: [] },
];

/** Runs in the page. Everything it reports is for what a person could see and touch right now (the open sheet, if there is one). */
function inPage(opts) {
  const { minFont, minTarget } = opts;
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  const roots = dialogs.length ? dialogs : [document.body];
  const inRoots = (el) => roots.some((r) => r === el || r.contains(el));
  const selOf = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = [...el.classList].slice(0, 3);
    if (cls.length) s += `.${cls.join('.')}`;
    if (el.getAttribute('role')) s += `[role=${el.getAttribute('role')}]`;
    if (el.dataset.row) s += `[data-row=${el.dataset.row}]`;
    if (el.dataset.act) s += `[data-act=${el.dataset.act}]`;
    return s;
  };
  const classKey = (el) => {
    let s = el.tagName.toLowerCase();
    const cls = [...el.classList].slice(0, 3);
    if (cls.length) s += `.${cls.join('.')}`;
    if (el.getAttribute('role')) s += `[role=${el.getAttribute('role')}]`;
    return s;
  };
  const visible = (el) => {
    if (el.closest('[hidden]') || el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const all = [...document.querySelectorAll('*')].filter((el) => inRoots(el) && !['SCRIPT', 'STYLE', 'HEAD'].includes(el.tagName));

  // Font sizes: elements that carry text of their own.
  const fonts = {};
  const under = [];
  for (const el of all) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    const isField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !['checkbox', 'radio', 'file', 'hidden'].includes(el.type);
    const text = own || (isField ? el.value || el.placeholder || '' : '');
    if (!text || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const key = String(size);
    fonts[key] ??= { count: 0, selectors: [] };
    fonts[key].count += 1;
    const ck = classKey(el);
    if (fonts[key].selectors.length < 4 && !fonts[key].selectors.includes(ck)) fonts[key].selectors.push(ck);
    if (size < minFont) under.push({ selector: selOf(el), text: text.slice(0, 40), size });
  }

  // Interactive elements smaller than the minimum target. A tick box inside a label is measured as the label.
  const targetSel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=radio], [role=checkbox]';
  const targets = [];
  const small = [];
  for (const el of all.filter((e) => e.matches(targetSel))) {
    const labelled = el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type) ? el.closest('label') : null;
    const box = labelled ?? el;
    const elVisible = labelled ? visible(labelled) : visible(el) || (el.tagName === 'INPUT' && !!el.closest('label') && visible(el.closest('label')));
    if (!elVisible) continue;
    if (el.disabled && el.tagName === 'BUTTON' && false) continue;
    const r = box.getBoundingClientRect();
    const rec = { selector: selOf(el), key: classKey(el), text: (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, via: labelled ? 'label' : '' };
    targets.push(rec);
    if (rec.w < minTarget - 0.5 || rec.h < minTarget - 0.5) small.push(rec);
  }

  // Overflow at this width.
  const vw = document.documentElement.clientWidth;
  const overflow = { viewport: vw, docScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, pastViewport: [], clipped: [], scrollsSideways: [] };
  overflow.docScrolls = overflow.docScrollWidth > vw + 0.5;
  const scrollerOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return p;
      if (o === 'hidden' || o === 'clip') return p;
    }
    return null;
  };
  for (const el of all) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
        if (el !== document.body && !el.classList.contains('main')) overflow.scrollsSideways.push({ selector: selOf(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      } else if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
        overflow.clipped.push({ selector: selOf(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, text: (el.textContent || '').trim().slice(0, 30) });
      }
    }
    if (r.right > vw + 0.5 || r.left < -0.5) {
      const sc = scrollerOf(el);
      if (sc) {
        const sr = sc.getBoundingClientRect();
        if (sr.right <= vw + 0.5 && sr.left >= -0.5) continue; // held inside a container that fits the screen
      }
      overflow.pastViewport.push({ selector: selOf(el), left: Math.round(r.left), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 30) });
    }
  }
  overflow.pastViewport = overflow.pastViewport.slice(0, 12);
  overflow.clipped = overflow.clipped.slice(0, 12);
  overflow.scrollsSideways = overflow.scrollsSideways.slice(0, 8);
  return { fonts, under, targets: targets.length, small, focusRows: [], overflow, modal: dialogs.length > 0 };
}


/** Runs in the page after each Tab press: how the focused control renders, compared with the same control unfocused. */
function focusProbe() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const snap = (e) => {
    const c = getComputedStyle(e);
    return { outlineStyle: c.outlineStyle, outlineWidth: parseFloat(c.outlineWidth), shadow: c.boxShadow, border: c.borderTopColor + c.borderLeftColor, bg: c.backgroundColor, color: c.color, deco: c.textDecorationLine };
  };
  const repeat = window.__auditSeen.has(el);
  window.__auditSeen.add(el);
  const after = snap(el);
  const matches = el.matches(':focus-visible');
  el.blur();
  const before = snap(el);
  el.focus({ preventScroll: true }); // keep the keyboard position so the next Tab moves on
  let kind = 'none';
  if (after.outlineStyle !== 'none' && after.outlineWidth > 0) kind = after.outlineStyle === 'auto' ? 'browser default ring' : `outline ${after.outlineWidth}px`;
  else if (after.shadow !== before.shadow) kind = 'box-shadow';
  else if (after.border !== before.border || after.bg !== before.bg || after.color !== before.color || after.deco !== before.deco) kind = 'colour change only';
  let key = el.tagName.toLowerCase();
  const cls = [...el.classList].slice(0, 3);
  if (cls.length) key += `.${cls.join('.')}`;
  if (el.getAttribute('role')) key += `[role=${el.getAttribute('role')}]`;
  if (el.tagName === 'INPUT') key += `[type=${el.type}]`;
  return { key, selector: key + (el.id ? `#${el.id}` : ''), focused: true, matchesFocusVisible: matches, kind, repeat };
}

/** The same measuring at a different width, for overflow only. */
const overflowOnly = (page) => page.evaluate(inPage, { minFont: MIN_FONT, minTarget: MIN_TARGET }).then((r) => r.overflow);

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function run() {
  if (!(await reachable(base))) {
    console.error(`Cannot reach ${base}. Start the app first, for example from the repo root:\n  cd app; npx vite build; npx vite preview --port 4199 --strictPort\nthen run this script again.`);
    process.exit(2);
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext(LAPTOP ? { viewport: PHONE, deviceScaleFactor: 1 } : { viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route('**/pack/**', (r) => r.abort()); // Joe's private pack stays blocked; the stage is empty on purpose
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.stage-status { visibility: hidden !important; }';
      document.head.append(style);
    });
  });
  const page = await ctx.newPage();
  const scenes = [];

  const scene = async (name, note = '') => {
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(350);
    const m = await page.evaluate(inPage, { minFont: MIN_FONT, minTarget: MIN_TARGET });
    // Keyboard focus: Tab through the screen (or the open sheet) and read how each control looks when focused.
    const focusRows = [];
    await page.evaluate(() => document.activeElement?.blur());
    await page.evaluate(() => { window.__auditSeen = new WeakSet(); });
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(focusProbe);
      if (!f || f.repeat) break; // focus left the page, or came round to a control already seen
      if (!focusRows.some((r) => r.key === f.key)) focusRows.push(f);
    }
    const overflowByWidth = {};
    for (const w of WIDTHS) {
      if (w === PHONE.width) { overflowByWidth[w] = m.overflow; continue; }
      await page.setViewportSize({ width: w, height: PHONE.height });
      await page.waitForTimeout(200);
      overflowByWidth[w] = await overflowOnly(page);
    }
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(150);
    scenes.push({ name, note, modal: m.modal, fonts: m.fonts, under12: m.under, targetCount: m.targets, small: m.small, focus: focusRows, overflow: overflowByWidth });
    process.stdout.write(`  measured ${name}\n`);
  };
  const go = async (route) => {
    await page.goto(`${base}/#/${route}`);
    await page.reload();
  };
  const seedKv = (data) =>
    page.evaluate(async (d) => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('huedrobe-joe', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          for (const [key, value] of Object.entries(d)) tx.objectStore('kv').put(value, key);
          tx.oncomplete = () => { req.result.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, data);
  const pressEsc = async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      if (!(await page.locator('dialog[open]').count())) break;
    }
  };
  const notReached = [];
  const tryScene = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      notReached.push({ scene: name, reason: String(e.message ?? e).split('\n')[0] });
      await pressEsc().catch(() => {});
    }
  };

  // Put the sample wardrobe on the device.
  await go('try-on');
  await seedKv(SEED);
  await go('try-on');
  await page.locator('.wear-row[data-row="Top"]').waitFor();

  await scene('try-on');
  await tryScene('change-a-piece', async () => {
    await page.locator('[data-row="Top"]').click();
    await page.locator('.editor').waitFor();
    await scene('change-a-piece (Top)');
    await page.locator('.choose').click();
    await scene('choose-a-colour');
    await page.locator('.editor-back').click();
    await page.locator('.editor-done').click();
  });
  await tryScene('menu-back-up', async () => {
    await page.locator(LAPTOP ? '#backup-btn' : '#menu-btn').click();
    await scene('menu / back-up dialog');
    await pressEsc();
  });

  await go('wardrobe');
  await scene('wardrobe-clothes');
  await tryScene('wardrobe-a-piece', async () => {
    await page.locator('.w-card').first().click();
    await scene('wardrobe-a-piece (sheet)');
    await pressEsc();
  });
  await tryScene('wardrobe-outfits', async () => {
    await page.locator('#tab-outfits').click();
    await scene('wardrobe-outfits');
  });

  await go('colours');
  await scene('my-colours-start');
  await tryScene('my-colours quiz', async () => {
    await page.getByRole('button', { name: 'Take the quiz' }).click();
    for (let i = 0; i < 2; i += 1) {
      await page.locator('[role="radio"]').first().click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.locator('[role="radio"]').first().click();
    await scene('my-colours-question');
    for (;;) {
      await page.locator('[role="radio"]').first().click();
      const see = page.getByRole('button', { name: 'See my result' });
      if (await see.isVisible()) { await see.click(); break; }
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await scene('my-colours-result');
    await page.evaluate(() => document.querySelector('.main')?.scrollTo(0, 100000));
    await scene('my-colours-result-lower');
  });

  // Packing
  await go('packing');
  await scene('packing-empty');
  await tryScene('new-trip-form', async () => {
    await page.getByRole('button', { name: 'New trip' }).click();
    await scene('packing-new-trip-form');
    await pressEsc();
  });
  await seedKv({ trips: TRIPS });
  await go('packing');
  await scene('packing-trips');
  await tryScene('trip-tray', async () => {
    await page.locator('.p-trip').first().click();
    await scene('packing-trip-tray');
    await page.evaluate(() => document.querySelector('.main')?.scrollTo(0, 100000));
    await scene('packing-trip-tray-lower');
    await page.locator('.p-packed-btn').click();
    await scene('packing-trip-packed-open');
    await page.locator('.p-trip[data-id="t2"]').click();
    await scene('packing-trip-empty');
    await page.locator('.p-trip[data-id="t1"]').click();
  });
  await tryScene('edit-trip', async () => {
    await page.locator('[data-act="edit"]').click();
    await scene('packing-edit-trip');
    await pressEsc();
  });
  await tryScene('add-sheet', async () => {
    await page.locator('[data-act="add"]').click();
    await scene('packing-add-sheet');
    await page.getByRole('tab', { name: /^Outfits/ }).click();
    await scene('packing-add-sheet-outfits');
    await page.getByLabel('Search').fill('zzz');
    await scene('packing-add-sheet-no-match');
    await pressEsc();
  });
  await tryScene('match-sheet', async () => {
    await page.locator('[data-act="match-line"]:not([disabled])').first().click();
    await scene('packing-match-sheet');
    await page.locator('[data-match-scope="all"]').click();
    await scene('packing-match-sheet-all-clothes');
    await pressEsc();
  });
  await tryScene('review-sheet', async () => {
    await page.locator('[data-act="review-matches"]').first().click();
    await scene('packing-review-sheet');
    await pressEsc();
  });
  await tryScene('suggest-sheet', async () => {
    await page.route('**/api/packing-template', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.locator('[data-act="make-template"]').click();
    await scene('packing-suggest-confirm');
    await page.locator('[data-act="suggest-ask"]').click();
    await scene('packing-suggest-error');
    await pressEsc();
    await page.unroute('**/api/packing-template');
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route('**/api/packing-template', async (r) => {
      await held;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ label: 'Light jacket', group: 'Layers', type: 'sweatshirt', colour: '#8c8c8c', matches: ['i4'] }, { label: 'Socks', quantity: 3, group: 'Tops' }, { label: 'Charger', group: 'Tech' }] }) });
    });
    await page.locator('[data-act="make-template"]').click();
    await page.locator('[data-act="suggest-ask"]').click();
    await scene('packing-suggest-loading');
    release();
    await page.locator('[data-act="suggest-done"]').waitFor();
    await scene('packing-suggest-done');
    await page.locator('[data-act="suggest-done"]').click();
    await page.unroute('**/api/packing-template');
  });

  // Add from photo
  await go('wardrobe');
  await scene('wardrobe-add-from-photo-buttons');
  await tryScene('add-from-photo', async () => {
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 600; c.height = 900;
      const g = c.getContext('2d');
      g.fillStyle = '#eeeeee'; g.fillRect(0, 0, 600, 900);
      g.fillStyle = '#1f2a5a'; g.fillRect(150, 250, 300, 380);
      return c.toDataURL('image/png').split(',')[1];
    });
    const file = { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
    await page.route('**/api/identify', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
    await page.locator('input[data-input="upload"]').setInputFiles(file);
    await page.locator('.w-add-form:not([hidden])').waitFor();
    await scene('add-from-photo-form');
    await pressEsc();
    await page.unroute('**/api/identify');
    await page.locator('input[data-input="screenshot"]').setInputFiles(file);
    await page.locator('.w-crop:not([hidden])').waitFor();
    await scene('add-from-screenshot-crop');
    await pressEsc();
  });

  // Back up and restore
  await go('try-on');
  await tryScene('back-up-saved / restore', async () => {
    await page.locator(LAPTOP ? '#backup-btn' : '#menu-btn').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#b-export').click()]);
    await scene('back-up-saved');
    await page.locator('#b-file').setInputFiles(await download.path());
    await page.locator('#b-replace').waitFor({ state: 'visible' });
    await scene('restore-confirm');
    await page.locator('#b-cancel').click();
    await page.locator('#b-file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not a backup') });
    await page.waitForTimeout(300);
    await scene('restore-not-a-backup');
    await pressEsc();
  });

  await ctx.close();
  await browser.close();
  return { scenes, notReached };
}

// ---------------------------------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------------------------------

const pad = (v, n) => String(v).padEnd(n);
const padL = (v, n) => String(v).padStart(n);

function table(headers, rows) {
  const widths = headers.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)));
  const fmt = (r) => r.map((c, i) => pad(c ?? '', widths[i])).join('  ').trimEnd();
  return [fmt(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(fmt)].join('\n');
}

function summarise({ scenes, notReached }, css) {
  const fontTotals = new Map();
  for (const s of scenes) {
    for (const [size, f] of Object.entries(s.fonts)) {
      const row = fontTotals.get(size) ?? { size: Number(size), elements: 0, scenes: 0, selectors: new Set() };
      row.elements += f.count;
      row.scenes += 1;
      f.selectors.forEach((x) => row.selectors.add(x));
      fontTotals.set(size, row);
    }
  }
  const fontRows = [...fontTotals.values()].sort((a, b) => a.size - b.size);
  const under = new Map();
  for (const s of scenes) for (const u of s.under12) {
    const k = `${u.selector}|${u.size}`;
    const row = under.get(k) ?? { ...u, scenes: [] };
    if (!row.scenes.includes(s.name)) row.scenes.push(s.name);
    under.set(k, row);
  }
  const smallMap = new Map();
  for (const s of scenes) for (const t of s.small) {
    const k = `${t.key}|${t.w}x${t.h}`;
    const row = smallMap.get(k) ?? { selector: t.key, size: `${t.w}x${t.h}`, text: t.text, via: t.via, scenes: [] };
    if (!row.scenes.includes(s.name)) row.scenes.push(s.name);
    smallMap.set(k, row);
  }
  const focusFail = new Map();
  for (const s of scenes) for (const f of s.focus) {
    if (f.kind === 'none' || !f.focused || f.kind === 'colour change only' || f.kind === 'browser default ring') {
      const row = focusFail.get(f.key) ?? { key: f.key, kind: f.focused ? f.kind : 'could not take focus', scenes: [] };
      if (!row.scenes.includes(s.name)) row.scenes.push(s.name);
      focusFail.set(f.key, row);
    }
  }
  const focusKinds = countBy(scenes.flatMap((s) => s.focus), (f) => f.kind);
  const overflowRows = [];
  for (const s of scenes) for (const w of WIDTHS) {
    const o = s.overflow[w];
    if (o.docScrolls || o.pastViewport.length || o.clipped.length) overflowRows.push({ scene: s.name, width: w, docScrolls: o.docScrolls, docScrollWidth: o.docScrollWidth, past: o.pastViewport, clipped: o.clipped });
  }
  const minFont = fontRows.length ? fontRows[0].size : null;
  return {
    fontRows: fontRows.map((r) => ({ size: r.size, elements: r.elements, scenes: r.scenes, selectors: [...r.selectors].slice(0, 6) })),
    minFont,
    distinctFontSizes: fontRows.length,
    under12: [...under.values()],
    small: [...smallMap.values()],
    smallByScene: scenes.map((s) => ({ scene: s.name, interactive: s.targetCount, under44: s.small.length })),
    focusFail: [...focusFail.values()],
    focusKinds: Object.fromEntries(focusKinds),
    overflowRows,
    notReached,
    css: {
      distinct: Object.fromEntries(Object.entries(css.spacing).map(([k, v]) => [k, { declarations: v.declarations, distinctValues: v.distinctValues, distinctLengths: v.distinctLengths }])),
      literalColourCount: css.colours.literalCount,
      distinctLiteralColours: css.colours.literals.length,
    },
  };
}

function render(data, css, summary) {
  const L = [];
  const h = (t) => L.push('', t, '='.repeat(t.length));
  L.push(`Hue-drobe design audit, ${data.meta.date}`);
  L.push(`App: ${base}   Viewport: ${PHONE.width}x${PHONE.height} at ${LAPTOP ? 1 : 2}x   Screens measured: ${data.scenes.length}   Widths for overflow: ${WIDTHS.join(', ')} px`);
  L.push(`Script: app/scripts/design-audit.mjs   Stylesheet: app/src/style.css (${data.meta.cssLines} lines)`);

  h('1. Headline numbers');
  L.push(`Smallest rendered text: ${summary.minFont}px   Distinct computed font sizes: ${summary.distinctFontSizes}   Text under ${MIN_FONT}px: ${summary.under12.length} kinds of element`);
  L.push(`Interactive elements under ${MIN_TARGET}x${MIN_TARGET}px: ${summary.small.length} kinds (${data.scenes.reduce((a, s) => a + s.small.length, 0)} instances over all screens)`);
  L.push(`Style.css distinct values: ${Object.entries(summary.css.distinct).map(([k, v]) => `${k} ${v.distinctValues} (${v.distinctLengths} lengths)`).join('; ')}`);
  L.push(`Colour literals in style.css outside tokens: ${summary.css.literalColourCount} uses of ${summary.css.distinctLiteralColours} colours`);
  L.push(`Focus: ${Object.entries(summary.focusKinds).map(([k, v]) => `${k} ${v}`).join('; ')}`);
  L.push(`Overflow findings (screen x width): ${summary.overflowRows.length}`);
  if (summary.notReached.length) L.push(`Screens not reached: ${summary.notReached.map((n) => `${n.scene} (${n.reason})`).join('; ')}`);

  h(`2. Per screen at ${PHONE.width} px`);
  L.push(table(['screen', 'sizes', 'min px', '<12px', 'targets', '<44px', 'no focus', `overflow ${WIDTHS.join('/')}`], data.scenes.map((s) => {
    const sizes = Object.keys(s.fonts).map(Number).sort((a, b) => a - b);
    const noFocus = s.focus.filter((f) => f.kind === 'none' || !f.focused).length;
    const ov = WIDTHS.map((w) => { const o = s.overflow[w]; return o.docScrolls || o.pastViewport.length || o.clipped.length ? `${o.docScrolls ? 'doc ' : ''}${o.pastViewport.length}p/${o.clipped.length}c` : 'ok'; }).join(' / ');
    return [s.name, sizes.length, sizes[0] ?? '', s.under12.length, s.targetCount, s.small.length, noFocus, ov];
  })));

  h('3. Computed font sizes, all screens (elements are summed over screens, so repeated chrome counts once per screen)');
  L.push(table(['px', 'elements', 'screens', 'example selectors'], summary.fontRows.map((r) => [r.size, r.elements, r.scenes, r.selectors.join(', ')])));
  h(`3a. Text under ${MIN_FONT}px`);
  L.push(summary.under12.length ? table(['selector', 'px', 'text', 'screens'], summary.under12.map((u) => [u.selector, u.size, `"${u.text}"`, u.scenes.join('; ')])) : 'None.');

  h(`4. Interactive elements under ${MIN_TARGET}x${MIN_TARGET}px (visible only; a tick box inside a label is measured as the label)`);
  L.push(summary.small.length ? table(['selector', 'size px', 'example text', 'via', 'screens'], summary.small.map((t) => [t.selector, t.size, `"${t.text}"`, t.via, t.scenes.join('; ')])) : 'None.');
  L.push('', 'Count per screen:');
  L.push(table(['screen', 'interactive', 'under 44'], summary.smallByScene.map((r) => [r.scene, r.interactive, r.under44])));

  h('5. style.css: spacing, radius and font-size values (as written; each shorthand value counted once, and again split into single lengths)');
  for (const [name, v] of Object.entries(css.spacing)) {
    L.push('', `${name}: ${v.declarations} declarations, ${v.distinctValues} distinct values, ${v.distinctLengths} distinct single lengths`);
    L.push(`  values:  ${v.values.map((x) => `${x.value} x${x.count}`).join(' | ')}`);
    L.push(`  lengths: ${v.lengths.map((x) => `${x.value} x${x.count}`).join(' | ')}`);
  }

  h('6. style.css: colours that are not var(--token) uses');
  L.push(`Tokens defined in :root: ${Object.keys(css.colours.tokens).length}. var(--) uses in colour properties: ${css.colours.tokenUses}.`);
  L.push(css.colours.literals.length ? table(['literal', 'uses', 'example selectors'], css.colours.literals.map((c) => [c.colour, c.count, c.selectors.join(', ')])) : 'No literals.');

  h('7. Contrast of text tokens on backgrounds (WCAG 2.x; AA needs 4.5, large text 3)');
  L.push(table(['text', 'on', 'text hex', 'bg hex', 'ratio', 'AA 4.5', 'large 3'], css.contrast.map((c) => [c.text, c.on, c.fg, c.bg, c.ratio.toFixed(2), c.aa ? 'pass' : 'FAIL', c.aaLarge ? 'pass' : 'FAIL'])));

  h('8. Visible focus style (Tab through each screen; one control of each class per screen; "browser default ring" means the control has no focus rule of its own)');
  L.push(`Results over all controls tested: ${Object.entries(summary.focusKinds).map(([k, v]) => `${k} ${v}`).join('; ')}`);
  L.push(summary.focusFail.length ? table(['control class', 'result', 'screens'], summary.focusFail.map((f) => [f.key, f.kind, f.scenes.join('; ')])) : 'Every control tested shows an author-styled outline or box-shadow on focus.');

  h('9. Horizontal overflow and clipped content (p = elements past the screen edge, c = text clipped by overflow:hidden)');
  if (!summary.overflowRows.length) L.push(`None at ${WIDTHS.join(', ')} px.`);
  for (const r of summary.overflowRows) {
    L.push(`${r.scene} at ${r.width}px: page scrollWidth ${r.docScrollWidth}${r.docScrolls ? ' (scrolls sideways)' : ''}`);
    for (const p of r.past) L.push(`    past edge: ${p.selector} left ${p.left} right ${p.right} "${p.text}"`);
    for (const c of r.clipped) L.push(`    clipped:   ${c.selector} content ${c.scrollWidth} in ${c.clientWidth} "${c.text}"`);
  }
  const sideways = data.scenes.flatMap((s) => WIDTHS.flatMap((w) => s.overflow[w].scrollsSideways.map((x) => `${s.name} @${w}: ${x.selector} (${x.scrollWidth} in ${x.clientWidth})`)));
  if (sideways.length) { L.push('', 'Rows that scroll sideways by design (information only):'); [...new Set(sideways)].slice(0, 20).forEach((x) => L.push('    ' + x)); }
  return L.join('\n') + '\n';
}

const cssSource = readFileSync(cssPath, 'utf8');
const decls = parseCss(cssSource);
const css = { spacing: cssSpacing(decls), colours: cssColours(decls) };
css.contrast = cssContrast(css.colours.tokens);

const live = await run();
const summary = summarise(live, css);
const data = { meta: { date: new Date().toISOString().slice(0, 10), base, viewport: PHONE, widths: WIDTHS, cssLines: cssSource.split('\n').length }, summary, css, scenes: live.scenes, notReached: live.notReached };
const text = render(data, css, summary);
writeFileSync(join(out, 'design-audit.json'), JSON.stringify(data, null, 2));
writeFileSync(join(out, 'design-audit.txt'), text);
console.log(text);
console.log(`Written: ${join(out, 'design-audit.json')} and ${join(out, 'design-audit.txt')}`);
