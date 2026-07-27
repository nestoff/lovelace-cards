#!/usr/bin/env bash
# Push a built sideload tree (or extract from dist tarball) to a Blue Pill over SSH.
set -euo pipefail
IP="${1:-}"
USER="${2:-root}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${OUT_DIR:-$ROOT/dist}"

if [[ -z "$IP" ]]; then
  echo "Usage: $0 <blue-pill-ip> [ssh-user]" >&2
  echo "Builds sideload if needed, then scp + install-on-bluepill.sh" >&2
  exit 1
fi

if [[ ! -f "$DIST/core-ditbrowse-sideload.tar.gz" ]]; then
  "$ROOT/scripts/pack-sideload.sh"
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
tar -C "$WORKDIR" -xzf "$DIST/core-ditbrowse-sideload.tar.gz"
TREE="$(find "$WORKDIR" -maxdepth 1 -type d -name 'core-ditbrowse-sideload*' | head -1)"
BASE="$(basename "$TREE")"

echo "Copying to $USER@$IP:/tmp/$BASE ..."
ssh "$USER@$IP" "rm -rf /tmp/$BASE && mkdir -p /tmp/$BASE"
scp -r "$TREE/." "$USER@$IP:/tmp/$BASE/"
ssh "$USER@$IP" "sh /tmp/$BASE/install-on-bluepill.sh"
