#!/usr/bin/env node
// Deletes workspaces recorded in .moat-workspaces.json (created during a migration run).
// Usage: node scripts/cleanup-workspaces.js [--file <path>] [--yes]
//   --file <path>  path to workspace log (default: .moat-workspaces.json)
//   --yes          skip confirmation prompt

import { readFileSync, existsSync } from 'fs';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const logPath = fileIdx !== -1 ? args[fileIdx + 1] : '.moat-workspaces.json';
const autoConfirm = args.includes('--yes');

function loadApiKey() {
  try {
    const config = JSON.parse(readFileSync('moat.config.json', 'utf8'));
    if (config.postmanApiKey) return config.postmanApiKey;
  } catch {}
  return process.env.POSTMAN_API_KEY;
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error('No API key found. Add postmanApiKey to moat.config.json or set POSTMAN_API_KEY.');
  process.exit(1);
}

if (!existsSync(logPath)) {
  console.error(`Workspace log not found: ${logPath}`);
  console.error('Run `moat migrate` first to generate it.');
  process.exit(1);
}

const entries = JSON.parse(readFileSync(logPath, 'utf8'));
if (entries.length === 0) {
  console.log('No workspaces to delete.');
  process.exit(0);
}

const BASE = 'https://api.getpostman.com';
const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };

async function deleteWorkspace(id, name) {
  const res = await fetch(`${BASE}/workspaces/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`DELETE /workspaces/${id} failed: ${res.status}`);
  console.log(`  Deleted: ${name} (${id})`);
}

async function confirm(question) {
  process.stdout.write(question);
  return new Promise(resolve => {
    process.stdin.once('data', d => resolve(d.toString().trim().toLowerCase() === 'y'));
  });
}

(async () => {
  console.log(`\nFound ${entries.length} workspace(s) in ${logPath}:`);
  entries.forEach(e => console.log(`  - ${e.workspaceName} (${e.workspaceId})  [API: ${e.apiId}]`));

  if (!autoConfirm) {
    const ok = await confirm('\nDelete all of the above? (y/N) ');
    if (!ok) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('');
  for (const e of entries) {
    await deleteWorkspace(e.workspaceId, e.workspaceName);
  }

  console.log(`\nDone. Deleted ${entries.length} workspace(s).`);
  process.exit(0);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
