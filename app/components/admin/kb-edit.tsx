import { KbFileEditor } from "~/components/admin/kb-file-editor";
import type { KbEditorActionData } from "~/components/admin/kb-file-editor";
import { KbFormEditor } from "~/components/admin/kb-form";

type Loaded = {
  file: Parameters<typeof KbFileEditor>[0]["file"];
  form: Parameters<typeof KbFormEditor>[0]["form"] | null;
  view: "form" | "file";
  saved: { commit: string; unchanged: boolean } | null;
  created: boolean;
};

/** An entry's or registry item's editor: the form, with the file itself behind Advanced (?view=file). */
export function KbEditPage({
  loaderData: { file, form, view, saved, created },
  actionData,
}: {
  loaderData: Loaded;
  actionData?: KbEditorActionData;
}) {
  if (view === "form" && form) {
    return (
      <KbFormEditor
        key={file.sha}
        file={file}
        form={form}
        saved={saved}
        created={created}
        actionData={actionData}
      />
    );
  }
  return <KbFileEditor key={file.sha} file={file} saved={saved} actionData={actionData} />;
}
