export function postgresConnection(databaseUrl: string): {
  connectionString: string;
  env: NodeJS.ProcessEnv;
} {
  const parsed = new URL(databaseUrl);
  const password = decodeURIComponent(parsed.password);
  parsed.password = "";
  return {
    connectionString: parsed.toString(),
    env: password ? { ...process.env, PGPASSWORD: password } : process.env,
  };
}
