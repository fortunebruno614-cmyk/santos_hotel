import { NextResponse } from "next/server";

/**
 * P7 console service errors — one vocabulary for every catalog/settings/user
 * mutation, mapped to HTTP by `consoleErrorResponse` so route handlers stay
 * thin and the client always sees a machine-readable `error` key.
 *
 *   400 invalid_body · cannot_change_self
 *   404 not_found
 *   409 conflict (duplicate number/code/name) · in_use (row still referenced)
 *       last_admin · cannot_delete_self
 */
export type ConsoleErrorCode =
  | "invalid_body"
  | "cannot_change_self"
  | "not_found"
  | "conflict"
  | "in_use"
  | "last_admin"
  | "cannot_delete_self";

const CONSOLE_ERROR_STATUS: Record<ConsoleErrorCode, number> = {
  invalid_body: 400,
  cannot_change_self: 400,
  not_found: 404,
  conflict: 409,
  in_use: 409,
  last_admin: 409,
  cannot_delete_self: 409,
};

export class ConsoleError extends Error {
  readonly code: ConsoleErrorCode;
  constructor(code: ConsoleErrorCode, message: string) {
    super(message);
    this.name = "ConsoleError";
    this.code = code;
  }
}

export function consoleErrorResponse(error: unknown): NextResponse {
  if (error instanceof ConsoleError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: CONSOLE_ERROR_STATUS[error.code] },
    );
  }
  console.error("console request failed", error);
  return NextResponse.json({ error: "internal" }, { status: 500 });
}
