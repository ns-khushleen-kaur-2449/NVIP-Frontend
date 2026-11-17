import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';

/**
 * Publishing was refused with 409 stale_draft: another version was published after this draft was made.
 * Rebase (a fresh draft from the latest version, with the user's edits re-applied), Publish anyway (force; only
 * when `canForce`, after a second confirmation naming the version it overwrites), or Cancel.
 *
 * stale: { base_version, published_version } from the refusal; draftVersion: the draft being published.
 */
export default function StaleDraftDialog({ stale, draftVersion, canForce, onRebase, onForce, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(null);
  useEffect(() => { if (stale) { setConfirming(false); setBusy(null); } }, [stale]);

  const run = async (kind, work) => {
    setBusy(kind);
    try { await work(); } finally { setBusy(null); }
  };
  const published = stale?.published_version;
  const base = stale?.base_version;

  return (
    <Dialog open={Boolean(stale)} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="ops max-w-lg rounded-[14px]" data-testid="stale-draft-dialog">
        <DialogHeader>
          <DialogTitle>{confirming ? `Overwrite version ${published}?` : 'A newer version was published'}</DialogTitle>
          <DialogDescription>
            {confirming
              ? `Version ${published} was published after you started. Publishing your draft (version ${draftVersion}) replaces it as the live configuration; its changes are not in your draft.`
              : `This agent was published elsewhere (version ${published ?? '—'}) after you started this draft (based on version ${base ?? 'none'}).`}
          </DialogDescription>
        </DialogHeader>
        {!confirming && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><span className="font-medium">Rebase</span>: start again from version {published}, with your edits re-applied where the fields still exist. Fields changed in both are highlighted.</li>
            {canForce && <li><span className="font-medium">Publish anyway</span>: your draft replaces version {published}.</li>}
          </ul>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <OpsButton variant="quiet" disabled={Boolean(busy)} onClick={confirming ? () => setConfirming(false) : onCancel}>
            {confirming ? 'Back' : 'Cancel'}
          </OpsButton>
          {!confirming && canForce && (
            <OpsButton variant="outline" disabled={Boolean(busy)} onClick={() => setConfirming(true)}>Publish anyway</OpsButton>
          )}
          {!confirming && (
            <OpsButton variant="primary" busy={busy === 'rebase'} disabled={Boolean(busy)} onClick={() => run('rebase', onRebase)}>
              Rebase
            </OpsButton>
          )}
          {confirming && (
            <OpsButton variant="danger" busy={busy === 'force'} disabled={Boolean(busy)} onClick={() => run('force', onForce)}>
              Overwrite version {published}
            </OpsButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
