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
  const revision = useRef(0);
  const locked = useRef(false);
  const userRef = useRef<User | null>(null);
  const stateRef = useRef<FinanceState | null>(null);
  const load = useCallback(async (nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
    setState(null);
    stateRef.current = null;
    setError("");
    if (!nextUser || !supabase) {
      const demo = seedState();
      stateRef.current = demo;
      setState(demo);
      return;
    }
    const { data, error } = await supabase
      .from("finance_workspaces")
      .select("state,revision")
      .eq("user_id", nextUser.id)
      .maybeSingle();
    if (userRef.current?.id !== nextUser.id) return;
    if (error) {
      setError(
        "Your finances could not be loaded. Check the Supabase setup and try again.",
      );
      return;
    }
    const loaded = data?.state as FinanceState | undefined;
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
  }, []);
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
        void load(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);
  const commit = useCallback(async (next: FinanceState) => {
    if (locked.current)
      throw new Error(
        "A change is still saving. Please try again in a moment.",
      );
    locked.current = true;
    setBusy(true);
    try {
      const currentUser = userRef.current;
      if (currentUser && supabase) {
        const { data, error } = await supabase.rpc("save_finance_workspace", {
          new_state: next,
          expected_revision: revision.current,
        });
        if (error)
          throw new Error(
            error.code === "40001"
              ? "Your finances changed in another tab. Reload before saving again."
              : "We could not save this change. Please try again.",
          );
        if (userRef.current?.id !== currentUser.id) return;
        revision.current = Number(data);
      }
      stateRef.current = next;
      setState(next);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!state) return;
    const scheduled = processRecurring(state, today());
    if (JSON.stringify(scheduled) !== JSON.stringify(state))
      void commit(scheduled).catch((e) => setError(e.message));
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
    commit,
    reload: () => load(userRef.current),
    configured: !!supabase,
  };
}
