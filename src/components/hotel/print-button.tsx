"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";

export function PrintButton() {
  const t = useT();
  return (
    <Button variant="outline" type="button" onClick={() => window.print()}>
      <Printer />
      {t("confirmation.print")}
    </Button>
  );
}
