"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Keeps a text input's draft in step with URL-backed search state.
 *
 * A pending debounced write must not outlive an external URL change: Clear
 * filters, browser back/forward, or another reset replaces the draft and
 * cancels the pending write, so the cleared search stays cleared. An
 * acknowledgement of our own last push is not an external change; it leaves
 * newer typing and its pending write alone.
 *
 * The pending callback reads the latest `push` through a ref. A filter change
 * committed during the debounce window therefore contributes its newest
 * state instead of the state captured when the keystroke was typed.
 */
export function useDebouncedSearchDraft({
  urlSearch,
  push,
  delayMs = DEFAULT_DEBOUNCE_MS,
}: {
  urlSearch: string;
  push: (search: string) => void;
  delayMs?: number;
}) {
  const timeout = useRef<number>(undefined);
  const lastPushed = useRef(urlSearch);
  const latestPush = useRef(push);
  const [draft, setDraft] = useState(urlSearch);

  useEffect(() => {
    latestPush.current = push;
  });

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  useEffect(() => {
    if (urlSearch === lastPushed.current) return;
    window.clearTimeout(timeout.current);
    timeout.current = undefined;
    lastPushed.current = urlSearch;
    setDraft(urlSearch);
  }, [urlSearch]);

  const onChange = (search: string) => {
    setDraft(search);
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => {
      lastPushed.current = search;
      latestPush.current(search);
    }, delayMs);
  };

  return { draft, onChange };
}
