import type { BackgroundId } from '../types';

function LcdBackground() {
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="lcd-tile" width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill="#c8d5b5" />
          <path d="M 0 48 L 0 0 L 48 0" fill="none" stroke="rgba(45,39,64,0.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1280" height="720" fill="url(#lcd-tile)" />
    </svg>
  );
}

function ClassroomBackground() {
  const shelfBooks: Array<[number, number, string]> = [
    [90, 210, '#d6353d'], [108, 210, '#3f8ad0'], [126, 210, '#ffd866'], [144, 210, '#5a9c3e'],
    [90, 250, '#9670c9'], [110, 250, '#d65981'], [130, 250, '#3f8ad0'],
    [92, 290, '#ffd866'], [112, 290, '#5a9c3e'], [132, 290, '#d6353d'],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="wood-floor" width="160" height="80" patternUnits="userSpaceOnUse">
          <rect width="160" height="80" fill="#b8865a" />
          <line x1="0" y1="80" x2="160" y2="80" stroke="#8a5e2c" strokeWidth="2" />
          <line x1="80" y1="0" x2="80" y2="80" stroke="#8a5e2c" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="1280" height="130" fill="#ebd9a3" />
      <rect y="124" width="1280" height="18" fill="#7a5028" />
      <rect y="142" width="1280" height="578" fill="url(#wood-floor)" />

      <rect x="80" y="20" width="180" height="92" fill="#5a3a1a" />
      <rect x="92" y="32" width="156" height="68" fill="#a3cef1" />
      <ellipse cx="160" cy="58" rx="30" ry="10" fill="white" opacity="0.7" />
      <line x1="170" y1="32" x2="170" y2="100" stroke="#5a3a1a" strokeWidth="3" />
      <line x1="92" y1="66" x2="248" y2="66" stroke="#5a3a1a" strokeWidth="3" />
      <rect x="440" y="14" width="400" height="100" fill="#5a3a1a" />
      <rect x="452" y="26" width="376" height="76" fill="#2f5a3f" />
      <text x="500" y="76" fill="white" fontFamily="'VT323', monospace" fontSize="40">welcome class</text>
      <circle cx="1140" cy="65" r="40" fill="white" stroke="#5a3a1a" strokeWidth="4" />
      <line x1="1140" y1="65" x2="1140" y2="35" stroke="#2d2740" strokeWidth="4" />
      <line x1="1140" y1="65" x2="1168" y2="65" stroke="#2d2740" strokeWidth="3" />
      <circle cx="1140" cy="65" r="3" fill="#2d2740" />

      <rect x="540" y="172" width="240" height="60" fill="#7a5028" stroke="#3a2010" strokeWidth="3" />
      <rect x="540" y="172" width="240" height="12" fill="#5a3a1a" />
      <circle cx="710" cy="202" r="9" fill="#d6353d" stroke="#a8201c" strokeWidth="2" />
      <rect x="80" y="200" width="80" height="160" fill="#7a5028" stroke="#3a2010" strokeWidth="3" />
      {[230, 270, 310, 350].map((y) => (
        <line key={y} x1="80" y1={y} x2="160" y2={y} stroke="#3a2010" strokeWidth="2" />
      ))}
      {shelfBooks.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="10" height="20" fill={c} />
      ))}

      {([
        [200, 330],
        [320, 330],
        [960, 330],
        [1080, 330],
      ] as Array<[number, number]>).map(([x, y]) => (
        <g key={x}>
          <rect x={x - 22} y={y - 40} width="44" height="20" fill="#5a3a1a" stroke="#3a2010" strokeWidth="2" />
          <rect x={x - 46} y={y - 12} width="92" height="38" fill="#c4936a" stroke="#7a5028" strokeWidth="2" />
        </g>
      ))}

      <ellipse cx="640" cy="520" rx="260" ry="80" fill="#d6557a" opacity="0.5" />
      <ellipse cx="640" cy="520" rx="232" ry="64" fill="none" stroke="#9a3354" strokeWidth="3" opacity="0.6" />
    </svg>
  );
}

