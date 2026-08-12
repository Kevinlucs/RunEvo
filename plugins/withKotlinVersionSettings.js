/**
 * Expo config plugin that patches android/settings.gradle to ensure
 * rootProject.ext.kotlinVersion is set early, before ExpoModulesCorePlugin.gradle runs.
 */
const { withSettingsGradle } = require('expo/config-plugins');

function withKotlinVersionSettings(config, version = '1.9.25') {
  return withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Inject ext block at the start of settings.gradle (before plugins block)
    if (!contents.includes('ext.kotlinVersion')) {
      const injected = `rootProject.ext.kotlinVersion = "${version}"\n\n${contents}`;
      config.modResults.contents = injected;
      console.log(`[withKotlinVersionSettings] Injected kotlinVersion to settings.gradle`);
    }

    return config;
  });
}

module.exports = withKotlinVersionSettings;
