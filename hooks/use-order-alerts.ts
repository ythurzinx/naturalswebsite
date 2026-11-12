"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type OrderEvent = {
  id: number;
  order_id: string;
  kind: string;
  state: string;
  current_state?: string;
  total_cents: number;
  created_at: number;
};
type Feed = {
  cursor: number;
  events: OrderEvent[];
  counts: { toPack: number; ready: number; pending: number };
  hasMore: boolean;
};
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
export function useOrderAlerts(active: boolean, api: Api) {
  const [sound, setSound] = useState(false),
    [allOrders, setAllOrders] = useState(false),
    [events, setEvents] = useState<OrderEvent[]>([]),
    [counts, setCounts] = useState<Feed["counts"] | null>(null),
    [connected, setConnected] = useState(false),
    [revision, setRevision] = useState(0),
    [audioError, setAudioError] = useState("");
  const audio = useRef<AudioContext | null>(null),
    soundRef = useRef(false),
    allRef = useRef(false),
    sequence = useRef<number | null>(null);
  const chime = useCallback(async () => {
    const context = audio.current;
    if (!context || context.state !== "running") {
      setSound(false);
      soundRef.current = false;
      return;
    }
    const start = context.currentTime;
    [659.25, 880, 987.77].forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + index * 0.17);
      gain.gain.linearRampToValueAtTime(0.18, start + index * 0.17 + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + index * 0.17 + 0.28,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start + index * 0.17);
      oscillator.stop(start + index * 0.17 + 0.3);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
    // Local event lets browser verification observe scheduled audio without
    // collecting or exposing any customer information.
    window.dispatchEvent(new Event("mn-order-sound"));
  }, []);
  async function enableSound() {
    try {
      if (!audio.current || audio.current.state === "closed")
        audio.current = new AudioContext();
      await audio.current.resume();
      if (audio.current.state !== "running") throw Error();
      soundRef.current = true;
      setSound(true);
      setAudioError("");
      await chime();
    } catch {
      soundRef.current = false;
      setSound(false);
      setAudioError(
        "O navegador bloqueou o áudio. Toque novamente em ativar e confira o volume do aparelho.",
      );
    }
  }
  function mute() {
    soundRef.current = false;
    setSound(false);
  }
  useEffect(() => {
    if (!active) {
      sequence.current = null;
      setEvents([]);
      setCounts(null);
      setConnected(false);
      soundRef.current = false;
      setSound(false);
      void audio.current?.suspend();
      return;
    }
    let stopped = false,
      loading = false,
      timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      if (stopped || loading) return;
      clearTimeout(timer);
      loading = true;
      let delay = document.hidden ? 20000 : 10000;
      try {
        const baseline = sequence.current === null;
        const result = await api<Feed>(
          `order-alerts${baseline ? "" : `?after=${sequence.current}`}`,
        );
        if (stopped) return;
        sequence.current = result.cursor;
        setCounts(result.counts);
        setConnected(true);
        failures = 0;
        // Authenticated POST includes the admin CSRF token; polling GET never sends messages.
        void api("notifications/drain", "POST", {}).catch(() => {});
        if (!baseline && result.events.length) {
          setRevision((value) => value + 1);
          const incoming = result.events.filter(
            (event) =>
              (!event.current_state || event.current_state === event.state) &&
              (event.kind === "paid" ||
                (allRef.current && event.kind === "created")),
          );
          if (incoming.length) {
            setEvents((prior) => [...incoming.reverse(), ...prior].slice(0, 8));
            if (soundRef.current) await chime();
          }
        }
        if (result.hasMore) delay = 200;
      } catch {
        if (!stopped) {
          setConnected(false);
          failures++;
          delay = Math.min(60000, 10000 * 2 ** Math.min(failures, 3));
        }
      } finally {
        loading = false;
        if (!stopped) timer = setTimeout(poll, delay);
      }
    }
    function resume() {
      if (!document.hidden) void poll();
    }
    void poll();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [active, api, chime]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return {
    sound,
    allOrders,
    events,
    counts,
    connected,
    revision,
    audioError,
    enableSound,
    mute,
    testSound: chime,
    setAllOrders: (value: boolean) => {
      allRef.current = value;
      setAllOrders(value);
    },
    clear: () => setEvents([]),
  };
}
