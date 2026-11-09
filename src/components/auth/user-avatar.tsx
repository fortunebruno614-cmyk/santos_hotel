import { cn } from "@/lib/utils";

/** Initials used when an account has no profile photo (or it fails to load). */
export function userInitials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("user-avatar", className)} aria-hidden="true">
      {src ? (
        // Provider photos are arbitrary remote URLs; next/image would need a
        // per-host allowlist, so a plain img with no-referrer is the safer fit.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <span>{userInitials(name)}</span>
      )}
    </span>
  );
}
