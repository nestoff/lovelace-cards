#!/usr/bin/env bash
# Build an unsigned skaarOS-style .ipk for core-ditbrowse.
# NOTE: Blue Pill Packages → Upload and Install Package requires a SKAARHOJ-signed
# .ipks. This script cannot produce a signed .ipks. Use sideload-install.sh instead,
# or ask SKAARHOJ to sign a partner package.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/dist}"
VERSION="${VERSION:-0.1.0}"
# Official Blue Pill packages label aarch64 binaries as "arm".
ARCH="${ARCH:-arm}"
PKG_NAME="core-ditbrowse"
BINARY="${BINARY:-}"

mkdir -p "$OUT_DIR"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ -z "$BINARY" ]]; then
  echo "Building linux/arm64 binary..."
  (
    cd "$ROOT"
    GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$WORKDIR/$PKG_NAME" .
  )
  BINARY="$WORKDIR/$PKG_NAME"
fi

if [[ ! -x "$BINARY" && ! -f "$BINARY" ]]; then
  echo "Binary not found: $BINARY" >&2
  exit 1
fi

echo "Using binary: $BINARY ($(file -b "$BINARY" 2>/dev/null || true))"

# --- data.tar.gz ---
DATA="$WORKDIR/data"
mkdir -p "$DATA/usr/bin" "$DATA/service/pkg/$PKG_NAME/log"
install -m 0755 "$BINARY" "$DATA/usr/bin/$PKG_NAME"

cat > "$DATA/service/pkg/$PKG_NAME/run" <<EOF
#!/bin/sh
# Packaged for skaarOS / Blue Pill (unsigned sideload / opkg)
exec 2>&1
exec envdir /var/ibeam/env/$PKG_NAME /usr/bin/$PKG_NAME
EOF
chmod 0755 "$DATA/service/pkg/$PKG_NAME/run"

cat > "$DATA/service/pkg/$PKG_NAME/log/run" <<EOF
#!/bin/sh
exec svlogd -tt /var/ibeam/log/$PKG_NAME
EOF
chmod 0755 "$DATA/service/pkg/$PKG_NAME/log/run"

# Presence of "down" keeps the service stopped until System Manager starts it.
: > "$DATA/service/pkg/$PKG_NAME/down"

if [[ -f "$ROOT/model_images/packageimage.png" ]]; then
  install -m 0644 "$ROOT/model_images/packageimage.png" "$DATA/service/pkg/$PKG_NAME/packageimage.png"
elif [[ -d "$ROOT/model_images" ]]; then
  img="$(find "$ROOT/model_images" -type f \( -name '*.png' -o -name '*.jpg' \) | head -1 || true)"
  if [[ -n "${img:-}" ]]; then
    install -m 0644 "$img" "$DATA/service/pkg/$PKG_NAME/packageimage.png"
  fi
fi

tar -C "$DATA" --owner=0 --group=0 -czf "$WORKDIR/data.tar.gz" .

# --- control.tar.gz ---
CTRL="$WORKDIR/control"
mkdir -p "$CTRL"

cat > "$CTRL/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Architecture: $ARCH
Maintainer: nestoff
Description: DIT Browse camera select / routing trigger device core for Blue Pill Reactor
Label: DIT Browse
Priority: optional
Depends: skaaros-version (>= 0.9)
Tags: L_CONTROLLER
EOF

cat > "$CTRL/preinst" <<EOF
#!/bin/sh
# create all needed directories
mkdir -p /var/ibeam/log/$PKG_NAME
mkdir -p /var/ibeam/env/$PKG_NAME
mkdir -p /var/ibeam/config/$PKG_NAME

if [ -d /service/pkg/$PKG_NAME ]; then
    sv stop /service/pkg/$PKG_NAME
fi
EOF
chmod 0755 "$CTRL/preinst"

cat > "$CTRL/prerm" <<EOF
#!/bin/sh
# stop gracefully if running
if [ -d /service/pkg/$PKG_NAME ]; then
    sv stop /service/pkg/$PKG_NAME
    sleep 1
fi
# cleanup leftovers
if [ -d /var/ibeam/env/$PKG_NAME ]; then
    rm -rf /var/ibeam/env/$PKG_NAME
fi
if [ -d /var/ibeam/socket/$PKG_NAME.socket ]; then
    rm -rf /var/ibeam/socket/$PKG_NAME.socket
fi
if [ -d /service/pkg/$PKG_NAME ]; then
    rm -rf /service/pkg/$PKG_NAME
fi
EOF
chmod 0755 "$CTRL/prerm"

cat > "$CTRL/postinst" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod 0755 "$CTRL/postinst"

: > "$CTRL/conffiles"
echo "Development / sideload package (unsigned)." > "$CTRL/changes"

tar -C "$CTRL" --owner=0 --group=0 -czf "$WORKDIR/control.tar.gz" .

echo "2.0" > "$WORKDIR/debian-binary"

IPK="$OUT_DIR/${PKG_NAME}.${VERSION}.${ARCH}.ipk"
tar -C "$WORKDIR" --owner=0 --group=0 -czf "$IPK" ./debian-binary ./control.tar.gz ./data.tar.gz
# Keep a stable name too
cp -f "$IPK" "$OUT_DIR/${PKG_NAME}.ipk"

# Do NOT rename to .ipks — that implies SKAARHOJ signature verification will pass.
cat > "$OUT_DIR/README-PACKAGING.txt" <<EOF
UNSIGNED PACKAGE — Blue Pill web upload will fail
=================================================

Files:
  ${PKG_NAME}.${VERSION}.${ARCH}.ipk
  ${PKG_NAME}.ipk

Blue Pill → Packages → Upload and Install Package only accepts
SKAARHOJ-signed .ipks files. Uploading this .ipk (or renaming it to
.ipks) produces:

  Verification failed, File corrupted or invalid

Install instead with the sideload tarball:

  ../scripts/sideload-install.sh
  or extract core-ditbrowse-sideload-*.tar.gz and run install-on-bluepill.sh

To get a real .ipks, SKAARHOJ must sign the package with skaarOS-cli
(partner / support@skaarhoj.com).
EOF

echo "Wrote $IPK"
ls -la "$OUT_DIR"
