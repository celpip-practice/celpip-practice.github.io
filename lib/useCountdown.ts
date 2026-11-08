"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Countdown that only ticks while `running`. Resets whenever `resetKey` changes.
 * Calls onExpire once when it reaches zero.
 */
export function useCountdown(seconds: number, running: boolean, onExpire?: () => void, resetKey?: unknown) {
  const [remaining, setRemaining] = useState(seconds);
  const left = useRef(seconds);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    left.current = seconds;
    fired.current = false;
    setRemaining(seconds);
  }, [seconds, resetKey]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      left.current = Math.max(0, left.current - (now - last) / 1000);
      last = now;
      setRemaining(left.current);
      if (left.current <= 0 && !fired.current) {
        fired.current = true;
        expire.current?.();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, seconds, resetKey]);

  return remaining;
}
