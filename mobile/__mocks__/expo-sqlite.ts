// Minimal expo-sqlite mock for jest unit tests.
// Hook tests that call useSQLiteContext() will receive this mock DB.
// Repository functions that accept `db: SQLiteDatabase` can be tested by
// passing `mockDb` directly or by mocking the repository module itself.

export const mockDb = {
  runAsync:            jest.fn().mockResolvedValue(undefined),
  getAllAsync:         jest.fn().mockResolvedValue([]),
  getFirstAsync:      jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation((cb: () => Promise<void>) => cb()),
};

export const useSQLiteContext = jest.fn().mockReturnValue(mockDb);

export const SQLiteProvider = ({ children }: { children: React.ReactNode }) => children;
