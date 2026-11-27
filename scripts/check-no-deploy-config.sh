#!/usr/bin/env bash
# This repo is dormant and has no deploy target (GAAA-6145).
# Fail if a hosting-platform config is tracked again, so the deploy survey
# keeps reading the repo as no-deploy.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Matched at any depth (root included), e.g. apps/web/vercel.json.
names=(
  'vercel.json'
  'now.json'
  'netlify.toml'
  'render.yaml'
  'fly.toml'
  'railway.json'
  'railway.toml'
  'app.yaml'
  'Procfile'
  'firebase.json'
  'amplify.yml'
)
dirs=(
  '.vercel'
  '.netlify'
)

patterns=()
for n in "${names[@]}"; do patterns+=(":(glob)**/$n"); done
for d in "${dirs[@]}"; do patterns+=(":(glob)**/$d/**"); done

found=$(git ls-files -- "${patterns[@]}")
if [ -n "$found" ]; then
  echo "::error::Hosting-platform config found in a no-deploy repo:"
  echo "$found"
  exit 1
fi
echo "OK: no hosting-platform config tracked."
