"use client";
import { useEffect, useState } from "react";
import { loadIndex, loadTest } from "@/lib/content";
import type { Test, TestSummary } from "@/lib/types";

export function useIndex() {
  const [tests, setTests] = useState<TestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadIndex().then(setTests).catch((e) => setError(String(e)));
  }, []);
  return { tests, error };
}

export function useTest(id: string | null) {
  const [test, setTest] = useState<Test | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    setTest(null);
    loadTest(id).then(setTest).catch((e) => setError(String(e)));
  }, [id]);
  return { test, error };
}
