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

function PalletTownBackground() {
  const houses: Array<[number, number, string]> = [
    [220, 360, '#d6353d'],
    [820, 340, '#3f8ad0'],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="pallet-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9bd6f5" />
          <stop offset="100%" stopColor="#dff1fb" />
        </linearGradient>
        <pattern id="pallet-grass" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#6cc26a" />
          <path d="M 4 26 l 2 -6 l 2 6 z" fill="#4d9a4b" />
          <path d="M 18 22 l 2 -7 l 2 7 z" fill="#4d9a4b" />
          <path d="M 26 28 l 2 -5 l 2 5 z" fill="#4d9a4b" />
        </pattern>
      </defs>
      <rect width="1280" height="200" fill="url(#pallet-sky)" />
      <g fill="white" opacity="0.95">
        <ellipse cx="180" cy="80" rx="48" ry="14" />
        <ellipse cx="220" cy="74" rx="28" ry="10" />
        <ellipse cx="900" cy="60" rx="60" ry="16" />
        <ellipse cx="940" cy="52" rx="34" ry="12" />
      </g>
      <path d="M 0 220 Q 320 160 640 200 T 1280 210 L 1280 260 L 0 260 Z" fill="#7fcf6a" />
      <path d="M 0 260 Q 320 220 640 240 T 1280 250 L 1280 320 L 0 320 Z" fill="#5ab35a" />
      <rect y="300" width="1280" height="420" fill="url(#pallet-grass)" />

      <path
        d="M 0 560 Q 320 520 640 560 T 1280 560 L 1280 600 L 0 600 Z"
        fill="#d9b46a"
        stroke="#a07c40"
        strokeWidth="2"
      />

      {houses.map(([x, y, roof], i) => (
        <g key={i}>
          <polygon
            points={`${x - 6},${y} ${x + 78},${y - 56} ${x + 162},${y}`}
            fill={roof}
            stroke="#3a1810"
            strokeWidth="3"
          />
          <rect x={x} y={y} width="156" height="92" fill="#f1e2c3" stroke="#7a5028" strokeWidth="3" />
          <rect x={x + 60} y={y + 30} width="36" height="62" fill="#5a3a1a" />
          <circle cx={x + 88} cy={y + 64} r="2.5" fill="#ffd866" />
          <rect x={x + 14} y={y + 22} width="32" height="28" fill="#a8dbf2" stroke="#7a5028" strokeWidth="2" />
          <rect x={x + 112} y={y + 22} width="32" height="28" fill="#a8dbf2" stroke="#7a5028" strokeWidth="2" />
          <line x1={x + 30} y1={y + 22} x2={x + 30} y2={y + 50} stroke="#7a5028" strokeWidth="1.5" />
          <line x1={x + 14} y1={y + 36} x2={x + 46} y2={y + 36} stroke="#7a5028" strokeWidth="1.5" />
          <line x1={x + 128} y1={y + 22} x2={x + 128} y2={y + 50} stroke="#7a5028" strokeWidth="1.5" />
          <line x1={x + 112} y1={y + 36} x2={x + 144} y2={y + 36} stroke="#7a5028" strokeWidth="1.5" />
        </g>
      ))}

      <g fill="#ede8d0" stroke="#a8956a" strokeWidth="2">
        {[40, 120, 200, 1080, 1160, 1240].map((x) => (
          <g key={x}>
            <polygon points={`${x},480 ${x + 10},468 ${x + 20},480`} />
            <rect x={x} y="480" width="20" height="70" />
          </g>
        ))}
      </g>

      <g>
        <rect x="540" y="200" width="80" height="60" fill="#3a2540" stroke="#1a1530" strokeWidth="2" />
        <polygon points="540,200 580,170 620,200" fill="#2c1a40" stroke="#1a1530" strokeWidth="2" />
        <text x="580" y="240" textAnchor="middle" fill="white" fontFamily="'VT323', monospace" fontSize="22">
          PALLET
        </text>
      </g>

      <g transform="translate(120, 280)">
        <rect x="-2" y="-50" width="4" height="50" fill="#5a3a1a" />
        <ellipse rx="42" ry="36" fill="#3e7028" />
        <ellipse cx="-18" cy="-6" rx="20" ry="16" fill="#5a9c3e" />
        <ellipse cx="18" cy="-4" rx="22" ry="18" fill="#5a9c3e" />
        <ellipse cx="0" cy="-22" rx="18" ry="14" fill="#7eb462" />
      </g>
      <g transform="translate(1170, 360)">
        <rect x="-2" y="-44" width="4" height="44" fill="#5a3a1a" />
        <ellipse rx="36" ry="30" fill="#3e7028" />
        <ellipse cx="-14" cy="-4" rx="18" ry="14" fill="#5a9c3e" />
        <ellipse cx="14" cy="-6" rx="18" ry="14" fill="#5a9c3e" />
      </g>
    </svg>
  );
}

