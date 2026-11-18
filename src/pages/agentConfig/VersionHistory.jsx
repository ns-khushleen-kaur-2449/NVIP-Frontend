import { displayTimeZone, formatDateTime } from '@/lib/ops';
import { cn } from '@/lib/utils';

/**
 * Every version of the agent, newest first (GET /api/v1/agent-instances/{type} → versions), as a compact list for the
 * editor's left column: the name opens it (read only); on the right, "Editing" for the open draft, "Live" for the
 * published version, "Restore" where restoring is allowed (no open draft), else its status. A discarded draft leaves
 * its number unused, so gaps are normal. Author names come from the API (created_by_name / published_by_name).
 */
export default function VersionHistory({ versions = [], user, canRestore, editingVersion, busy, onView, onRestore }) {
  const zone = displayTimeZone(user);
  const who = (id, name) => (id == null ? 'the system' : name || `user #${id}`);
  if (!versions.length) return <p className="mt-2 text-sm text-muted-foreground">No versions yet.</p>;
  return (
    <ol className="mt-2 space-y-1" aria-label="Versions">
      {versions.map((v) => {
        const draft = v.status === 'draft';
        // Who published it when that is known, else who created it.
        const author = v.published_by != null ? who(v.published_by, v.published_by_name) : who(v.created_by, v.created_by_name);
        const when = formatDateTime(v.published_at || v.created_at, zone);
        let right;
        if (draft) right = <span className="text-primary">{v.version === editingVersion ? 'Editing' : 'Draft'}</span>;
        else if (v.status === 'published') right = <span className="text-emerald-500">Live</span>;
        else if (canRestore) {
          right = (
            <button type="button" disabled={busy} onClick={() => onRestore(v)}
              className="text-primary underline underline-offset-2 hover:no-underline disabled:opacity-50">
              Restore<span className="sr-only"> version {v.version} as a draft</span>
            </button>
          );
        } else right = <span className="text-muted-foreground">Superseded</span>;
        return (
          <li key={v.id} className="flex items-center justify-between gap-2 py-1 text-sm" data-testid={`version-${v.version}`}
            title={`${draft ? 'Draft' : 'Version'} ${v.version} · ${author} · ${when}`}>
            <button type="button" onClick={() => onView(v)}
              className={cn('min-w-0 truncate text-left hover:underline underline-offset-2',
                v.status === 'superseded' ? 'text-muted-foreground' : 'font-medium text-foreground')}>
              {draft ? `Draft ${v.version}` : `Version ${v.version}`}
              {!draft && <span className="font-normal"> · {author}</span>}
              {v.restored_from_version && <span className="text-xs font-normal text-muted-foreground"> (from v{v.restored_from_version})</span>}
            </button>
            <span className="shrink-0">{right}</span>
          </li>
        );
      })}
    </ol>
  );
}