function DowntownBackground() {
  const facadeWindows: Array<[number, number]> = [
    [40, 40], [80, 40], [40, 80], [80, 80],
    [200, 30], [240, 30], [280, 30], [200, 70], [240, 70], [280, 70],
    [400, 50], [440, 50], [480, 50], [520, 50],
    [640, 30], [680, 30], [720, 30], [760, 30], [640, 70], [680, 70], [720, 70], [760, 70],
    [880, 40], [920, 40], [880, 80], [920, 80],
    [1040, 30], [1080, 30], [1120, 30], [1160, 30], [1200, 30],
    [1040, 70], [1080, 70], [1120, 70], [1160, 70], [1200, 70],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="sidewalk" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill="#a8aeb4" />
          <line x1="0" y1="80" x2="80" y2="80" stroke="#7a8088" strokeWidth="2" />
          <line x1="80" y1="0" x2="80" y2="80" stroke="#7a8088" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="1280" height="130" fill="#6a7585" />
      <rect width="1280" height="6" fill="#3a4250" />
      {facadeWindows.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="22" height="22" fill="#ffd866" />
      ))}
      <rect y="130" width="1280" height="16" fill="#5a6068" />
      <rect y="146" width="1280" height="574" fill="url(#sidewalk)" />

      {[260, 1000].map((x, i) => (
        <g key={i}>
          <rect x={x - 4} y={170} width="8" height="160" fill="#3a3a3a" />
          <rect x={x - 26} y={166} width="52" height="14" fill="#3a3a3a" />
          <ellipse cx={x} cy={196} rx="22" ry="14" fill="#ffe89a" stroke="#3a3a3a" strokeWidth="2" />
        </g>
      ))}
      <rect x="500" y="260" width="220" height="14" fill="#7a4f24" stroke="#3a2010" strokeWidth="2" />
      <rect x="500" y="246" width="220" height="14" fill="#7a4f24" stroke="#3a2010" strokeWidth="2" />
      <rect x="512" y="274" width="8" height="40" fill="#3a3a3a" />
      <rect x="700" y="274" width="8" height="40" fill="#3a3a3a" />
      <rect x="140" y="340" width="44" height="64" fill="#3a4250" stroke="#1a2230" strokeWidth="2" />
      <rect x="134" y="338" width="56" height="8" fill="#1a2230" />
      <rect x="820" y="450" width="100" height="50" fill="#a06b3a" stroke="#5a3a1a" strokeWidth="2" />
      <ellipse cx="870" cy="442" rx="34" ry="22" fill="#5a9c3e" />
      <ellipse cx="852" cy="430" rx="14" ry="11" fill="#7eb462" />
      <ellipse cx="888" cy="434" rx="13" ry="10" fill="#7eb462" />
      <circle cx="852" cy="430" r="5" fill="#d65981" />
      <circle cx="888" cy="430" r="5" fill="#ffd866" />
      <ellipse cx="420" cy="540" rx="44" ry="22" fill="#3a3a3a" stroke="#1a1a1a" strokeWidth="2" />
      <ellipse cx="420" cy="540" rx="34" ry="14" fill="none" stroke="#5a5a5a" strokeWidth="1.5" />
      <g transform="translate(1140, 480)">
        <rect width="22" height="44" fill="#d6353d" stroke="#7a2018" strokeWidth="2" />
        <rect y="-6" width="22" height="10" fill="#d6353d" stroke="#7a2018" strokeWidth="2" />
        <rect x="-8" y="14" width="8" height="14" fill="#d6353d" stroke="#7a2018" strokeWidth="2" />
        <rect x="22" y="14" width="8" height="14" fill="#d6353d" stroke="#7a2018" strokeWidth="2" />
      </g>
    </svg>
  );
}

