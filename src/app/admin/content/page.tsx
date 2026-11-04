import { listContent } from "@/server/console/settings";
import { getConsoleContext } from "@/server/console/context";
import { ContentEditor } from "./content-editor";

/** Website content (P7, admin only): hero, rooms intro, footer copy. */
export default async function AdminContentPage() {
  const { hotel } = await getConsoleContext();
  const slots = await listContent(hotel.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="text-sm text-zinc-500">
          Editable copy on the public site. Saving publishes immediately; resetting restores the
          built-in default text.
        </p>
      </div>
      <ContentEditor slots={slots} />
    </div>
  );
}
