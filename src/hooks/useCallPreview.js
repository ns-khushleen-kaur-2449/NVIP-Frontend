// F-08: the server's call preview for `request` (a function returning an axios promise), fetched `delay` ms after
// the last change of `key` (a string describing the inputs) and only the newest answer kept. No local rendering.
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/hooks/useApiAction';

export const PREVIEW_DELAY_MS = 500;

export default function useCallPreview(request, key, { enabled = true, delay = PREVIEW_DELAY_MS } = {}) {
  const [state, setState] = useState({ preview: null, loading: false, error: null });
  const latest = useRef(0);
  const requestRef = useRef(request);
  requestRef.current = request;
  useEffect(() => {
    if (!enabled) return undefined;
    const ticket = latest.current + 1;
    latest.current = ticket;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      requestRef.current()
        .then((response) => { if (latest.current === ticket) setState({ preview: response.data, loading: false, error: null }); })
        .catch((e) => {
          if (latest.current === ticket) setState({ preview: null, loading: false, error: errorMessage(e, 'Could not load the preview') });
        });
    }, delay);
    return () => clearTimeout(timer);
  }, [key, enabled, delay]);
  return state;
}
