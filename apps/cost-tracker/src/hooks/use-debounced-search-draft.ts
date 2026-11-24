"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Keeps a text input's draft in step with URL-backed search state.
 *
 * A pending debounced write must not outlive an external URL change: Clear
 * filters, browser back/forward, or another reset replaces the draft and
 * cancels the pending write, so the cleared search stays cleared. An
 * acknowledgement of our own last push is not an external change; it leaves
 * newer typing and its pending write alone.
 *
 * `resetDraft` exists for a clear action that resets other filters while the
 * URL search is already empty: the URL search value does not change, so the
 * effect cannot observe it, and the caller cancels the pending write itself.
 *
 * The pending callback reads the latest `push` through a ref. A filter change
 * committed during the debounce window therefore contributes its newest
 * state instead of the state captured when the keystroke was typed.
 */
export function useDebouncedSearchDraft({
  urlSearch,
  push,
}: {
  urlSearch: string;
  push: (search: string) => void;
}) {
  const timeout = useRef<number>(undefined);
  const acknowledged = useRef(urlSearch);
  const pushRef = useRef(push);
  const [draft, setDraft] = useState(urlSearch);

  useEffect(() => {
    pushRef.current = push;
  });

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  const resetDraft = useCallback(
    (search = urlSearch) => {
      window.clearTimeout(timeout.current);
      timeout.current = undefined;
      acknowledged.current = search;
      setDraft(search);
    },
    [urlSearch],
  );

  useEffect(() => {
    if (urlSearch !== acknowledged.current) resetDraft();
  }, [resetDraft, urlSearch]);

  const onChange = (search: string) => {
    setDraft(search);
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => {
      acknowledged.current = search;
      pushRef.current(search);
    }, SEARCH_DEBOUNCE_MS);
  };

  return { draft, onChange, resetDraft };
}
