// Defaults so unit tests can import modules that read the environment.
// Integration tests need TEST_DATABASE_URL pointing at a disposable database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-please-change-0123456789';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/oi_tesla_test';
