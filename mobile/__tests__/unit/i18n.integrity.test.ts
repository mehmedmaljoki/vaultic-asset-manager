import { LANGS, t } from '../../lib/i18n';

const NEW_KEYS = [
  'cat_receivables',
  'zakat_rule_receivable',
  'zakat_hawl_explain',
  'zakat_hawl_createdat_warning',
  'zakat_hawl_short',
  'quran_2_261_translation',
  'quran_2_261_source',
  'settings_cloud_backup',
  'settings_cloud_backup_sub_ios',
  'settings_cloud_backup_sub_android',
  'settings_cloud_restore',
  'settings_cloud_signin',
  'settings_cloud_signed_out',
  'settings_cloud_unavailable_web',
  'settings_security',
  'settings_lock_enable',
  'settings_lock_enable_sub',
  'settings_lock_method_face',
  'settings_lock_method_touch',
  'settings_lock_method_fingerprint',
  'settings_lock_unavailable',
  'lock_unlock_reason',
  'lock_unlock_button',
  'lock_screen_title',
  'lock_optin_title',
  'lock_optin_body',
  'lock_optin_enable',
  'lock_optin_later',
  // Fix batch 2
  'zakat_receipt_title',
  'zakat_receipt_count',
  'zakat_receipt_subtotal',
  'lock_unavailable_no_module',
  'lock_unavailable_not_enrolled',
  'settings_cloud_signed_in',
  'settings_cloud_google_drive',
  'settings_cloud_signout',
  'settings_cloud_signin_required',
  'settings_cloud_error_title',
  'settings_cloud_error_hint',
  // Fix batch 3 — 0€ reasons, lock auth failed, feedback chars
  'zakat_0_no_assets',
  'zakat_0_no_prices',
  'zakat_0_hawl',
  'zakat_0_no_zakatable',
  'settings_lock_auth_failed',
  'settings_feedback_chars',
  // Coin-picker keys
  'asset_entry_mode_bar',
  'asset_entry_mode_coin',
  'asset_coin_country',
  'asset_coin_select',
  'asset_coin_count',
  'asset_add_custom_coin',
  'asset_coin_own_section',
  'asset_coin_weight',
  'asset_coin_alloy',
  'asset_coin_weight_label',
];

describe('i18n integrity', () => {
  it.each(LANGS.map(l => l.code))('language %s defines every new key', code => {
    for (const key of NEW_KEYS) {
      const v = t(key, code);
      expect(v).toBeTruthy();
      // If a key is missing, t() falls back to returning the key itself.
      expect(v).not.toBe(key);
    }
  });
});
