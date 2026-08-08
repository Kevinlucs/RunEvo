const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const config = getDefaultConfig(__dirname);
// @supabase/supabase-js e ws podem exigir esta flag em alguns setups:
config.resolver.unstable_enablePackageExports = false;
// android/build (gerado pelo Gradle) tem milhares de arquivos intermediários
// e nunca contém código-fonte JS/TS — watch-lo estoura o limite de inotify
// (ENOSPC) sem trazer nenhum benefício. Exclui do watcher do Metro.
config.resolver.blockList = exclusionList([/android\/(app\/)?build\/.*/, /android\/\.gradle\/.*/]);
module.exports = config;
