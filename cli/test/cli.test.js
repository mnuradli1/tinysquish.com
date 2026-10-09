'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { image, tmpdir } = require('./helpers');

const BIN = path.join(__dirname, '..', 'bin', 'tinysquish.js');
const cli = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });

test('--help and --version', () => {
  assert.match(cli(['--help']).stdout, /Usage: tinysquish/);
  assert.match(cli(['--version']).stdout, /^\d+\.\d+\.\d+/);
});

test('writes <name>-compressed next to the input and never touches the input', async () => {
  const dir = tmpdir();
  const input = path.join(dir, 'photo.png');
  fs.writeFileSync(input, await image.png());
  const before = fs.readFileSync(input);
  const r = cli([input]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'photo-compressed.png')));
  assert.ok(fs.readFileSync(input).equals(before));
});

test('--json reports every file, folders are scanned recursively, own outputs are skipped', async () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'a.png'), await image.png());
  fs.writeFileSync(path.join(dir, 'sub', 'b.jpg'), await image.jpeg());
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'skip me');
  const first = JSON.parse(cli([dir, '-f', 'webp', '--json']).stdout);
  assert.deepEqual(first.results.map(r => path.basename(r.output)).sort(), ['a-compressed.webp', 'b-compressed.webp']);
  assert.equal(first.summary.failed, 0);
  const second = JSON.parse(cli([dir, '-f', 'webp', '--json']).stdout);
  assert.equal(second.results.length, 2, 'outputs from the first run are not compressed again');
  assert.deepEqual(second.results.map(r => path.basename(r.output)).sort(), ['a-compressed (2).webp', 'b-compressed (2).webp']);
});

test('--out, --max and --dry-run', async () => {
  const dir = tmpdir(), out = path.join(dir, 'out');
  fs.writeFileSync(path.join(dir, 'big.jpg'), await image.jpeg(1600, 1200));
  const r = JSON.parse(cli([path.join(dir, 'big.jpg'), '--max', '80kb', '-o', out, '--json']).stdout).results[0];
  assert.equal(path.dirname(r.output), out);
  assert.ok(fs.statSync(r.output).size <= 80 * 1024 && r.targetMet);
  const dry = JSON.parse(cli([path.join(dir, 'big.jpg'), '-f', 'webp', '--dry-run', '--json']).stdout).results[0];
  assert.equal(dry.output, null);
  assert.equal(fs.readdirSync(dir).filter(f => f.endsWith('.webp')).length, 0);
});

test('resize options', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'r.png'), await image.png(400, 300));
  const pct = JSON.parse(cli([path.join(dir, 'r.png'), '-r', '50%', '--json']).stdout).results[0];
  assert.deepEqual([pct.width, pct.height], [200, 150]);
  const w = JSON.parse(cli([path.join(dir, 'r.png'), '--width', '100', '--json']).stdout).results[0];
  assert.deepEqual([w.width, w.height], [100, 75]);
});

test('bad arguments exit 2 with a message; a corrupt file exits 1 but the rest succeed', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'ok.png'), await image.png());
  fs.writeFileSync(path.join(dir, 'broken.png'), 'not an image');
  for (const args of [['-q', '200', dir], ['-f', 'bmp', dir], ['--max', 'lots', dir], [], [path.join(dir, 'missing.png')]]) {
    const r = cli(args);
    assert.equal(r.status, 2, `${args.join(' ')} → ${r.status}`);
    assert.match(r.stderr, /tinysquish:/);
  }
  const r = cli([dir, '--json']);
  assert.equal(r.status, 1);
  const res = JSON.parse(r.stdout).results;
  assert.ok(res.find(x => x.input.endsWith('broken.png')).error);
  assert.ok(res.find(x => x.input.endsWith('ok.png')).output);
});
