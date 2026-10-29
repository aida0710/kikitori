import { useCallback, useEffect, useState } from "react";

export interface QueryState<T> {
  value: T | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/** 画面を開いたとき（と reload のとき、pollMs ごと）に読む。前の読み込みは止める。 */
export function useQuery<T>({
  key,
  load,
  pollMs,
}: {
  key: string;
  load: (signal: AbortSignal) => Promise<T>;
  pollMs?: number;
}): QueryState<T> {
  const [value, setValue] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .then((loaded) => {
        setValue(loaded);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // load は画面ごとに決まった関数なので、key が同じなら読み直さない
  }, [key, generation]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(reload, pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, reload]);

  return { value, loading, error, reload };
}
