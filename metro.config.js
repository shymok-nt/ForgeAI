const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// expo-sqlite uses a WASM worker in the browser. Metro must serve .wasm
// as an asset rather than attempting to parse it as JavaScript.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
module.exports = config;
