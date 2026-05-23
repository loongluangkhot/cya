export const ADJECTIVES = [
  'sunny', 'sleepy', 'tiny', 'brave', 'happy', 'fuzzy', 'witty', 'mellow',
  'breezy', 'cozy', 'curly', 'dapper', 'eager', 'fancy', 'gentle', 'glowing',
  'jolly', 'kind', 'lucky', 'merry', 'nimble', 'plucky', 'quiet', 'rosy',
  'silly', 'snappy', 'spunky', 'sweet', 'tipsy', 'wavy', 'zippy', 'bouncy',
  'chilly', 'crispy', 'dreamy', 'fluffy', 'frosty', 'gloomy', 'grumpy', 'humble',
  'jazzy', 'lively', 'misty', 'noble', 'peppy', 'quirky', 'shiny', 'spicy',
  'toasty', 'velvet',
];

export const NOUNS = [
  'fox', 'panda', 'toast', 'meadow', 'otter', 'puddle', 'comet', 'pebble',
  'mango', 'lantern', 'biscuit', 'cactus', 'cloud', 'dumpling', 'ember', 'feather',
  'goose', 'hazel', 'iris', 'jelly', 'kettle', 'lemon', 'muffin', 'noodle',
  'opal', 'pickle', 'quill', 'raccoon', 'sprout', 'tiger', 'umbra', 'violet',
  'walnut', 'yeti', 'zebra', 'acorn', 'bagel', 'cherry', 'dolphin', 'falcon',
  'gecko', 'heron', 'igloo', 'jaguar', 'koala', 'llama', 'moose', 'newt',
  'orca', 'pixie',
];

export function generateSlug(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = 10 + Math.floor(Math.random() * 90);
  return `${a}-${n}-${num}`;
}
