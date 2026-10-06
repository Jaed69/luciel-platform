import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DIST, read } from './helpers.mjs';

const home = () => read(join(DIST, 'index.html'));

test('home has intro, philosophy and tools sections', () => {
  const html = home();
  for (const id of ['intro', 'philosophy', 'tools']) {
    assert.match(html, new RegExp(`<section[^>]*id="${id}"`), `missing section #${id}`);
  }
});

test('home introduces the author and mentions UPC', () => {
  const html = home();
  assert.match(html, /Jhamil Peña/);
  assert.match(html, /UPC/);
});

test('home lists every project from the data module with its status', () => {
  const html = home();
  const tools = html.match(/<section[^>]*id="tools"[^]*?<\/section>/)?.[0] ?? '';
  for (const name of ['tours', 'rtk', 'graph', 'hackathons']) {
    assert.match(tools, new RegExp(`>${name}<`), `${name} missing from tool directory`);
  }
  assert.equal((tools.match(/Coming soon/g) ?? []).length, 3);
  assert.match(tools, /href="\/projects\/"/);
});

test('home no longer says it is under construction', () => {
  assert.doesNotMatch(home(), /under construction/i);
});

test('home exposes no email address or phone number', () => {
  const body = home().replace(/<(script|style)[^]*?<\/\1>/g, '');
  assert.doesNotMatch(body, /[\w.+-]+@[\w-]+\.[\w.-]+/, 'email-like string found');
  assert.doesNotMatch(body, /\+?\d[\d\s-]{7,}\d/, 'phone-like number found');
});
