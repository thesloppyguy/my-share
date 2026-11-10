import { useMemo, useState } from "react";
import { FileText, Files, Image as ImageIcon, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AppSnapshot, ClipboardEntryView } from "@/types";

type ClipboardPageProps = {
  snapshot: AppSnapshot;
};

function kindIcon(kind: string) {
  switch (kind) {
    case "image":
      return <ImageIcon className="size-3.5" />;
    case "files":
      return <Files className="size-3.5" />;
    case "html":
      return <FileText className="size-3.5" />;
    default:
      return <Type className="size-3.5" />;
  }
}

function formatTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function ClipboardPage({ snapshot }: ClipboardPageProps) {
  const entries = snapshot.clipboard_entries;
  const [selectedId, setSelectedId] = useState<string | null>(
    entries[0]?.id ?? null,
  );

  const selected: ClipboardEntryView | null = useMemo(() => {
    if (!entries.length) return null;
    return entries.find((e) => e.id === selectedId) ?? entries[0];
  }, [entries, selectedId]);

  if (!entries.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium">No clipboard history yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copied items will show up here once clipboard sync is enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(220px,34%)_1fr]">
      <aside className="min-h-0 border-r border-border/60">
        <ScrollArea className="h-full">
          <div className="p-2">
            {entries.map((entry) => {
              const active = selected?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={cn(
                    "mb-1 flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {kindIcon(entry.kind)}
                    </span>
                    <Badge variant="secondary" className="capitalize">
                      {entry.kind}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm">{entry.preview || "—"}</p>
                  <p className="text-[0.68rem] text-muted-foreground">
                    {formatTime(entry.created_at_ms)}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <section className="min-h-0 overflow-auto p-5">
        {selected && (
          <div className="mx-auto flex h-full max-w-2xl flex-col">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {selected.kind}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTime(selected.created_at_ms)}
              </span>
            </div>
            <div className="min-h-0 flex-1 rounded-2xl border border-border/60 bg-card p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                {selected.preview || "No preview available"}
              </pre>
            </div>
            {selected.source_device && (
              <p className="mt-3 text-xs text-muted-foreground">
                Source device: {selected.source_device}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