function ViridianForestBackground() {
  const trunks: Array<[number, number]> = [
    [80, 0], [220, 60], [360, 30], [500, 80], [640, 20], [780, 70],
    [920, 30], [1060, 80], [1200, 40],
  ];
  const lightSpots: Array<[number, number, number]> = [
    [180, 220, 60], [520, 280, 70], [880, 240, 55], [1120, 300, 50],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="forest-canopy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f4022" />
          <stop offset="100%" stopColor="#2f5a30" />
        </linearGradient>
        <pattern id="forest-floor" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#3a6230" />
          <ellipse cx="10" cy="20" rx="3" ry="1.5" fill="#274a20" />
          <ellipse cx="28" cy="30" rx="3" ry="1.5" fill="#274a20" />
          <ellipse cx="20" cy="8" rx="2" ry="1" fill="#52844a" />
        </pattern>
      </defs>
      <rect width="1280" height="200" fill="url(#forest-canopy)" />
      {lightSpots.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.55} fill="#a8d68a" opacity="0.18" />
      ))}

      <g fill="#5a9c3e" opacity="0.85">
        {[60, 220, 380, 540, 700, 860, 1020, 1180].map((x) => (
          <ellipse key={x} cx={x} cy="140" rx="120" ry="80" />
        ))}
      </g>
      <g fill="#3e7028">
        {[140, 300, 460, 620, 780, 940, 1100].map((x) => (
          <ellipse key={x} cx={x} cy="100" rx="100" ry="70" />
        ))}
      </g>

      <rect y="200" width="1280" height="520" fill="url(#forest-floor)" />

      {trunks.map(([x, offset], i) => (
        <g key={i}>
          <rect x={x} y={200 + offset} width="48" height={520 - offset} fill="#4a2a14" stroke="#2a1808" strokeWidth="2" />
          <line x1={x + 10} y1={260 + offset} x2={x + 10} y2={680} stroke="#2a1808" strokeWidth="2" />
          <line x1={x + 30} y1={260 + offset} x2={x + 30} y2={680} stroke="#2a1808" strokeWidth="2" />
          <ellipse cx={x + 24} cy={200 + offset} rx="100" ry="56" fill="#3e7028" />
          <ellipse cx={x - 10} cy={210 + offset} rx="44" ry="28" fill="#5a9c3e" />
          <ellipse cx={x + 60} cy={205 + offset} rx="48" ry="32" fill="#5a9c3e" />
          <ellipse cx={x + 24} cy={186 + offset} rx="40" ry="22" fill="#7eb462" />
        </g>
      ))}

      <g>
        {[120, 340, 680, 980, 1180].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="640" rx="32" ry="14" fill="#2a4a20" />
            <path
              d={`M ${x - 18} 640 q 6 -28 18 -32 q -2 18 -18 32 Z`}
              fill="#5a9c3e"
            />
            <path
              d={`M ${x + 18} 640 q -6 -26 -18 -30 q 2 16 18 30 Z`}
              fill="#5a9c3e"
            />
            <path
              d={`M ${x} 640 q 0 -32 4 -38 q 4 18 -4 38 Z`}
              fill="#7eb462"
            />
          </g>
        ))}
      </g>

      <g>
        <ellipse cx="900" cy="540" rx="44" ry="14" fill="#2a1808" opacity="0.6" />
        <ellipse cx="900" cy="520" rx="44" ry="28" fill="#5a3a1a" stroke="#2a1808" strokeWidth="2" />
        <ellipse cx="884" cy="514" rx="6" ry="4" fill="#ffd866" />
        <ellipse cx="916" cy="514" rx="6" ry="4" fill="#ffd866" />
        <circle cx="884" cy="514" r="2" fill="#1a1a1a" />
        <circle cx="916" cy="514" r="2" fill="#1a1a1a" />
      </g>
    </svg>
  );
}

