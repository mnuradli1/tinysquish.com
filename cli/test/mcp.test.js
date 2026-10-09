'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { image, tmpdir } = require('./helpers');

const BIN = path.join(__dirname, '..', 'bin', 'tinysquish-mcp.js');

// Every test closes its server, even when an assertion fails (an open stdio child hangs the runner)
const clients = new Set();
test.afterEach(async () => { for (const c of clients) await c.close().catch(() => {}); clients.clear(); });

async function connect(args = [], env = {}) {
  const client = new Client({ name: 'tinysquish-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BIN, ...args], env: { ...process.env, ...env }, stderr: 'pipe' }));
  clients.add(client);
  return client;
}

test('lists both tools with schemas and safety annotations', async () => {
  const c = await connect();
  const { tools } = await c.listTools();
  const byName = Object.fromEntries(tools.map(t => [t.name, t]));
  assert.deepEqual(Object.keys(byName).sort(), ['compress_images', 'image_info']);
  assert.deepEqual(byName.compress_images.inputSchema.required, ['paths']);
  assert.equal(byName.compress_images.annotations.destructiveHint, false);
  assert.equal(byName.compress_images.annotations.openWorldHint, false);
  assert.equal(byName.image_info.annotations.readOnlyHint, true);
  await c.close();
});

test('compress_images: folder → WebP files next to the inputs, structured results', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'a.png'), await image.png());
  fs.writeFileSync(path.join(dir, 'b.jpg'), await image.jpeg());
  const c = await connect();
  const r = await c.callTool({ name: 'compress_images', arguments: { paths: [dir], format: 'webp' } });
  assert.ok(!r.isError, r.content[0].text);
  const { results, summary } = r.structuredContent;
  assert.equal(summary.files, 2);
  for (const x of results) assert.ok(fs.existsSync(x.output) && x.output.endsWith('-compressed.webp'));
  assert.match(r.content[0].text, /2\/2 done/);
  await c.close();
});

test('compress_images: max_size and out_dir', async () => {
  const dir = tmpdir(), out = path.join(dir, 'out');
  fs.writeFileSync(path.join(dir, 'big.jpg'), await image.jpeg(1600, 1200));
  const c = await connect();
  const r = await c.callTool({ name: 'compress_images', arguments: { paths: [path.join(dir, 'big.jpg')], max_size: '70kb', out_dir: out } });
  const x = r.structuredContent.results[0];
  assert.equal(path.dirname(x.output), out);
  assert.ok(x.targetMet && fs.statSync(x.output).size <= 70 * 1024);
  await c.close();
});

test('image_info and errors', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'i.png'), await image.png(320, 200, true));
  const c = await connect();
  const info = await c.callTool({ name: 'image_info', arguments: { path: path.join(dir, 'i.png') } });
  assert.deepEqual([info.structuredContent.format, info.structuredContent.width, info.structuredContent.height, info.structuredContent.hasAlpha], ['png', 320, 200, true]);
  const missing = await c.callTool({ name: 'compress_images', arguments: { paths: [path.join(dir, 'nope.png')] } });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /no such file/);
  const bad = await c.callTool({ name: 'compress_images', arguments: { paths: [dir], max_size: 'huge' } });
  assert.equal(bad.isError, true);
  await c.close();
});

test('--allow restricts paths to the given folders (symlinks included)', async () => {
  const inside = tmpdir(), outside = tmpdir();
  fs.writeFileSync(path.join(inside, 'ok.png'), await image.png());
  fs.writeFileSync(path.join(outside, 'secret.png'), await image.png());
  fs.symlinkSync(path.join(outside, 'secret.png'), path.join(inside, 'link.png'));
  const c = await connect(['--allow', inside]);
  const ok = await c.callTool({ name: 'compress_images', arguments: { paths: [path.join(inside, 'ok.png')], dry_run: true } });
  assert.ok(!ok.isError);
  for (const p of [path.join(outside, 'secret.png'), path.join(inside, 'link.png')]) {
    const denied = await c.callTool({ name: 'image_info', arguments: { path: p } });
    assert.equal(denied.isError, true, p);
    assert.match(denied.content[0].text, /outside the allowed folders/);
  }
  // A folder inside the allowed area that links to a file outside: the linked file must be refused
  const scan = await c.callTool({ name: 'compress_images', arguments: { paths: [inside], dry_run: true } });
  const linked = scan.structuredContent.results.find(r => r.input.endsWith('link.png'));
  assert.match(linked.error, /outside the allowed folders/);
  assert.ok(scan.structuredContent.results.find(r => r.input.endsWith('ok.png')).outBytes > 0);
  const outDenied = await c.callTool({ name: 'compress_images', arguments: { paths: [path.join(inside, 'ok.png')], out_dir: outside } });
  assert.equal(outDenied.isError, true);
  await c.close();
});
