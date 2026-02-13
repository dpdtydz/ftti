#!/bin/bash
set -e

echo "Cleaning build cache and lock files..."

# Remove Next.js build cache
if [ -d ".next" ]; then
  rm -rf .next
  echo "✓ Removed .next cache"
fi

# Remove package-lock.json if it exists (project uses pnpm)
if [ -f "package-lock.json" ]; then
  rm -f package-lock.json
  echo "✓ Removed package-lock.json"
fi

# Remove node_modules to ensure clean install
if [ -d "node_modules" ]; then
  rm -rf node_modules
  echo "✓ Removed node_modules"
fi

echo "✓ Build cache cleaned successfully"
