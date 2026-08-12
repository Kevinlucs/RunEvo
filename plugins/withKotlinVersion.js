/**
 * Expo config plugin that patches android/build.gradle to force
 * kotlinVersion = "1.9.25" in rootProject.ext.
 *
 * Needed because ExpoModulesCorePlugin.gradle (SDK 52 / RN 0.76) defaults
 * to 1.9.24 and does NOT read gradle.properties. The Compose Compiler 1.5.15
 * bundled with expo-modules-core@2.2.3 requires exactly 1.9.25.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

function withKotlinVersion(config, version = '1.9.25') {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Replace any existing kotlinVersion = "1.9.XX" with the target version
    const patched = contents.replace(
      /kotlinVersion\s*=\s*["']1\.9\.\d+["']/g,
      `kotlinVersion = "${version}"`
    );

    if (patched !== contents) {
      config.modResults.contents = patched;
      console.log(`[withKotlinVersion] Patched kotlinVersion to ${version}`);
    } else if (!contents.includes('kotlinVersion')) {
      // No kotlinVersion found — inject into buildscript ext
      config.modResults.contents = contents.replace(
        /buildscript\s*\{/,
        `buildscript {\n    ext {\n        kotlinVersion = "${version}"\n    }`
      );
      console.log(`[withKotlinVersion] Injected kotlinVersion = ${version}`);
    }

    return config;
  });
}

module.exports = withKotlinVersion;
