import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('Cleaning build cache and lock files...');

// Remove .next build cache
const nextPath = path.join(projectRoot, '.next');
if (fs.existsSync(nextPath)) {
  fs.rmSync(nextPath, { recursive: true, force: true });
  console.log('✓ Removed .next cache');
}

// Remove package-lock.json
const lockPath = path.join(projectRoot, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  fs.unlinkSync(lockPath);
  console.log('✓ Removed package-lock.json');
}

// Remove node_modules
const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  console.log('✓ Removed node_modules');
}

console.log('✓ Build cache cleaned successfully');