function FarmBackground() {
  const hayBales: Array<[number, number]> = [[300, 480], [380, 510], [330, 540]];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#5a9c3e" />
          <line x1="6" y1="32" x2="6" y2="38" stroke="#3e7028" strokeWidth="2" />
          <line x1="20" y1="36" x2="20" y2="42" stroke="#3e7028" strokeWidth="2" />
          <line x1="32" y1="30" x2="32" y2="36" stroke="#3e7028" strokeWidth="2" />
        </pattern>
        <linearGradient id="farm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8dbf2" />
          <stop offset="100%" stopColor="#dfeff8" />
        </linearGradient>
      </defs>
      <rect width="1280" height="100" fill="url(#farm-sky)" />
      <path d="M 0 100 Q 200 60 400 90 T 800 70 T 1280 100 L 1280 130 L 0 130 Z" fill="#7eb462" />
      <g fill="white" opacity="0.9">
        <ellipse cx="200" cy="50" rx="40" ry="16" />
        <ellipse cx="800" cy="40" rx="50" ry="18" />
        <ellipse cx="1100" cy="60" rx="36" ry="14" />
      </g>
      <rect y="130" width="1280" height="590" fill="url(#grass)" />
      <path
        d="M 640 720 Q 600 600 660 500 T 680 320"
        fill="none"
        stroke="#9a7838"
        strokeWidth="60"
        opacity="0.55"
        strokeLinecap="round"
      />

      <g>
        <polygon points="850,190 1000,120 1150,190" fill="#5a2818" />
        <rect x="860" y="190" width="280" height="170" fill="#b04030" stroke="#7a2818" strokeWidth="2" />
        <rect x="876" y="206" width="248" height="16" fill="#d65040" />
        <rect x="970" y="280" width="60" height="80" fill="#5a2818" />
        <line x1="970" y1="280" x2="1030" y2="360" stroke="#3a1810" strokeWidth="3" />
        <line x1="1030" y1="280" x2="970" y2="360" stroke="#3a1810" strokeWidth="3" />
        <rect x="880" y="236" width="30" height="30" fill="#ffd866" />
        <rect x="1090" y="236" width="30" height="30" fill="#ffd866" />
      </g>
      <g>
        <rect x="170" y="230" width="32" height="100" fill="#5a3a1a" />
        <ellipse cx="186" cy="210" rx="60" ry="48" fill="#3e7028" />
        <ellipse cx="160" cy="200" rx="36" ry="30" fill="#5a9c3e" />
        <ellipse cx="216" cy="206" rx="34" ry="28" fill="#5a9c3e" />
      </g>
      <g>
        <rect x="460" y="290" width="22" height="60" fill="#5a3a1a" />
        <ellipse cx="471" cy="278" rx="38" ry="32" fill="#3e7028" />
      </g>
      {hayBales.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="38" ry="26" fill="#dec98a" stroke="#a8956a" strokeWidth="2" />
          <ellipse cx={x} cy={y - 4} rx="38" ry="6" fill="#a8956a" opacity="0.5" />
        </g>
      ))}
      <g fill="#ede0c8" stroke="#9a8868" strokeWidth="2">
        {[820, 880, 940, 1000, 1060, 1120, 1180].map((x) => (
          <g key={x}>
            <polygon points={`${x},540 ${x + 14},520 ${x + 28},540`} />
            <rect x={x} y="540" width="28" height="100" />
          </g>
        ))}
        <rect x="820" y="568" width="386" height="8" />
        <rect x="820" y="608" width="386" height="8" />
      </g>
      <g>
        <ellipse cx="240" cy="520" rx="80" ry="36" fill="#7ec5d6" stroke="#3f7a8a" strokeWidth="3" />
        <ellipse cx="220" cy="510" rx="24" ry="6" fill="white" opacity="0.5" />
      </g>
    </svg>
  );
}

