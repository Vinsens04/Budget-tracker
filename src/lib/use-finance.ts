"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  emptyState,
  processRecurring,
  seedState,
  today,
  type FinanceState,
} from "./finance";
export function useFinance() {
  const [state, setState] = useState<FinanceState | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const revision = useRef(0);
  const locked = useRef(false);
  const userRef = useRef<User | null>(null);
  const stateRef = useRef<FinanceState | null>(null);
  const refreshing = useRef(false);
  const load = useCallback(
    async (nextUser: User | null, quiet = false, afterConflict = false) => {
      if (
        quiet &&
        ((!afterConflict && locked.current) || refreshing.current || !nextUser)
      )
        return;
      refreshing.current = true;
      const startedRevision = revision.current;
      userRef.current = nextUser;
      setUser(nextUser);
      if (!quiet) {
        setState(null);
        stateRef.current = null;
        setError("");
      }
      if (!nextUser || !supabase) {
        const demo = seedState();
        stateRef.current = demo;
        setState(demo);
        revision.current = 0;
        refreshing.current = false;
        return;
      }
      const { data, error } = await supabase
        .from("finance_workspaces")
        .select("state,revision")
        .eq("user_id", nextUser.id)
        .abortSignal(AbortSignal.timeout(20000))
        .maybeSingle();
      refreshing.current = false;
      if (userRef.current?.id !== nextUser.id) return;
      if (
        quiet &&
        ((!afterConflict && locked.current) ||
          revision.current !== startedRevision)
      )
        return;
      if (error) {
        setError(
          "Your finances could not be loaded. Check your connection and try again.",
        );
        return;
      }
      const loaded = data?.state as FinanceState | undefined;
      if (
        quiet &&
        ((!data && revision.current === 0) ||
          data?.revision === revision.current)
      ) {
        setError("");
        return;
      }
      revision.current = data?.revision ?? 0;
      const base =
        loaded ??
        emptyState(
          nextUser.user_metadata.full_name ||
            nextUser.email?.split("@")[0] ||
            "Friend",
        );
      stateRef.current = base;
      setState(base);
      setError("");
    },
    [],
  );
  useEffect(() => {
    if (!supabase) {
      void load(null);
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError("Your session could not be restored.");
      void load(data.session?.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if ((session?.user.id ?? null) !== (userRef.current?.id ?? null))
        setTimeout(() => void load(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);
  useEffect(() => {
    const reconnect = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine && document.visibilityState === "visible")
        void load(userRef.current, true);
    };
    setOffline(!navigator.onLine);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    window.addEventListener("focus", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    const interval = setInterval(reconnect, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
      window.removeEventListener("focus", reconnect);
      document.removeEventListener("visibilitychange", reconnect);
    };
  }, [load]);
  const commit = useCallback(
    async (next: FinanceState, base = stateRef.current) => {
      if (base !== stateRef.current)
        throw new Error(
          "Your finances have refreshed. Review your change and save again.",
        );
      if (locked.current)
        throw new Error(
          "A change is still saving. Please try again in a moment.",
        );
      locked.current = true;
      setBusy(true);
      try {
        const currentUser = userRef.current;
        if (currentUser && supabase) {
          if (!navigator.onLine)
            throw new Error(
              "You’re offline. Reconnect, then save again. Your form is still here.",
            );
          const { data, error } = await supabase
            .rpc("save_finance_workspace", {
              new_state: next,
              expected_revision: revision.current,
            })
            .abortSignal(AbortSignal.timeout(20000));
          if (error) {
            const conflict = ["40001", "23505"].includes(error.code);
            if (conflict) await load(currentUser, true, true);
            throw new Error(
              conflict
                ? "Your finances changed elsewhere. The latest data is loaded; review your change and save again."
                : "We could not save this change. Please try again.",
            );
          }
          if (userRef.current?.id !== currentUser.id)
            throw new Error(
              "Your account changed. Sign in again before saving.",
            );
          revision.current = Number(data);
        }
        stateRef.current = next;
        setState(next);
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [load],
  );
  useEffect(() => {
    if (!state) return;
    const scheduled = processRecurring(state, today());
    if (JSON.stringify(scheduled) !== JSON.stringify(state))
      void commit(scheduled, state).catch((e) => setError(e.message));
  }, [state, commit]);
  useEffect(() => {
    if (!state) return;
    const pref = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        state.settings.theme === "system"
          ? pref.matches
            ? "dark"
            : "light"
          : state.settings.theme);
    apply();
    pref.addEventListener("change", apply);
    return () => pref.removeEventListener("change", apply);
  }, [state?.settings.theme]);
  return {
    state,
    user,
    busy,
    error,
    offline,
    commit,
    reload: () => load(userRef.current),
    configured: !!supabase,
  };
}
