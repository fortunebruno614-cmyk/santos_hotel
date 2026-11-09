"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";
import { signOutOfFirebase } from "@/lib/firebase/client";
import { logout } from "@/server/auth/actions";

/**
 * Clears both halves of the session: Firebase's local Google session first,
 * then the app's httpOnly cookie via the existing audited logout action.
 */
export function SignOutButton({
  label,
  icon = false,
  ...props
}: { label: string; icon?: boolean } & Pick<
  ButtonProps,
  "variant" | "size" | "className"
>) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOutOfFirebase();
      await logout();
    });
  }

  return (
    <Button
      type="button"
      {...props}
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
    >
      {icon && <LogOut />}
      {pending ? t("auth.signingOut") : label}
    </Button>
  );
}
