import { execSync } from 'node:child_process';

/** Applies migrations to the disposable test database once per run. */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/oi_tesla_test';
  assertDisposable(url);
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}

export function assertDisposable(url: string) {
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests against "${dbName}": database name must end with _test`);
  }
}
