import { applySystemDefaultsIfFirstLaunch, getSystemLanguage } from '../../../lib/services/SystemDefaultsService';
import * as SettingsRepo from '../../../lib/repositories/SettingsRepository';
import { SETTINGS_DEFAULTS } from '../../../lib/models/Settings';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../../../lib/repositories/SettingsRepository');

const db = {} as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('getSystemLanguage', () => {
  it('falls back to "en" when expo-localization is missing', () => {
    expect(['en','de','ar','tr','sr','bs','hr','es','fr','nl','zh','hi','ru','id','ms','fa']).toContain(getSystemLanguage());
  });
});

describe('applySystemDefaultsIfFirstLaunch', () => {
  it('writes language + firstLaunchDone on first launch', async () => {
    (SettingsRepo.dbGetSettings as jest.Mock).mockResolvedValue({ ...SETTINGS_DEFAULTS, firstLaunchDone: false });
    (SettingsRepo.dbSaveSettings as jest.Mock).mockResolvedValue(undefined);

    const patch = await applySystemDefaultsIfFirstLaunch(db);
    expect(patch).not.toBeNull();
    expect(patch).toMatchObject({ themeMode: 'system', firstLaunchDone: true });
    expect(SettingsRepo.dbSaveSettings).toHaveBeenCalledWith(db, expect.objectContaining({ firstLaunchDone: true }));
  });

  it('returns null when firstLaunchDone is already set', async () => {
    (SettingsRepo.dbGetSettings as jest.Mock).mockResolvedValue({ ...SETTINGS_DEFAULTS, firstLaunchDone: true });
    const patch = await applySystemDefaultsIfFirstLaunch(db);
    expect(patch).toBeNull();
    expect(SettingsRepo.dbSaveSettings).not.toHaveBeenCalled();
  });
});
