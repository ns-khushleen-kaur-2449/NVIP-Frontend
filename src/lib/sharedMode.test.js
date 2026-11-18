// F-01: one place reads the shared-assistant switch in the UI (lib/rbac.js isSharedMode, from /api/auth/me).
import fs from 'fs';
import path from 'path';
import { isSharedMode } from '@/lib/rbac';

const SRC = path.resolve(__dirname, '..');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return files(full);
  return /\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
});

test('only isSharedMode reads the shared_assistants switch from the session', () => {
  const offenders = files(SRC)
    .filter((file) => !file.endsWith(path.join('lib', 'rbac.js')))
    .filter((file) => /(featureOn|featureEnabled)\(\s*\w+\s*,\s*['"]shared_assistants['"]/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC, file));
  expect(offenders).toEqual([]);
});

test('isSharedMode is on only when /api/auth/me says true', () => {
  expect(isSharedMode({ features: { shared_assistants: true } })).toBe(true);
  expect(isSharedMode({ features: { shared_assistants: false } })).toBe(false);
  expect(isSharedMode({ features: {} })).toBe(false);
  expect(isSharedMode(null)).toBe(false);
});
