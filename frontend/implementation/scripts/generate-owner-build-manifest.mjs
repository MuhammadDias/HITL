#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.error(`owner-build-manifest: ${message}`);
  process.exitCode = 1;
}

function git(repo, args, options = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: options.encoding ?? 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseStatus(buffer) {
  const records = buffer.toString('utf8').split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const status = record.slice(0, 2);
    const path = record.slice(3);
    entries.push({
      status,
      path,
      kind: status === '??' ? 'untracked' : 'tracked',
    });
    // Porcelain -z emits a second path for rename/copy records.
    if (/[RC]/.test(status) && i + 1 < records.length) i += 1;
  }
  return entries;
}

export function createManifest(repo, now = new Date()) {
  let sha;
  let packageJson;
  let entries;
  try {
    sha = git(repo, ['rev-parse', '--verify', 'HEAD']).trim();
    packageJson = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    entries = parseStatus(git(repo, [
      'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=no',
    ], { encoding: 'buffer' }));
  } catch (error) {
    throw new Error(`cannot produce Git-backed manifest: ${error.message}`, { cause: error });
  }
  if (!/^[0-9a-f]{40,64}$/i.test(sha)) throw new Error('Git returned an invalid HEAD SHA');
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error('package.json has no version string');
  }

  const tracked = entries.filter((entry) => entry.kind === 'tracked');
  const untracked = entries.filter((entry) => entry.kind === 'untracked');
  const dirty = entries.length > 0;
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    packageVersion: packageJson.version,
    git: {
      headSha: sha,
      shortSha: sha.slice(0, 12),
      dirty,
      state: dirty ? 'DIRTY' : 'CLEAN',
      trackedChangeCount: tracked.length,
      untrackedFileCount: untracked.length,
      // Includes staged/unstaged tracked files and all non-ignored untracked files.
      // Ignored files (e.g. node_modules, build output) are deliberately excluded.
      statusFilter: 'git porcelain v1; tracked + non-ignored untracked; ignored excluded',
      changes: entries,
      shaIsCleanSourceEvidence: !dirty,
      evidenceType: 'SOURCE_SNAPSHOT_NOT_BUILD_PROOF',
    },
  };
}

function main(argv) {
  const [repoArg, outputArg, ...extra] = argv;
  if (!repoArg || !outputArg || extra.length) {
    throw new Error('usage: node scripts/generate-owner-build-manifest.mjs <repo-path> <explicit-staging-json-path>');
  }
  if (!isAbsolute(outputArg)) throw new Error('output path must be absolute');
  const repo = realpathSync(resolve(repoArg));
  const output = resolve(outputArg);
  const parent = dirname(output);
  const isInside = (root, target) => target === root || target.startsWith(`${root}${sep}`);
  const isPublicPath = (target) => relative(repo, target).split(sep).includes('public');
  // Check lexical path, then canonical parent after mkdir to block symlink redirection.
  if (isInside(repo, output)) throw new Error('output must be outside the repository; choose an explicit staging path');
  if (isPublicPath(output)) throw new Error('refusing output under public/');
  mkdirSync(parent, { recursive: true });
  const realParent = realpathSync(parent);
  if (isInside(repo, realParent)) throw new Error('output must be outside the repository; choose an explicit staging path');
  if (isPublicPath(realParent)) throw new Error('refusing output under public/');
  const safeOutput = join(realParent, output.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
  const manifest = createManifest(repo);
  writeFileSync(safeOutput, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`Wrote staging manifest: ${output} (${manifest.git.state}, ${manifest.git.shortSha})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { fail(error.message); }
}

export { parseStatus };
            