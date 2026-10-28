const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { UsageLog } = require('../usage');
const output = { appendLine() {} };
async function temporary(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copy-usage-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    return dir;
}
test('concurrent hosts retain complete records and exclude private fields', async t => {
    const dir = await temporary(t);
    const writers = [new UsageLog(dir, 'test', output), new UsageLog(dir, 'test', output)];
    await Promise.all(Array.from({ length: 40 }, (_, i) => writers[i % 2].event('copy', 'success', { files: i, path: '/private/secret', error: 'secret' })));
    const text = await fs.readFile(path.join(dir, 'events.jsonl'), 'utf8');
    const records = text.trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 40);
    assert.equal(new Set(records.map(r => r.fields.files)).size, 40);
    assert.equal(text.includes('secret'), false);
});
test('age pruning and repeated rotations bound storage', async t => {
    const dir = await temporary(t);
    const current = path.join(dir, 'events.jsonl');
    await fs.writeFile(current, JSON.stringify({ epoch_seconds: 1, private: 'old' }) + '\n');
    const log = new UsageLog(dir, 'test', output);
    await log.event('copy', 'success');
    assert.equal((await fs.readFile(current, 'utf8')).includes('old'), false);
    const record = JSON.stringify({ epoch_seconds: Math.floor(Date.now()/1000), padding: 'x'.repeat(3900) }) + '\n';
    const full = record.repeat(Math.floor((2 * 1024 * 1024) / record.length));
    for (let i = 0; i < 7; i++) {
        await fs.writeFile(current, full);
        await log.append(record);
    }
    const files = (await fs.readdir(dir)).filter(name => name.startsWith('events.jsonl'));
    assert.equal(files.length, 5);
    assert.ok((await Promise.all(files.map(name => fs.stat(path.join(dir, name))))).reduce((sum, s) => sum + s.size, 0) <= 10 * 1024 * 1024);
});
test('unwritable destinations and symlinks do not reject the user action', async t => {
    const dir = await temporary(t);
    const target = path.join(dir, 'outside');
    await fs.writeFile(target, 'preserve');
    const logs = path.join(dir, 'logs');
    await fs.mkdir(logs);
    await fs.symlink(target, path.join(logs, '.retention-tmp'));
    const log = new UsageLog(logs, 'test', output);
    await log.event('copy', 'success');
    assert.equal(log.warned, true);
    assert.equal(await fs.readFile(target, 'utf8'), 'preserve');
    await new UsageLog(target, 'test', output).event('copy', 'success');
});
