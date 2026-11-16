// Line icons for the interface, drawn on a 24 x 24 grid.
const PATHS = {
  floor: '<path d="M3 16.5 12 21l9-4.5M3 12l9 4.5 9-4.5M12 3 3 7.5 12 12l9-4.5L12 3Z"/>',
  wall: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/>',
  window: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M12 3v18M4.5 12h15"/>',
  cabinet: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M12 3.5v17M9.5 10.5v3M14.5 10.5v3"/>',
  counter: '<path d="M2.5 9h19M4.5 9v11.5h15V9M9.5 13.5h5"/><path d="M7 9V6.5a2 2 0 0 1 2-2h1"/>',
  backsplash: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  furniture: '<path d="M6.5 11V6.5a2.5 2.5 0 0 1 2.5-2.5h6a2.5 2.5 0 0 1 2.5 2.5V11"/><path d="M4 11.5a1.75 1.75 0 0 1 3.5 0V14h9v-2.5a1.75 1.75 0 0 1 3.5 0V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5ZM6.5 18v2M17.5 18v2"/>',
  art: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="m6.5 16.5 3.6-4.2 2.6 2.8 1.9-2 2.9 3.4"/><circle cx="15.2" cy="8.6" r="1.3"/>',
  upgrades: '<path d="M11 3.5 12.6 9 18 10.5 12.6 12 11 17.5 9.4 12 4 10.5 9.4 9 11 3.5Z"/><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
  lighting: '<path d="M12 3v4.5"/><path d="M6 14.5a6 6 0 0 1 12 0H6Z"/><path d="M10.2 17.8a1.9 1.9 0 0 0 3.6 0"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-1.5"/>',
  turnLeft: '<path d="M4 5v5h5"/><path d="M4.6 10A8 8 0 1 1 4 13.5"/>',
  turnRight: '<path d="M20 5v5h-5"/><path d="M19.4 10A8 8 0 1 0 20 13.5"/>',
  rotate: '<path d="M20 5v5h-5"/><path d="M19.4 10A8 8 0 1 0 20 13.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M6.5 6.5l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3l.8-12.2M10 10.5v6M14 10.5v6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  home: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M5.5 9.500V19a1 1 0 0 0 1 1h3.500v-5.500h4V20h3.500a1 1 0 0 0 1-1V9.5"/>',
  layout: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.500h11.500v11M9.5 9.500V3.5"/>',
  broom: '<path d="m14 10 6.5-6.500M11 8.500l4.5 4.500M11 8.5 4 14l1.5 1.500L4 18l2.5-.5L8 20.500l2.5-2 .5 2 4.5-7.5"/>',
  hammer: '<path d="m13.5 9.5-9.3 9.300a1.4 1.4 0 0 0 2 2l9.3-9.3"/><path d="m11.5 6 3-2.500h3L21 7l-1.5 1.5-1.5-.5-3 3-3.5-3.5 1-1Z"/>',
  wrench: '<path d="M14.5 6.500a4 4 0 0 0-5.3 5L3.8 17a1.8 1.8 0 0 0 2.6 2.600l5.4-5.400a4 4 0 0 0 5-5.300l-2.6 2.6-2.2-.6-.6-2.2 2.6-2.600Z"/>',
  alert: '<path d="M12 4 2.8 19.500h18.400L12 4Z"/><path d="M12 10v4.500M12 17.200v.1"/>',
  phone: '<path d="M6.5 3.500h3l1.5 4-2 1.500a11 11 0 0 0 6 6l1.5-2 4 1.500v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.700a2 2 0 0 1 2-2.200Z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.500v.1M15.5 8.500v.1M12 12v.1M8.5 15.500v.1M15.5 15.500v.1"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  wallet: '<path d="M4 7.500A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11.5" rx="2"/><path d="M16.5 13.700v.1"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.500v9M14.5 9.700c-.4-.8-1.3-1.2-2.5-1.2-1.5 0-2.5.7-2.5 1.8 0 2.6 5 1.1 5 3.7 0 1.1-1 1.8-2.5 1.8-1.2 0-2.1-.4-2.5-1.2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  infinity: '<path d="M12 12c-1.7-2.3-3.2-3.5-5-3.500a3.5 3.5 0 0 0 0 7c1.8 0 3.3-1.2 5-3.500Zm0 0c1.7 2.3 3.2 3.5 5 3.500a3.5 3.5 0 0 0 0-7c-1.8 0-3.3 1.2-5 3.500Z"/>',
  play: '<path d="M7.5 5.200v13.600a.6.6 0 0 0 .9.500l11-6.800a.6.6 0 0 0 0-1l-11-6.800a.6.6 0 0 0-.9.500Z"/>',
  pause: '<path d="M8.5 5.500v13M15.5 5.500v13"/>',
} as const;

export type IconName = keyof typeof PATHS;

export const icon = (name: IconName, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;

const STAR = 'M12 3.200l2.7 5.6 6.1.8-4.5 4.3 1.1 6.100L12 17.1 6.6 20l1.1-6.100L3.2 9.600l6.1-.8L12 3.200Z';

// A row of five stars, filled up to the rating (halves allowed).
export function stars(rating: number, size = 18): string {
  let out = '';
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, rating - i));
    out += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}" class="star-off"/>${
      fill > 0 ? `<path d="${STAR}" class="star-on" ${fill < 1 ? 'style="clip-path:inset(0 50% 0 0)"' : ''}/>` : ''
    }</svg>`;
  }
  return `<span class="stars" role="img" aria-label="${rating} out of 5 stars">${out}</span>`;
}
