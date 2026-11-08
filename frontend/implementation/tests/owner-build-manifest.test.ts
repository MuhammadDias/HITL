import { afterEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createManifest } from '../scripts/generate-owner-build-manifest.mjs';

const roots: string[] = [];
function fixture() {
  const repo = mkdtempSync(join(tmpdir(), 'owner-manifest-repo-'));
  roots.push(repo);
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-qm', 'initial'], { cwd: repo });
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  execFileSync('git', ['add', 'package.json'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'package'], { cwd: repo });
  return repo;
}
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe('owner build manifest', () => {
  it('records actual package version and Git HEAD for a clean checkout', () => {
    const repo = fixture();
    const manifest = createManifest(repo, new Date('2026-11-03T00:00:00.000Z'));
    assert.equal(manifest.packageVersion, '1.2.3');
    assert.equal(manifest.generatedAt, '2026-11-03T00:00:00.000Z');
    assert.equal(manifest.git.headSha, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim());
    assert.equal(manifest.git.dirty, false);
    assert.equal(manifest.git.shaIsCleanSourceEvidence, true);
    assert.equal(manifest.git.evidenceType, 'SOURCE_SNAPSHOT_NOT_BUILD_PROOF');
  });

  it('flags tracked and non-ignored untracked changes; ignored files excluded', () => {
    const repo = fixture();
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ version: '1.2.4' }));
    writeFileSync(join(repo, 'new.ts'), 'untracked');
    writeFileSync(join(repo, '.gitignore'), 'ignored.tmp\n');
    writeFileSync(join(repo, 'ignored.tmp'), 'ignored');
    const manifest = createManifest(repo);
    assert.equal(manifest.git.dirty, true);
    assert.equal(manifest.git.state, 'DIRTY');
    assert.equal(manifest.git.shaIsCleanSourceEvidence, false);
    assert.equal(manifest.git.evidenceType, 'SOURCE_SNAPSHOT_NOT_BUILD_PROOF');
    assert.equal(manifest.git.trackedChangeCount, 1);
    assert.equal(manifest.git.untrackedFileCount, 2);
    assert.deepEqual(manifest.git.changes.map((entry) => entry.path).sort(), ['.gitignore', 'new.ts', 'package.json']);
  });

  it('fails closed when repo is not a Git checkout', () => {
    const path = mkdtempSync(join(tmpdir(), 'owner-manifest-no-git-'));
    roots.push(path);
    writeFileSync(join(path, 'package.json'), JSON.stringify({ version: '1.2.3' }));
    assert.throws(() => createManifest(path), /cannot produce Git-backed manifest/);
  });

  it('CLI writes only to an explicit external staging path and refuses public/repo output', () => {
    const repo = fixture();
    const script = resolve(new URL('../scripts/generate-owner-build-manifest.mjs', import.meta.url).pathname);
    const stage = join(tmpdir(), `owner-manifest-stage-${process.pid}.json`);
    roots.push(stage);
    execFileSync(process.execPath, [script, repo, stage]);
    assert.equal(JSON.parse(readFileSync(stage, 'utf8')).git.dirty, false);
    assert.throws(() => execFileSync(process.execPath, [script, repo, join(repo, 'public', 'manifest.json')]));
    assert.throws(() => execFileSync(process.execPath, [script, repo, join(repo, 'manifest.json')]));
    assert.throws(() => execFileSync(process.execPath, [script, repo, 'relative-manifest.json']), /output path must be absolute/);
    const outside = mkdtempSync(join(tmpdir(), 'owner-manifest-outside-'));
    roots.push(outside);
    mkdirSync(join(repo, 'public'));
    symlinkSync(join(repo, 'public'), join(outside, 'linked-public'), 'dir');
    assert.throws(() => execFileSync(process.execPath, [script, repo, join(outside, 'linked-public', 'manifest.json')]));
    assert.equal(existsSync(join(repo, 'public', 'manifest.json')), false);
  });
});

            