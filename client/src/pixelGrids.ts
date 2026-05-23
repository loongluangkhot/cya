// All character pixel grids are 16x16. Chars in the grid map to colors:
//   .  transparent
//   O  white outer outline
//   K  dark outline (body-dark)
//   B  body color
//   H  highlight (lighter shade)
//   E  eye (dark)
//   W  eye sparkle / inner eye white
//   M  mouth
//   A  accent 1 (beak, inner ear, eye patch)
//   C  cheek (pink)
//   S  spot / secondary detail

export const SLIME_GRID: readonly string[] = [
  '................',
  '................',
  '....OOOOOOOO....',
  '..OOKKKKKKKKOO..',
  '.OKBHBBBBBBBBKO.',
  '.OKBHBBBBBBBBKO.',
  'OKBBBBBBBBBBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBBBBBBBBBBKO',
  'OKBBBBBBBBBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
  '................',
];

export const BLOB_PINK_GRID: readonly string[] = [
  '................',
  '................',
  '....OOOOOOOO....',
  '..OOKBBBBBBKOO..',
  '.OKBHBBBBBBBBKO.',
  '.OKHBBBBBBBBBKO.',
  'OKBBBBBBBBBBBBKO',
  'OKBBEEBBBBEEBBKO',
  'OKBBEEBBBBEEBBKO',
  'OKBCBBBBMMBBBCKO',
  'OKBBBBBBBBBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
  '................',
];

export const CHICK_YELLOW_GRID: readonly string[] = [
  '................',
  '................',
  '....OOOOOOOO....',
  '..OOKBBBBBBKOO..',
  '.OKBHBBBBBBBBKO.',
  '.OKHBBBBBBBBBKO.',
  'OKBBBBBBBBBBBBKO',
  'OKBBEBBBBBBEBBKO',
  'OKBBBBBAABBBBBKO',
  'OKCBBBBAABBBBCKO',
  'OKBBBBBBBBBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
  '................',
];

export const DINO_GREEN_GRID: readonly string[] = [
  '................',
  '................',
  '....OOOOOOOO....',
  '..OOKBBBBBBKOO..',
  '.OKBHBBSBBBBBKO.',
  '.OKHBBBBBBSBBKO.',
  'OKBBBBBBBBBBBBKO',
  'OKBBEEBBBBEEBBKO',
  'OKBBEEBBBBEEBBKO',
  'OKBBKMMMMMMKBBKO',
  'OKSBBBBBBBBBSBKO',
  '.OKBBBBSBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
  '................',
];

export const CAT_BLUE_GRID: readonly string[] = [
  '..K..........K..',
  '..KK........KK..',
  '..KBK......KBK..',
  '..KBBK....KBBK..',
  '..OKBKOOOOKBKO..',
  '.OKBBBBBBBBBBKO.',
  'OKBBHBBBBBBBBBKO',
  'OKBBHBBBBBBBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBBBBMMBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
];

export const GHOST_PURPLE_GRID: readonly string[] = [
  '................',
  '................',
  '....OOOOOOOO....',
  '..OOKBBBBBBKOO..',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  'OKBBBBBBBBBBBBKO',
  'OKBWWWBBBBWWWBKO',
  'OKBWEWBBBBWEWBKO',
  'OKBWWWBBBBWWWBKO',
  'OKBBBMMMMMMBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
];

export const FOX_ORANGE_GRID: readonly string[] = [
  '..K..........K..',
  '..KK........KK..',
  '..KAK......KAK..',
  '..KAAK....KAAK..',
  '..OKBKOOOOKBKO..',
  '.OKBBBBBBBBBBKO.',
  'OKBBHBBBBBBBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBBBBMMBBBBKO',
  'OKBBBBBBBBBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
];

export const PANDA_RED_GRID: readonly string[] = [
  '................',
  '..KK........KK..',
  '.KBBK......KBBK.',
  '.OKBKOOOOOOKBKO.',
  '.OKBBBBBBBBBBKO.',
  'OKBBHBBBBBBBBBKO',
  'OKBBAEBBBBEABBKO',
  'OKBBAEBBBBEABBKO',
  'OKBBBBBBMMBBBBKO',
  'OKBBBBBBBBBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
  '................',
];

export const BUNNY_WHITE_GRID: readonly string[] = [
  '....KK....KK....',
  '....KAK..KAK....',
  '....KAK..KAK....',
  '....KAK..KAK....',
  '..OOKAKOOKAKOO..',
  '.OKBBBBBBBBBBKO.',
  'OKBBHBBBBBBBBBKO',
  'OKBBHBBBBBBBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBEBBBBEBBBKO',
  'OKBBBBBBMMBBBBKO',
  '.OKBBBBBBBBBBKO.',
  '.OKBBBBBBBBBBKO.',
  '.OKKBBBBBBBBKKO.',
  '..OOKKKKKKKKOO..',
  '....OOOOOOOO....',
];
