import { useCallback, useState } from "react";
import { failureMessage } from "../api/kikitoriApi.ts";
import { useText } from "../i18n/useText.ts";

/** ボタンで動かす操作。動いている間と、失敗の文（API の文か、画面の言語の通信の失敗）を持つ。 */
export function useAction() {
  const { text } = useText();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        await action();
        return true;
      } catch (failure) {
        setError(failureMessage(failure, text.networkError));
        return false;
      } finally {
        setPending(false);
      }
    },
    [text.networkError],
  );
  return { pending, error, run, clearError: () => setError(null) };
}
