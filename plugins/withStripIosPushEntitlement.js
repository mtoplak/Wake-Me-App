// Dev-only escape hatch for free Apple Developer accounts.
//
// expo-notifications adds the `aps-environment` (Push Notifications) entitlement
// automatically, but Apple's free Personal Team tier cannot sign apps that
// declare Push Notifications. When STRIP_IOS_PUSH=1 is set, we strip that
// entitlement during prebuild so a Personal Team can sign the dev build.
// Local notifications keep working — only remote push delivery is disabled.
const { withEntitlementsPlist } = require('@expo/config-plugins');

const withStripIosPushEntitlement = config => {
  if (process.env.STRIP_IOS_PUSH !== '1') return config;
  return withEntitlementsPlist(config, mod => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};

module.exports = withStripIosPushEntitlement;