function LavenderTownBackground() {
  const stars: Array<[number, number]> = [
    [80, 40], [180, 90], [280, 30], [420, 70], [540, 40], [760, 90],
    [880, 30], [1040, 70], [1180, 50], [1240, 110],
  ];
  const towerWindows = [0, 1, 2, 3, 4];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="lavender-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1a4a" />
          <stop offset="100%" stopColor="#6f47b3" />
        </linearGradient>
        <pattern id="lavender-ground" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#5a4480" />
          <line x1="0" y1="40" x2="40" y2="40" stroke="#3a2a60" strokeWidth="2" />
          <line x1="40" y1="0" x2="40" y2="40" stroke="#3a2a60" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="1280" height="320" fill="url(#lavender-sky)" />
      {stars.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="1.8" fill="white" />
          <circle cx={x} cy={y} r="4" fill="white" opacity="0.25" />
        </g>
      ))}
      <g>
        <circle cx="220" cy="120" r="58" fill="#f8f0d8" />
        <circle cx="200" cy="108" r="50" fill="#2a1a4a" />
      </g>

      <g>
        <rect x="920" y="60" width="180" height="280" fill="#3a2a60" stroke="#1a0f30" strokeWidth="3" />
        <polygon points="912,60 1010,18 1108,60" fill="#5a3a1a" stroke="#2a1808" strokeWidth="3" />
        <polygon points="1010,18 1010,2 1020,2 1020,18" fill="#3a2010" />
        {towerWindows.map((row) =>
          [0, 1].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={948 + col * 70}
              y={84 + row * 50}
              width="44"
              height="26"
              fill="#ffd866"
              stroke="#1a0f30"
              strokeWidth="2"
            />
          )),
        )}
        <rect x="990" y="280" width="40" height="60" fill="#1a0f30" />
        <circle cx="1020" cy="312" r="2" fill="#ffd866" />
      </g>

      <path d="M 0 320 Q 200 290 400 310 T 800 300 T 1280 320 L 1280 360 L 0 360 Z" fill="#7a5e9c" />
      <rect y="350" width="1280" height="370" fill="url(#lavender-ground)" />

      {([
        [120, 380, '#9670c9'],
        [380, 380, '#7c5e9e'],
        [600, 380, '#a07ccc'],
      ] as Array<[number, number, string]>).map(([x, y, roof]) => (
        <g key={x}>
          <polygon
            points={`${x - 4},${y} ${x + 60},${y - 38} ${x + 124},${y}`}
            fill={roof}
            stroke="#1a0f30"
            strokeWidth="2"
          />
          <rect x={x} y={y} width="120" height="72" fill="#d4c8e6" stroke="#3a2a60" strokeWidth="2" />
          <rect x={x + 48} y={y + 24} width="24" height="48" fill="#3a2a60" />
          <rect x={x + 12} y={y + 18} width="22" height="22" fill="#ffd866" stroke="#3a2a60" strokeWidth="2" />
          <rect x={x + 86} y={y + 18} width="22" height="22" fill="#ffd866" stroke="#3a2a60" strokeWidth="2" />
        </g>
      ))}

      <g>
        <ellipse cx="280" cy="540" rx="46" ry="34" fill="#e8d8f0" opacity="0.75" />
        <ellipse cx="260" cy="534" rx="22" ry="12" fill="white" opacity="0.6" />
      </g>
      <g>
        <ellipse cx="980" cy="500" rx="40" ry="30" fill="#e8d8f0" opacity="0.7" />
      </g>

      <g transform="translate(820, 540)">
        <circle r="22" fill="#fff" stroke="#1a0f30" strokeWidth="3" />
        <path d="M -22 0 a 22 22 0 0 1 44 0 Z" fill="#d6353d" stroke="#1a0f30" strokeWidth="3" />
        <circle r="6" fill="#fff" stroke="#1a0f30" strokeWidth="2" />
      </g>
    </svg>
  );
}

