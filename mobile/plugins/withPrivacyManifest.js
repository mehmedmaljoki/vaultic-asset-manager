const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>`;

module.exports = function withPrivacyManifest(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosDir = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName
      );
      fs.writeFileSync(path.join(iosDir, 'PrivacyInfo.xcprivacy'), PRIVACY_MANIFEST);
      return config;
    },
  ]);
};
