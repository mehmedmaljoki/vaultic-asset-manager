const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Removes 'public' access modifiers from the generated AppDelegate.swift.
 *
 * Required for Xcode 26+ (Swift 6): using types from implicitly-internal module
 * imports (e.g. `import Expo`) in a `public class` declaration is now an error.
 * AppDelegate doesn't need to be public — it's the app's own entry point.
 */
module.exports = function withAppDelegatePublicAccess(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const appDelegatePath = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName,
        'AppDelegate.swift',
      );

      if (!fs.existsSync(appDelegatePath)) {
        return cfg;
      }

      let contents = fs.readFileSync(appDelegatePath, 'utf8');

      // Remove 'public' from the class declaration
      contents = contents.replace(/^public class AppDelegate/m, 'class AppDelegate');

      // Remove 'public override' → 'override' from all method declarations
      contents = contents.replace(/\bpublic override\b/g, 'override');

      fs.writeFileSync(appDelegatePath, contents, 'utf8');
      return cfg;
    },
  ]);
};
