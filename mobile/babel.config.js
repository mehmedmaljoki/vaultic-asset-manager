module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 56) auto-adds react-native-worklets/plugin when the
    // package is installed; adding it explicitly would instrument worklets twice
    // and break runtime init ("Global was not installed" / "MessageQueue doesn't exist").
    presets: ['babel-preset-expo'],
  };
};
