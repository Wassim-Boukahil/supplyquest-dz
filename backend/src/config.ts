import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default("2h"),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const values = parsed.data;
const jwtSecret = values.JWT_SECRET ?? values.SESSION_SECRET;

if (!jwtSecret && values.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be configured in production.");
}

export const config = {
  ...values,
  jwtSecret: jwtSecret ?? "supplyquest-development-only-secret",
};