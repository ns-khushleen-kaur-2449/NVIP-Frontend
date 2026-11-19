import { useState } from 'react';
import OpsButton from '@/components/ops/OpsButton';
import { ErrorState } from '@/components/ops/States';
import { errorMessage } from '@/hooks/useApiAction';
import { getRealEstateCallRecording, getRealEstateCallTranscript } from '@/lib/api';
import { NOT_AVAILABLE, isForbidden, isNotFound } from '@/lib/realEstate';

/** A failed load. A 403 says why (not available, or no permission) and offers no retry. */
export function RealEstateError({ error, onRetry }) {
  if (isForbidden(error)) return <ErrorState title={errorMessage(error, NOT_AVAILABLE)} />;
  return <ErrorState message={errorMessage(error, 'Try again in a moment.')} onRetry={onRetry} />;
}

/** A call's transcript and summary, loaded only when asked for (as Hiring's). Never Vapi's raw messages. */
export function CallTranscript({ callId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getRealEstateCallTranscript(callId);
      setText({ transcript: data.transcript || '', summary: data.summary || null });
    } catch (e) {
      setError(isNotFound(e) ? { text: 'No transcript for this call yet.', retry: true }
        : isForbidden(e) ? { text: errorMessage(e, 'You cannot read this transcript.'), retry: false }
          : { text: 'The transcript could not be loaded.', retry: true });
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !text && !loading) load();
  };

  return (
    <div className="space-y-2">
      <OpsButton size="sm" onClick={toggle} aria-expanded={open}>{open ? 'Hide transcript' : 'Show transcript'}</OpsButton>
      {open && (
        <div className="space-y-3 rounded-lg border border-border bg-[hsl(var(--surface-2))] p-3 text-sm">
          {loading && <p className="text-muted-foreground">Loading the transcript…</p>}
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="alert">{error.text}</p>
              {error.retry && <OpsButton size="sm" variant="quiet" onClick={load}>Try again</OpsButton>}
            </div>
          )}
          {text && (
            <>
              {text.summary && (
                <section aria-label="Summary">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h4>
                  <p className="mt-1">{text.summary}</p>
                </section>
              )}
              <section aria-label="Transcript">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</h4>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap font-sans">{text.transcript}</pre>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Plays a call's recording from a fresh short-lived link (as Hiring's); an expired link is fetched once more. */
export function CallRecording({ callId }) {
  const [wanted, setWanted] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [retried, setRetried] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const { data } = await getRealEstateCallRecording(callId);
      setUrl(data.url);
    } catch (e) {
      setError(isNotFound(e) ? { text: 'No recording for this call yet.', retry: true }
        : isForbidden(e) ? { text: errorMessage(e, 'You cannot play this recording.'), retry: false }
          : { text: 'The recording could not be loaded.', retry: true });
    }
  };

  const start = () => {
    setWanted(true);
    setRetried(false);
    load();
  };

  if (!wanted) return <OpsButton size="sm" onClick={start}>Play recording</OpsButton>;
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span role="alert">{error.text}</span>
        {error.retry && <OpsButton size="sm" variant="quiet" onClick={start}>Try again</OpsButton>}
      </div>
    );
  }
  if (!url) return <p className="text-sm text-muted-foreground">Loading the recording…</p>;
  return (
    <audio key={url} controls preload="metadata" className="w-full max-w-md" src={url} data-testid={`recording-${callId}`}
      onError={() => {
        if (!retried) {
          setRetried(true);
          load();
        } else {
          setError({ text: 'The recording could not be played.', retry: true });
        }
      }}>
      Your browser does not support audio playback.
    </audio>
  );
}
