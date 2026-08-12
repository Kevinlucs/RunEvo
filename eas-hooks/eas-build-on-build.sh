#!/bin/bash
# EAS Build hook: roda DEPOIS do prebuild (android/ ja existe) e ANTES do Gradle.
# Forca rootProject.ext.kotlinVersion = 1.9.25 no build.gradle raiz,
# porque o ExpoModulesCorePlugin.gradle tem fallback hardcoded em 1.9.24
# e nao le de gradle.properties.

set -eo pipefail

BUILD_GRADLE="android/build.gradle"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "[kotlin-fix] android/build.gradle not found, skipping."
  exit 0
fi

if grep -q 'kotlinVersion' "$BUILD_GRADLE"; then
  sed -i -E "s/kotlinVersion\s*=\s*[\"']1\.9\.24[\"']/kotlinVersion = \"1.9.25\"/" "$BUILD_GRADLE"
  echo "[kotlin-fix] Patched existing kotlinVersion to 1.9.25"
else
  sed -i '/^buildscript/a \    ext { kotlinVersion = "1.9.25" }' "$BUILD_GRADLE"
  echo "[kotlin-fix] Injected kotlinVersion = 1.9.25 into buildscript"
fi

echo "[kotlin-fix] Done."
grep -n 'kotlinVersion' "$BUILD_GRADLE" || true
