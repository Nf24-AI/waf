import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

/**
 * Single-user access state.
 *
 * Replaces the Manus OAuth hook, which could only resolve inside the Manus
 * platform. The server reports whether a password gate is configured
 * (`locked`) and whether this browser has passed it (`unlocked`).
 */
export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const unlockMutation = trpc.auth.unlock.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const touchMutation = trpc.auth.touch.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });

  const unlock = useCallback(
    async (password: string) => {
      const result = await unlockMutation.mutateAsync({ password });
      return result.success;
    },
    [unlockMutation]
  );

  /**
   * Tell the server someone is still here, so its idle window slides too.
   *
   * A failure here means the session is already gone. Swallowing it would
   * leave a workspace that looks unlocked until the next save fails, with
   * whatever was typed still unsaved — so re-read the lock state instead and
   * let the gate come back now, while there is nothing to lose.
   */
  const keepAlive = useCallback(() => {
    touchMutation.mutate(undefined, { onError: () => void utils.auth.me.invalidate() });
  }, [touchMutation, utils]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return {
    locked: meQuery.data?.locked ?? false,
    // Assume open until told otherwise so the workspace does not flash a gate.
    unlocked: meQuery.data?.unlocked ?? true,
    loading: meQuery.isLoading,
    error: meQuery.error ?? unlockMutation.error ?? null,
    unlock,
    unlocking: unlockMutation.isPending,
    logout,
    keepAlive,
    refresh: () => meQuery.refetch(),
  };
}
