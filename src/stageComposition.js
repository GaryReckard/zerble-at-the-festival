// Scale degrees keep each part inside the same harmony as the chord changes.
// Different progressions support a returning head, its answer, and a bridge.
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10], MINOR = [0, 2, 3, 5, 7, 8, 10];
const modes = {folk: MAJOR, jam: MIXOLYDIAN, brass: MIXOLYDIAN, funk: DORIAN, dance: MINOR, world: DORIAN, dub: MINOR};
const progressions = {
  folk: [[0,3,0,4], [0,5,3,4], [0,4,5,3]],
  jam: [[0,6,3,0], [0,3,1,3], [0,3,6,4]],
  brass: [[0,3,1,4], [0,0,3,4], [0,5,1,4]],
  funk: [[0,0,3,0], [0,0,6,3], [0,3,0,4]],
  world: [[0,3,0,6], [0,0,3,4], [0,6,3,0]],
  dance: [[0,5,2,6], [0,3,5,6], [0,6,5,3]],
  dub: [[0,0,3,4], [0,6,3,0], [0,3,0,6]],
};
const heads = [
  [0,2,4,3,2,1,0,2], [4,4,2,1,0,1,3,2], [0,1,2,4,3,2,4,5],
  [2,0,2,3,4,2,1,0], [4,2,0,1,2,3,1,2], [0,3,2,4,2,1,2,0],
];
const endings = [[4,3,2,0], [2,4,1,0], [5,4,2,0], [3,1,-1,0]];
const chorusRoots = [[3,4,0,0], [5,3,0,4], [3,0,1,4]];
const bridgeRoots = [[1,3,5,4], [5,1,3,4], [6,3,1,4]];
const ratio = Array.from({length: 97}, (_, i) => 2 ** ((i - 48) / 12));
const choose = (list, rng) => list[Math.floor(rng() * list.length)];

export function makeStageArrangement(style, rng, tonic, identity = 0) {
  const mode = modes[style];
  const verse = choose(progressions[style], rng), chorus = choose(chorusRoots, rng), bridge = choose(bridgeRoots, rng);
  const head = choose(heads, rng), answer = choose(endings, rng);
  const band = identity >>> 0;
  const register = (band >>> 4) % 3;
  const opening = (band % 3 + Math.floor(rng() * 3)) % 3;
  const chordBars = rng() < .55 ? 1 : 2;
  const swing = ({folk:.53, funk:.54, jam:.59, brass:.63, world:2/3, dance:.5, dub:.5})[style];
  const octave = style === 'dub' ? 2 : 1;
  function pitch(degree) {
    const i = (degree % 7 + 7) % 7;
    return tonic * ratio[48 + 12*Math.floor(degree/7) + mode[i]];
  }
  function root(section, bar) {
    const seq = section === 'bridge' || section === 'solo' || section === 'break' ? bridge
      : section === 'chorus' || section === 'drop' ? chorus : verse;
    return seq[Math.floor(bar/chordBars) % seq.length];
  }
  return {
    swing: swing === .5 || style === 'world' ? swing : swing + ((band >>> 8) % 5 - 2) * .006,
    groove: (band >>> 10) % 3, register,
    lead(section, bar, beat, sub = 0) {
      const step = beat * 2 + sub;
      const response = bar % 4 === 3 || (bar % 2 === 1 && section === 'solo');
      let degree = response && step >= 4 ? answer[step - 4] : head[(step + (section === 'bridge' ? 3 : 0)) % 8];
      if (section === 'chorus' || section === 'drop') degree += 2;
      if (section === 'solo' && bar % 2) degree = 4 - degree;
      return pitch(root(section,bar) + degree + opening) * octave;
    },
    bass(section, bar, interval = 0) {
      // Put high chord roots below the tonic to keep the bass out of the lead.
      const r = root(section,bar);
      return pitch((r > 3 ? r - 7 : r) + interval) * .5;
    },
    chord(section, bar, degree = 0) {
      const r = root(section,bar);
      return pitch(r + degree - (r + degree > 8 ? 7 : 0));
    },
  };
}
