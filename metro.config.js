const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// @supabase/supabase-js e ws podem exigir esta flag em alguns setups:
config.resolver.unstable_enablePackageExports = false;
module.exports = config;
