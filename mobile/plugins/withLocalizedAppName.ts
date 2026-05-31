import { type ConfigPlugin, withInfoPlist, withDangerousMod } from 'expo/config-plugins';
import * as path from 'path';
import * as fs from 'fs';

// Brand name is universal — localization infrastructure enables correct OS behaviour
// (Spotlight, Siri, Settings app, App Store language matching).
//
// NOTE: this is intentionally NOT replaced by Expo's built-in `locales` config:
// `locales` localizes system-dialog/permission strings, not the app display name
// (CFBundleDisplayName on iOS, app_name on Android). This plugin localizes the
// display name across all supported locales, which `locales` does not cover.
const APP_NAME = 'Vaultic';

const IOS_LOCALES = [
  'en', 'de', 'ar', 'tr', 'sr', 'bs', 'hr',
  'es', 'fr', 'nl', 'zh-Hans', 'hi', 'ru', 'id', 'ms', 'fa',
];

// Android resource folder suffixes (BCP-47 where needed).
const ANDROID_LOCALES = [
  'en', 'de', 'ar', 'tr', 'sr', 'b+bs', 'hr',
  'es', 'fr', 'nl', 'b+zh+Hans', 'hi', 'ru', 'id', 'ms', 'fa',
];

const withIosLocalizedName: ConfigPlugin = (config) => {
  // 1. Declare supported localizations in Info.plist
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleLocalizations = IOS_LOCALES;
    return cfg;
  });

  // 2. Write {locale}.lproj/InfoPlist.strings for each locale
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName ?? '';
      const iosDir = path.join(projectRoot, projectName);

      for (const locale of IOS_LOCALES) {
        const lprojDir = path.join(iosDir, `${locale}.lproj`);
        fs.mkdirSync(lprojDir, { recursive: true });
        fs.writeFileSync(
          path.join(lprojDir, 'InfoPlist.strings'),
          `CFBundleDisplayName = "${APP_NAME}";\nCFBundleName = "${APP_NAME}";\n`,
          'utf8',
        );
      }
      return cfg;
    },
  ]);

  return config;
};

const withAndroidLocalizedName: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res',
      );

      for (const locale of ANDROID_LOCALES) {
        const valuesDir = path.join(resDir, `values-${locale}`);
        fs.mkdirSync(valuesDir, { recursive: true });
        fs.writeFileSync(
          path.join(valuesDir, 'strings.xml'),
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_name">${APP_NAME}</string>\n</resources>\n`,
          'utf8',
        );
      }
      return cfg;
    },
  ]);

const withLocalizedAppName: ConfigPlugin = (config) => {
  config = withIosLocalizedName(config);
  config = withAndroidLocalizedName(config);
  return config;
};

export default withLocalizedAppName;