function ThemeParkBackground() {
  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const cabin = ['#ff7e3c', '#ffd866', '#7ec7b8', '#d65981', '#9670c9', '#a55540'];
  const stars: Array<[number, number]> = [
    [120, 50], [240, 40], [340, 70], [480, 30], [580, 80], [1100, 50], [1200, 40],
  ];
  const balloons: Array<[number, number, string]> = [
    [150, 200, '#ff7e3c'], [200, 180, '#7ec7b8'], [170, 230, '#ffd866'],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="brick-floor" width="120" height="60" patternUnits="userSpaceOnUse">
          <rect width="120" height="60" fill="#c2b48e" />
          <line x1="0" y1="30" x2="120" y2="30" stroke="#9a8a64" strokeWidth="2" />
          <line x1="60" y1="0" x2="60" y2="30" stroke="#9a8a64" strokeWidth="2" />
          <line x1="0" y1="60" x2="120" y2="60" stroke="#9a8a64" strokeWidth="2" />
          <line x1="0" y1="30" x2="0" y2="60" stroke="#9a8a64" strokeWidth="2" />
          <line x1="120" y1="30" x2="120" y2="60" stroke="#9a8a64" strokeWidth="2" />
        </pattern>
        <linearGradient id="park-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c5e9e" />
          <stop offset="100%" stopColor="#e89868" />
        </linearGradient>
      </defs>
      <rect width="1280" height="150" fill="url(#park-sky)" />
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="white" />
      ))}
      <g transform="translate(950, 90)">
        <circle r="80" fill="none" stroke="#3a2540" strokeWidth="5" />
        {spokes.map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line key={a} x1="0" y1="0" x2={Math.cos(rad) * 80} y2={Math.sin(rad) * 80} stroke="#3a2540" strokeWidth="2.5" />
          );
        })}
        {spokes.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          return (
            <circle key={a} cx={Math.cos(rad) * 80} cy={Math.sin(rad) * 80} r="8" fill={cabin[i % cabin.length]} stroke="#3a2540" strokeWidth="2" />
          );
        })}
        <circle r="8" fill="#3a2540" />
      </g>
      <polygon points="60,140 180,40 300,140" fill="#d65981" />
      <polygon points="80,140 180,60 280,140" fill="white" opacity="0.45" />
      <polygon points="180,28 174,46 186,46" fill="#ffd866" />
      <rect y="150" width="1280" height="570" fill="url(#brick-floor)" />
      <g transform="translate(640, 430)">
        <ellipse rx="130" ry="54" fill="#7ec7b8" stroke="#3a8a82" strokeWidth="4" />
        <ellipse rx="108" ry="40" fill="#a3e0d6" />
        <ellipse rx="84" ry="28" fill="#7ec7b8" />
        <rect x="-6" y="-30" width="12" height="50" fill="#3a2540" />
        <ellipse cy="-32" rx="22" ry="8" fill="#a3e0d6" stroke="#3a2540" strokeWidth="2" />
      </g>
      <rect x="180" y="290" width="140" height="10" fill="#7a4f24" stroke="#3a2010" strokeWidth="2" />
      <rect x="180" y="278" width="140" height="10" fill="#7a4f24" stroke="#3a2010" strokeWidth="2" />
      <rect x="188" y="300" width="6" height="32" fill="#3a3a3a" />
      <rect x="306" y="300" width="6" height="32" fill="#3a3a3a" />
      <g transform="translate(960, 270)">
        <polygon points="-10,-30 130,-30 110,0 10,0" fill="#7c5e9e" />
        {[10, 40, 80, 110].map((x) => (
          <line key={x} x1={x} y1="-30" x2={x} y2="0" stroke="#fff" strokeWidth="2" />
        ))}
        <rect width="120" height="60" fill="#d6353d" stroke="#7a2018" strokeWidth="2" />
        <rect width="120" height="14" fill="#fff" />
        <text x="60" y="42" textAnchor="middle" fill="white" fontFamily="'VT323', monospace" fontSize="22">SNACKS</text>
        <circle cx="22" cy="68" r="9" fill="#3a3a3a" />
        <circle cx="98" cy="68" r="9" fill="#3a3a3a" />
      </g>
      {balloons.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" fill={c} stroke="#3a2540" strokeWidth="2" />
          <line x1={x} y1={y + 14} x2={x - 4} y2={y + 70} stroke="#3a2540" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

interface BackgroundLayerProps {
  id: BackgroundId;
}

export default function BackgroundLayer({ id }: BackgroundLayerProps) {
  switch (id) {
    case 'classroom':
      return <ClassroomBackground />;
    case 'downtown':
      return <DowntownBackground />;
    case 'farm':
      return <FarmBackground />;
    case 'themepark':
      return <ThemeParkBackground />;
    case 'lcd':
    default:
      return <LcdBackground />;
  }
}
