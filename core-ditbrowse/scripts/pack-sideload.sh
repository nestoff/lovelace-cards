#!/usr/bin/env bash
# Build a filesystem sideload tarball for Blue Pill (bypasses .ipks signature check).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/dist}"
VERSION="${VERSION:-0.1.0}"
PKG_NAME="core-ditbrowse"
BINARY="${BINARY:-}"

mkdir -p "$OUT_DIR"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

STAGE="$WORKDIR/$PKG_NAME-sideload"
mkdir -p "$STAGE/usr/bin" "$STAGE/service/pkg/$PKG_NAME/log" "$STAGE/scripts"

if [[ -z "$BINARY" ]]; then
  echo "Building linux/arm64 binary..."
  (
    cd "$ROOT"
    GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$STAGE/usr/bin/$PKG_NAME" .
  )
else
  install -m 0755 "$BINARY" "$STAGE/usr/bin/$PKG_NAME"
fi
chmod 0755 "$STAGE/usr/bin/$PKG_NAME"

cat > "$STAGE/service/pkg/$PKG_NAME/run" <<EOF
#!/bin/sh
exec 2>&1
exec envdir /var/ibeam/env/$PKG_NAME /usr/bin/$PKG_NAME
EOF
chmod 0755 "$STAGE/service/pkg/$PKG_NAME/run"

cat > "$STAGE/service/pkg/$PKG_NAME/log/run" <<EOF
#!/bin/sh
exec svlogd -tt /var/ibeam/log/$PKG_NAME
EOF
chmod 0755 "$STAGE/service/pkg/$PKG_NAME/log/run"
: > "$STAGE/service/pkg/$PKG_NAME/down"

if [[ -d "$ROOT/model_images" ]]; then
  img="$(find "$ROOT/model_images" -type f \( -name '*.png' -o -name '*.jpg' \) | head -1 || true)"
  if [[ -n "${img:-}" ]]; then
    install -m 0644 "$img" "$STAGE/service/pkg/$PKG_NAME/packageimage.png"
  fi
fi

cat > "$STAGE/install-on-bluepill.sh" <<'EOF'
#!/bin/sh
# Run THIS SCRIPT ON THE BLUE PILL (after copying the sideload folder), as root.
# Example from your Mac:
#   scp -r core-ditbrowse-sideload root@BLUE_PILL_IP:/tmp/
#   ssh root@BLUE_PILL_IP 'sh /tmp/core-ditbrowse-sideload/install-on-bluepill.sh'
set -e
PKG=core-ditbrowse
HERE="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

echo "Installing $PKG from $HERE"

mkdir -p /var/ibeam/log/$PKG /var/ibeam/env/$PKG /var/ibeam/config/$PKG

if [ -d /service/pkg/$PKG ]; then
  sv stop /service/pkg/$PKG 2>/dev/null || true
  sleep 1
fi

install -m 0755 "$HERE/usr/bin/$PKG" /usr/bin/$PKG
rm -rf /service/pkg/$PKG
mkdir -p /service/pkg
cp -a "$HERE/service/pkg/$PKG" /service/pkg/$PKG

# Ensure runit supervises the package (skaarOS usually already watches /service/pkg/*)
if [ -d /service ] && [ ! -e /service/$PKG ]; then
  # Prefer letting system-manager manage /service/pkg; do not force a top-level link.
  true
fi

echo "Installed. Next:"
echo "  1. Open Blue Pill web UI → Packages — $PKG should appear (may need Refresh / reboot)"
echo "  2. If it does not appear, reboot: reboot"
echo "  3. Add a device: Mac IP, port 52780"
echo "  4. DIT Browse → Settings → Local API → Allow LAN access"
EOF
chmod 0755 "$STAGE/install-on-bluepill.sh"

cat > "$STAGE/README.txt" <<EOF
core-ditbrowse sideload (unsigned) — v${VERSION}
===============================================

WHY THIS EXISTS
  Blue Pill Packages → Upload and Install Package cryptographically verifies
  .ipks files. Community/unsigned packages fail with:

    Verification failed, File corrupted or invalid

  That is expected. Only SKAARHOJ-signed .ipks (built with skaarOS-cli) pass
  the web uploader. This sideload installs the same files over SSH instead.

SSH ACCESS
  Many Blue Pills expose SSH when remote support is enabled.
  Via USB serial console (SKAARHOJ Discovery / Updater → Serial Monitor):

    support=1

  Then try:

    ssh root@<blue-pill-ip>

  If SSH is unavailable, ask support@skaarhoj.com to either:
    - enable SSH / support access for sideload, or
    - sign this package into a real .ipks for you

INSTALL
  scp -r core-ditbrowse-sideload root@BLUE_PILL_IP:/tmp/
  ssh root@BLUE_PILL_IP 'sh /tmp/core-ditbrowse-sideload/install-on-bluepill.sh'

  Or from a machine with this folder:

    ./scripts/push-sideload.sh BLUE_PILL_IP

AFTER INSTALL
  1. Reboot Blue Pill if Packages UI does not list core-ditbrowse
  2. Add device → Mac LAN IP, port 52780
  3. Enable DIT Browse Allow LAN access
EOF

# Helper to push from Mac/Linux
mkdir -p "$STAGE/scripts"
cat > "$STAGE/scripts/push-sideload.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
IP="${1:-}"
USER="${2:-root}"
if [[ -z "$IP" ]]; then
  echo "Usage: $0 <blue-pill-ip> [ssh-user]" >&2
  exit 1
fi
HERE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$(basename "$HERE")"
ssh "$USER@$IP" "rm -rf /tmp/$BASE && mkdir -p /tmp/$BASE"
scp -r "$HERE/." "$USER@$IP:/tmp/$BASE/"
ssh "$USER@$IP" "sh /tmp/$BASE/install-on-bluepill.sh"
EOF
chmod 0755 "$STAGE/scripts/push-sideload.sh"

TAR="$OUT_DIR/${PKG_NAME}-sideload-${VERSION}.tar.gz"
tar -C "$WORKDIR" --owner=0 --group=0 -czf "$TAR" "$(basename "$STAGE")"
cp -f "$TAR" "$OUT_DIR/${PKG_NAME}-sideload.tar.gz"
echo "Wrote $TAR"
ls -la "$OUT_DIR"/${PKG_NAME}-sideload*
