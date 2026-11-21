// Runs before every test file. Integration tests use TEST_DATABASE_URL (never your dev database!).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-123';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-123';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgresql://atsystem:atsystem@localhost:5432/atsystem_test?schema=public';

// Safety net: the integration tests delete every row, so refuse to run against anything that is not clearly a test database.
const dbName = new URL(process.env.DATABASE_URL!).pathname;
if (!/test/i.test(dbName)) throw new Error(`Refusing to run tests: database "${dbName}" does not contain "test". Set TEST_DATABASE_URL.`);
