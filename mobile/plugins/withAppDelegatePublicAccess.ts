import { type ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Removes 'public' access modifiers from the generated AppDelegate.swift.
 *
 * Required for Xcode 26+ (Swift 6): using types from implicitly-internal module
 * imports (e.g. `import Expo`) in a `public class` declaration is now an error.
 * AppDelegate doesn't need to be public — it's the app's own entry point.
 *
 * NOTE: Re-evaluate after a real iOS build on SDK 56 (Phase 5 / EAS). If SDK 56's
 * Swift AppDelegate template no longer emits `public`, this plugin can be deleted.
 */
const withAppDelegatePublicAccess: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const appDelegatePath = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName ?? '',
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

export default withAppDelegatePublicAccess;
