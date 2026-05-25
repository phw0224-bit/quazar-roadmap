import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(packageDir, 'package.json');
const serverPath = path.join(packageDir, 'server.js');

test('quazar-mcp package exposes a CLI bin and local install metadata', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.equal(packageJson.bin['quazar-mcp'], './server.js');
  assert.match(packageJson.name, /quazar-mcp/);
  assert.ok(packageJson.scripts.start);
  assert.ok(packageJson.scripts.test);
  assert.ok(packageJson.dependencies['@modelcontextprotocol/sdk']);
});

test('quazar-mcp server entry is directly executable as a bin script', () => {
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  assert.match(serverSource, /^#!\/usr\/bin\/env node/m);
});
