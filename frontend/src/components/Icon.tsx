interface IconProps {
  name:
    | 'people'
    | 'chat'
    | 'music'
    | 'mood'
    | 'leave'
    | 'send'
    | 'play'
    | 'pause'
    | 'next'
    | 'prev'
    | 'x'
    | 'check'
    | 'gear'
    | 'plus'
    | 'queue-add'
    | 'trash'
    | 'mic'
    | 'mic-off'
    | 'list'
    | 'screen'
    | 'grip'
    | 'yt'
    | 'marquee'
    | 'link'
    | 'totop'
    | 'vol'
    | 'volx';
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 18, color = 'currentColor' }: IconProps) {
  const sw = 1.7;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'people':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3.2" />
          <circle cx="17" cy="10.5" r="2.4" />
          <path d="M3 19c.7-3 3.2-4.5 6-4.5s5.3 1.5 6 4.5" />
          <path d="M14 18.5c.5-2.2 2.3-3.3 4-3.3 1.4 0 2.4.6 3 1.5" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <path d="M9 18V6l11-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="17.5" cy="16" r="2.5" />
        </svg>
      );
    case 'mood':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M8.5 14.5c1 1.4 2.4 2 3.5 2s2.5-.6 3.5-2" />
        </svg>
      );
    case 'leave':
      return (
        <svg {...common}>
          <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
          <path d="M10 17l-5-5 5-5" />
          <path d="M5 12h11" />
        </svg>
      );
    case 'send':
      return (
        <svg {...common}>
          <path d="M3 12l18-8-7 18-3-8z" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M7 5v14l12-7z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common} fill={color} stroke="none">
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
      );
    case 'next':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M5 5v14l10-7zM16 5h3v14h-3z" />
        </svg>
      );
    case 'prev':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M19 5v14L9 12zM5 5h3v14H5z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6l-12 12" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12l4 4 10-11" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h.1a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'queue-add':
      return (
        <svg {...common}>
          <path d="M3 7h13M3 12h13M3 17h7" />
          <path d="M18 14v6M15 17h6" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
          <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0" />
          <path d="M12 18v3M9 21h6" />
        </svg>
      );
    case 'mic-off':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0" />
          <path d="M12 18v3M9 21h6" />
          <path d="M4 4l16 16" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case 'screen':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="12" rx="1" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'grip':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
          <circle cx="9" cy="6" r="1.4" />
          <circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" />
          <circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" />
          <circle cx="15" cy="18" r="1.4" />
        </svg>
      );
    case 'yt':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
          <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18 5 12 5 12 5s-6 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C6 19 12 19 12 19s6 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5 3z" />
        </svg>
      );
    case 'marquee':
      // Rounded rectangle frame (the strip) with two rows of segmented
      // dashes inside, offset between rows so the eye reads "scrolling
      // text" rather than just "list."
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="1.2" />
          <path d="M6 11h6" />
          <path d="M14 11h4" />
          <path d="M6 13.5h4" />
          <path d="M12 13.5h7" />
        </svg>
      );
    case 'link':
      // Two interlocking chain-link capsules at 45°. Same construction
      // as Feather/Lucide's "link" — reads instantly as a URL.
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case 'totop':
      return (
        <svg {...common}>
          <path d="M5 4h14" />
          <path d="M12 20V9" />
          <path d="M7 13l5-5 5 5" />
        </svg>
      );
    case 'vol':
      return (
        <svg {...common}>
          <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" />
          <path d="M15.5 9a4 4 0 0 1 0 6" />
          <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
        </svg>
      );
    case 'volx':
      return (
        <svg {...common}>
          <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" />
          <path d="M16 9.5l5 5" />
          <path d="M21 9.5l-5 5" />
        </svg>
      );
    default:
      return null;
  }
}
