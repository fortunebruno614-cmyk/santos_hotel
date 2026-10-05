import { z } from "zod";

/**
 * Shared credential validation for every entry point (server actions *and* API
 * routes), so the forms cannot be stricter than the endpoints behind them.
 */

export const EmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email();

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const CredentialsSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});

export const SignupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: EmailSchema,
  password: PasswordSchema,
});
