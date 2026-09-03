import { useEffect, useState } from "react";

export interface StableAsyncState<T, E = unknown> {
  loading: boolean;
  refreshing: boolean;
  value?: T;
  error?: E;
}

/**
 * Keep the last successful value mounted while dependencies refresh.
 *
 * Desktop filters and language preferences are intentionally client-side.
 * Replacing a tall result page with a tiny loading card causes the WebView to
 * clamp scrollTop back to zero. This hook uses a stale-while-refresh contract:
 * only the first load is blocking; subsequent refreshes keep the current DOM
 * height and swap in the new value when ready.
 */
export function useStableAsyncData<T, E = unknown>(
  factory: () => Promise<T>,
  dependencies: readonly unknown[],
  mapError: (error: unknown) => E = ((error) => error as E),
): StableAsyncState<T, E> {
  const [state, setState] = useState<StableAsyncState<T, E>>({
    loading: true,
    refreshing: false,
  });

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let disposed = false;
    setState((current) => current.value !== undefined
      ? { ...current, loading: false, refreshing: true, error: undefined }
      : { loading: true, refreshing: false });

    void factory().then((value) => {
      if (!disposed) setState({ loading: false, refreshing: false, value });
    }).catch((error: unknown) => {
      if (disposed) return;
      setState((current) => current.value !== undefined
        ? { ...current, loading: false, refreshing: false }
        : { loading: false, refreshing: false, error: mapError(error) });
    });

    return () => { disposed = true; };
  }, dependencies);
  /* eslint-enable react-hooks/exhaustive-deps */

  return state;
}