function PokemonCenterBackground() {
  const ballSlots: Array<[number, boolean]> = [
    [-90, true], [-30, true], [30, false], [90, true], [150, false],
  ];
  return (
    <svg className="bg-svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="pc-tile" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill="#f4e6d8" />
          <line x1="0" y1="80" x2="80" y2="80" stroke="#c8a884" strokeWidth="2" />
          <line x1="80" y1="0" x2="80" y2="80" stroke="#c8a884" strokeWidth="2" />
        </pattern>
        <linearGradient id="pc-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe2cf" />
          <stop offset="100%" stopColor="#ffd1b4" />
        </linearGradient>
      </defs>
      <rect width="1280" height="90" fill="#d6353d" />
      <rect y="86" width="1280" height="10" fill="#7a2018" />
      <g transform="translate(640, 50)">
        <circle r="28" fill="#fff" stroke="#7a2018" strokeWidth="4" />
        <rect x="-22" y="-6" width="44" height="12" fill="#d6353d" />
        <rect x="-6" y="-22" width="12" height="44" fill="#d6353d" />
      </g>
      <rect y="96" width="1280" height="380" fill="url(#pc-wall)" />
      <rect y="470" width="1280" height="14" fill="#a87a52" />
      <rect y="484" width="1280" height="236" fill="url(#pc-tile)" />

      <g>
        <rect x="80" y="180" width="220" height="140" fill="#a8dbf2" stroke="#3a4250" strokeWidth="4" />
        <line x1="190" y1="180" x2="190" y2="320" stroke="#3a4250" strokeWidth="3" />
        <line x1="80" y1="250" x2="300" y2="250" stroke="#3a4250" strokeWidth="3" />
        <rect x="980" y="180" width="220" height="140" fill="#a8dbf2" stroke="#3a4250" strokeWidth="4" />
        <line x1="1090" y1="180" x2="1090" y2="320" stroke="#3a4250" strokeWidth="3" />
        <line x1="980" y1="250" x2="1200" y2="250" stroke="#3a4250" strokeWidth="3" />
      </g>

      <g>
        <rect x="200" y="350" width="120" height="80" fill="#5a3a1a" stroke="#2a1808" strokeWidth="3" />
        <rect x="208" y="358" width="104" height="20" fill="#7a5028" />
        <rect x="208" y="384" width="104" height="20" fill="#7a5028" />
        <rect x="960" y="350" width="120" height="80" fill="#5a3a1a" stroke="#2a1808" strokeWidth="3" />
        <rect x="968" y="358" width="104" height="20" fill="#7a5028" />
        <rect x="968" y="384" width="104" height="20" fill="#7a5028" />
      </g>

      <g transform="translate(640, 360)">
        <rect x="-220" y="-50" width="440" height="22" fill="#d6353d" stroke="#7a2018" strokeWidth="3" />
        <rect x="-220" y="-28" width="440" height="80" fill="#fff" stroke="#7a2018" strokeWidth="3" />
        <rect x="-220" y="-28" width="440" height="14" fill="#ffd1b4" />

        <g transform="translate(0, -68)">
          <rect x="-130" y="-32" width="260" height="32" fill="#e8e8e8" stroke="#5a5a5a" strokeWidth="2" />
          <rect x="-130" y="-32" width="260" height="6" fill="#a8aeb4" />
          {ballSlots.map(([dx, lit], i) => (
            <g key={i}>
              <circle cx={dx} cy={-16} r="10" fill={lit ? '#ffd866' : '#7a5a3a'} stroke="#3a2010" strokeWidth="2" />
              <circle cx={dx} cy={-16} r="4" fill={lit ? '#fff8d0' : '#3a2010'} />
            </g>
          ))}
        </g>

        <text x="0" y="20" textAnchor="middle" fill="#7a2018" fontFamily="'VT323', monospace" fontSize="26">
          POKéMON CENTER
        </text>
      </g>

      <g transform="translate(120, 540)">
        <rect width="120" height="80" fill="#3f8ad0" stroke="#1d3a5e" strokeWidth="3" />
        <rect y="-10" width="120" height="14" fill="#1d3a5e" />
        <circle cx="22" cy="84" r="10" fill="#3a3a3a" />
        <circle cx="98" cy="84" r="10" fill="#3a3a3a" />
      </g>
      <g transform="translate(1040, 540)">
        <rect width="120" height="80" fill="#5a9c3e" stroke="#2f5a25" strokeWidth="3" />
        <rect y="-10" width="120" height="14" fill="#2f5a25" />
        <circle cx="22" cy="84" r="10" fill="#3a3a3a" />
        <circle cx="98" cy="84" r="10" fill="#3a3a3a" />
      </g>
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
    case 'palletTown':
      return <PalletTownBackground />;
    case 'viridianForest':
      return <ViridianForestBackground />;
    case 'lavenderTown':
      return <LavenderTownBackground />;
    case 'pokemonCenter':
      return <PokemonCenterBackground />;
    case 'lcd':
    default:
      return <LcdBackground />;
  }
}
