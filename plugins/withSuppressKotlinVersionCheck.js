/**
 * Supress Kotlin version compatibility check warning for Compose Compiler.
 * Kotlin 1.9.24 + Compose Compiler 1.5.15 work fine despite the warning.
 * This is needed because Expo SDK 52 defaults to Kotlin 1.9.24 and the
 * Compose Compiler bundled with expo-modules-core@2.2.3 requires 1.9.25,
 * but they're practically compatible.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

function withSuppressKotlinVersionCheck(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Inject composeOptions block that suppresses the warning
    if (!contents.includes('composeOptions')) {
      const kotlinCompilerExtensionBlockRegex = /android\s*\{[^}]*composeOptions/;
      if (!kotlinCompilerExtensionBlockRegex.test(contents)) {
        // Inject before the closing brace of android block
        config.modResults.contents = contents.replace(
          /(android\s*\{[^}]*)(}\s*$)/m,
          `$1
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
        suppressKotlinVersionCompatibilityCheck = true
    }

$2`
        );
        console.log('[withSuppressKotlinVersionCheck] Injected composeOptions');
      }
    }

    return config;
  });
}

module.exports = withSuppressKotlinVersionCheck;
