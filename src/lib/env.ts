import { z } from "zod";

// Validate required runtime config once, and fail fast with a message that names
// the offending var — never silently fall back to a dev backend. DATABASE_URL is
// platform-injected and the app is useless without it, so it is hard-required.
// IPINFO_TOKEN gates geo enrichment, which self-heals when it's set later, so it
// is optional but validated when present.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (platform-injected Postgres connection string)"),
  IPINFO_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
