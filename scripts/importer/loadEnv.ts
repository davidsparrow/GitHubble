/** Loads .env.local (then .env) into process.env for command-line scripts; Next.js does this itself. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Optional: variables may come from the shell instead.
    }
  }
}
