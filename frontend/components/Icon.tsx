// Clean line icons for controls (the hand-drawn style is kept for illustration, not for tap targets).

const paths = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  pause: <path d="M9 6v12M15 6v12" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  send: <path d="M12 19V6M6 11.5L12 5.5l6 6" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></>,
  chev: <path d="M9 5l7 7-7 7" />,
  compose: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  chart: <path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" />,
  shuffle: <path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.3 3.4-3M14 10c.8-1.7 1.8-3 3.5-3H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5" />,
  device: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  image: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9.5" r="1.5" /><path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
  );
}
