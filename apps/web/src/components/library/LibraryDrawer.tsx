import { prettyNote } from "@reharm/theory-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SketchBox, SketchRule } from "../../design/rough";
import { paper, pen, seedOf } from "../../design/tokens";
import { deleteTune, fetchSetlists, fetchTunes, importIReal, LibraryError, type ImportResult, type Setlist, type TuneSummary } from "../../library/api";

interface Props {
  currentId: string;
  onLoad: (id: string) => Promise<void>;
  onClose: () => void;
}

/** The setlist drawer: your saved tunes, setlists from iReal playlists, and the import box. */
export function LibraryDrawer({ currentId, onLoad, onClose }: Props) {
  const [tunes, setTunes] = useState<TuneSummary[] | null>(null);
  const [lists, setLists] = useState<Setlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [setlist, setSetlist] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const linkRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([fetchTunes(), fetchSetlists()]);
      setTunes(t);
      setLists(l);
      setError(null);
    } catch (e) {
      setError(e instanceof LibraryError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    linkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh, onClose]);

  const shown = useMemo(() => {
    if (!tunes) return [];
    const q = query.trim().toLowerCase();
    const order = setlist ? lists.find((l) => l.name === setlist)?.tuneIds ?? [] : null;
    const pool = order ? order.map((id) => tunes.find((t) => t.id === id)).filter((t): t is TuneSummary => !!t) : tunes;
    return q ? pool.filter((t) => `${t.title} ${t.composer ?? ""} ${t.style ?? ""}`.toLowerCase().includes(q)) : pool;
  }, [tunes, lists, query, setlist]);

  const doImport = async () => {
    if (!link.trim()) return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const r = await importIReal(link);
      setResult(r);
      setLink("");
      await refresh();
      if (r.playlist) setSetlist(r.playlist);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const load = async (id: string) => {
    setLoadingId(id);
    try {
      await onLoad(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTune(id);
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex bg-ink/20" role="dialog" aria-modal="true" aria-labelledby="library-h" onClick={onClose}>
      <div className="h-full w-full max-w-[520px] overflow-y-auto bg-paper p-4 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <SketchBox seed={seedOf("library")} fill={paper.light} strokeWidth={2}>
          <div className="space-y-4 p-4 md:p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="library-h" className="ink-wobble font-marker text-3xl font-bold uppercase">
                  Setlist
                </h2>
                <p className="text-sm text-ink-soft">Your standards, saved locally. Click one to put it on the stand.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close library" className="cursor-pointer font-marker text-2xl leading-none hover:rotate-6">
                ✕
              </button>
            </header>

            {/* import */}
            <section aria-labelledby="import-h" className="space-y-2">
              <h3 id="import-h" className="font-marker text-lg font-bold uppercase">
                Import from iReal Pro
              </h3>
              <textarea
                ref={linkRef}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void doImport();
                }}
                rows={3}
                spellCheck={false}
                placeholder="Paste an irealb:// link: a song, or a whole playlist"
                className="w-full resize-y rounded-md border-2 border-dashed border-ink-soft bg-paper-light p-2 font-mono text-xs text-ink placeholder:font-hand placeholder:text-sm placeholder:text-ink-faint focus:border-solid focus:border-ink focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={doImport}
                  disabled={importing || !link.trim()}
                  className="cursor-pointer rounded-full border-2 border-ink bg-ink px-4 py-1 font-marker text-paper-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? "Reading the chart…" : "Import"}
                </button>
                <span className="text-xs text-ink-faint">In iReal Pro: Share → Copy link (or export a playlist as HTML and copy a link from it).</span>
              </div>
              {importError && (
                <p className="font-marker" style={{ color: pen.red }}>
                  {importError}
                </p>
              )}
              {result && (
                <div className="-rotate-[0.5deg] space-y-1 font-marker text-[15px]" style={{ color: pen.red }}>
                  <p>
                    ✓ {result.imported.length === 1 ? `“${result.imported[0].title}”` : `${result.imported.length} songs`}{" "}
                    {result.imported.every((s) => s.updated) ? "updated" : "imported"}
                    {result.playlist ? ` into the setlist “${result.playlist}”` : ""}.
                  </p>
                  {result.imported
                    .filter((s) => s.warnings.length)
                    .slice(0, 4)
                    .map((s) => (
                      <p key={s.id} className="text-sm">
                        {s.title}: {s.warnings.join(" ")}
                      </p>
                    ))}
                </div>
              )}
            </section>

            <SketchRule seed={seedOf("lib-rule")} />

            {/* browse */}
            <section aria-label="Saved tunes" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, composer, style"
                  className="min-w-0 flex-1 rounded-full border-2 border-ink-soft bg-paper-light px-3 py-1 font-hand text-sm focus:border-ink focus:outline-none"
                />
              </div>
              {lists.length > 0 && (
                <div className="flex flex-wrap gap-2 font-marker text-sm" role="group" aria-label="Filter by setlist">
                  {[null, ...lists.map((l) => l.name)].map((name) => (
                    <button
                      key={name ?? "all"}
                      type="button"
                      aria-pressed={setlist === name}
                      onClick={() => setSetlist(name)}
                      className={`cursor-pointer rounded-full border-2 border-ink px-3 py-0.5 ${setlist === name ? "bg-ink text-paper-light" : "hover:bg-paper-shade"}`}
                    >
                      {name ?? "All tunes"}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <p className="font-marker" style={{ color: pen.red }}>
                  {error}
                </p>
              )}
              {!tunes && !error && <p className="text-ink-soft">Opening the library…</p>}
              {tunes && shown.length === 0 && <p className="text-ink-soft">{query ? "Nothing matches that search." : "No tunes yet. Paste an iReal Pro link above."}</p>}

              <ol className="divide-y-2 divide-dashed divide-ink/20">
                {shown.map((t, i) => {
                  const current = t.id === currentId;
                  return (
                    <li key={t.id} className="flex items-center gap-2 py-2">
                      {setlist && <span className="w-6 shrink-0 text-right font-marker text-ink-faint">{i + 1}.</span>}
                      <button
                        type="button"
                        onClick={() => load(t.id)}
                        disabled={loadingId !== null}
                        className="min-w-0 flex-1 cursor-pointer rounded px-1 text-left hover:bg-paper-shade/60 disabled:cursor-wait"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="truncate font-marker text-lg font-bold">{t.title}</span>
                          {current && (
                            <span className="shrink-0 font-marker text-sm" style={{ color: pen.red }}>
                              ✓ on the stand
                            </span>
                          )}
                          {loadingId === t.id && <span className="text-sm text-ink-soft">loading…</span>}
                        </span>
                        <span className="block truncate text-sm text-ink-soft">
                          {[t.composer, `${prettyNote(t.key)} · ${t.meter}`, t.style, `${t.bars} bars`].filter(Boolean).join(" · ")}
                          {t.warnings.length > 0 && (
                            <span title={t.warnings.join("\n")} className="ml-2" style={{ color: pen.red }}>
                              ⚠ {t.warnings.length} note{t.warnings.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </button>
                      {confirmDelete === t.id ? (
                        <span className="flex shrink-0 items-center gap-2 font-marker text-sm">
                          Delete?
                          <button type="button" onClick={() => remove(t.id)} className="cursor-pointer underline" style={{ color: pen.red }}>
                            yes
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="cursor-pointer underline">
                            no
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(t.id)}
                          disabled={current}
                          aria-label={`Delete ${t.title}`}
                          title={current ? "Load another tune before deleting this one" : "Delete from library"}
                          className="shrink-0 cursor-pointer px-1 font-marker text-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <p className="text-xs text-ink-faint">
              Charts are stored in a local SQLite file (apps/api/data) for personal practice. iReal charts carry chords only, so
              imported tunes have no melody and the melody check is skipped.
            </p>
          </div>
        </SketchBox>
      </div>
    </div>
  );
}
