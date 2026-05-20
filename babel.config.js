module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets-core is required by vision-camera-resize-plugin and the
    // react-native-fast-tflite frame-processor hook. The plugin compiles 'worklet'-
    // tagged functions so they can run on the camera's worklet runtime. Run
    // `expo start -c` after any change here to force a cache clear.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
