import type { SVGProps } from "react";

const paths = {
  sidebar: "M9 3v18M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
  search: "M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  plus: "M12 5v14M5 12h14",
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5",
  arrow: "M12 19V5m-6 6 6-6 6 6",
  down: "M12 5v14m-6-6 6 6 6-6",
  stop: "M6 6h12v12H6Z",
  check: "m5 12 4 4L19 6",
  copy: "M9 8h11v13H9ZM16 8V3H4v13h5",
  retry: "M3 10a9 9 0 1 1 2 9M3 4v6h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  pin: "m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  moon: "M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  monitor: "M3 3h18v13H3ZM12 16v5m-5 0h10",
  chevron: "m8 10 4 4 4-4",
  close: "m6 6 12 12M6 18 18 6",
  spark: "m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z",
  chat: "M21 4v13H9l-6 4V4h18Z",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  book: "M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2V3Z",
} as const;

export type IconName = keyof typeof paths;
export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
