#!/usr/bin/env bash
# This repo is dormant and has no deploy target (GAAA-6145).
# Fail if a hosting-platform config is tracked again, so the deploy survey
# keeps reading the repo as no-deploy.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

patterns=(
  'vercel.json'
  '.vercel/*'
  'now.json'
  'netlify.toml'
  '.netlify/*'
  'render.yaml'
  'fly.toml'
  'railway.json'
  'railway.toml'
  'app.yaml'
  'Procfile'
  'firebase.json'
  'amplify.yml'
)

found=$(git ls-files -- "${patterns[@]}")
if [ -n "$found" ]; then
  echo "::error::Hosting-platform config found in a no-deploy repo:"
  echo "$found"
  exit 1
fi
echo "OK: no hosting-platform config tracked."
