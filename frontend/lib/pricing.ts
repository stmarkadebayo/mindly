"use client";
// Which price to show: naira for people in Nigeria, dollars for everyone else. Two signals, either one is enough: the phone's
// timezone (private, instant) and the country the server sees for the request. A choice made in Settings always wins.
import { useEffect, useState } from "react";
import { api } from "./api";

export type Currency = "NGN" | "USD";
const KEY = "mindly.currency", REGION = "mindly.region";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function usePricing(prices: Partial<Record<Currency, string>> | undefined) {
  const [pick, setPick] = useState<Currency | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const options = (Object.keys(prices ?? {}) as Currency[]);

  useEffect(() => {
    const saved = read(KEY);
    if (saved === "NGN" || saved === "USD") setPick(saved);
    const sync = () => { const v = read(KEY); if (v === "NGN" || v === "USD") setPick(v); };
    window.addEventListener("mindly:currency", sync);
    return () => window.removeEventListener("mindly:currency", sync);
  }, []);

  useEffect(() => {
    if (!options.length) return;
    const cached = read(REGION);
    if (cached) return setCountry(cached);
    api<{ country: string | null }>("/api/region", { quiet: true })
      .then((r) => { setCountry(r.country ?? ""); try { sessionStorage.setItem(REGION, r.country ?? ""); } catch { /* ignore */ } })
      .catch(() => {});
  }, [options.length]); // eslint-disable-line react-hooks/exhaustive-deps

  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* unknown */ }
  const guess: Currency = tz === "Africa/Lagos" || country === "NG" ? "NGN" : "USD";
  const currency: Currency | null = options.length ? (pick && options.includes(pick) ? pick : options.includes(guess) ? guess : options[0]) : null;

  return {
    currency, label: currency ? prices?.[currency] ?? null : null, options,
    choose: (c: Currency) => { setPick(c); try { localStorage.setItem(KEY, c); } catch { /* ignore */ } window.dispatchEvent(new Event("mindly:currency")); },
  };
}
