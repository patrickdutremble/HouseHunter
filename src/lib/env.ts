export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local (development) or your deployment environment (production).`
    )
  }
  return value
}
