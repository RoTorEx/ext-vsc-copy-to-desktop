const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const LIMIT = 2 * 1024 * 1024;
const RETENTION = 90 * 86400;

class UsageLog {
    constructor(directory, version, output) {
        this.directory = directory;
        this.version = version;
        this.output = output;
        this.runId = randomUUID();
        this.queue = Promise.resolve();
        this.warned = false;
    }
    event(action, result, fields = {}, operationId = null, duration = null) {
        // Callers supply counts and fixed categories, never paths or exception messages.
        const allowed = new Set(['source', 'type', 'files', 'bytes', 'links', 'collisions', 'error_code', 'selected_count']);
        const safe = Object.fromEntries(Object.entries(fields).filter(([key, value]) =>
            allowed.has(key) && (typeof value === 'number' || typeof value === 'boolean' ||
                (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value)))));
        const now = new Date();
        const record = { schema_version: 1, timestamp: now.toISOString(), epoch_seconds: Math.floor(now.getTime() / 1000),
            app: 'copy-to-desktop', app_version: this.version, run_id: this.runId, operation_id: operationId,
            action, result, duration_ms: duration, fields: safe };
        const line = JSON.stringify(record) + '\n';
        this.output.appendLine(line.trim());
        this.queue = this.queue.then(() => this.append(line)).catch(() => {
            if (!this.warned) {
                this.warned = true;
                this.output.appendLine('Usage logging unavailable; copying remains available.');
            }
        });
        return this.queue;
    }
    async append(line) {
        if (Buffer.byteLength(line) > 4096) throw new Error('Record too large');
        await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
        if ((await fs.lstat(this.directory)).isSymbolicLink()) throw new Error('Invalid log directory');
        await fs.chmod(this.directory, 0o700);
        const lock = path.join(this.directory, '.write-lock');
        let acquired = false;
        for (let attempt = 0; attempt < 25; attempt++) {
            try { await fs.mkdir(lock); acquired = true; break; }
            catch (error) {
                if (error.code !== 'EEXIST') throw error;
                // A crashed host can leave a lock. Never steal from a live owner.
                try {
                    const owner = Number(await fs.readFile(path.join(lock, 'pid'), 'utf8'));
                    let alive = true;
                    if (Number.isInteger(owner) && owner > 0) {
                        try { process.kill(owner, 0); } catch (e) { alive = e.code !== 'ESRCH'; }
                    }
                    if (!alive) await fs.rm(lock, { recursive: true });
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        const stat = await fs.stat(lock).catch(() => null);
                        if (stat && Date.now() - stat.mtimeMs > 30000) await fs.rm(lock, { recursive: true });
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 4));
            }
        }
        if (!acquired) throw new Error('Log busy');
        try {
            await fs.writeFile(path.join(lock, 'pid'), String(process.pid), { mode: 0o600 });
            const current = path.join(this.directory, 'events.jsonl');
            const segment = i => i === 0 ? current : `${current}.${i}`;
            const now = Math.floor(Date.now() / 1000);
            const marker = path.join(this.directory, '.retention');
            for (const target of [marker, path.join(this.directory, '.retention-tmp')]) {
                const stat = await fs.lstat(target).catch(e => { if (e.code !== 'ENOENT') throw e; });
                if (stat && !stat.isFile()) throw new Error('Invalid retention destination');
            }
            const last = Number(await fs.readFile(marker, 'utf8').catch(() => '0'));
            for (let i = 0; i < 5; i++) {
                const stat = await fs.lstat(segment(i)).catch(e => { if (e.code !== 'ENOENT') throw e; });
                if (stat && !stat.isFile()) throw new Error('Invalid log destination');
                if (stat && (Math.floor(last / 86400) !== Math.floor(now / 86400))) {
                    const content = await fs.readFile(segment(i), 'utf8');
                    const retained = content.split('\n').filter(line => {
                        try { return JSON.parse(line).epoch_seconds >= now - RETENTION; } catch { return false; }
                    });
                    const temp = path.join(this.directory, '.retention-tmp');
                    await fs.writeFile(temp, retained.length ? retained.join('\n') + '\n' : '', { mode: 0o600 });
                    await fs.rename(temp, segment(i));
                }
            }
            await fs.writeFile(marker, String(now), { mode: 0o600 });
            const size = (await fs.stat(current).catch(() => ({ size: 0 }))).size;
            if (size + Buffer.byteLength(line) > LIMIT) {
                await fs.rm(segment(4), { force: true });
                for (let i = 3; i >= 0; i--) {
                    await fs.rename(segment(i), segment(i + 1)).catch(e => { if (e.code !== 'ENOENT') throw e; });
                }
            }
            await fs.appendFile(current, line, { mode: 0o600 });
            await fs.chmod(current, 0o600);
        } finally { await fs.rm(lock, { recursive: true, force: true }); }
    }
}
module.exports = { UsageLog };
