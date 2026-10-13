import { getContent } from "@/server/console/settings";

/**
 * Public footer copy — editable in the admin console (`site.footer` slot) and
 * rendered with the built-in default whenever the slot has no stored value.
 */
export async function SiteFooter() {
  const footer = await getContent("site.footer");
  if (!footer) return null;

  return (
    <footer className="mt-auto border-t border-black/10 px-6 py-6 text-center dark:border-white/10">
      <p className="text-sm font-medium">{footer.title}</p>
      <p className="mt-1 text-sm text-zinc-500">{footer.body}</p>
    </footer>
  );
}
