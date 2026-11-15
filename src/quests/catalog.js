// Passenger-quest tuning and copy. Pure data so Node tests, the HUD, the
// thought bubble and the sandbox all read one source.

export const QUEST = Object.freeze({
  CHANCE: 0.30,            // share of ordinary boarders who carry a quest
  MAX_ACTIVE: 3,           // compass legibility, independent of the seat count
  MIN_DIST: 80,            // closer feels trivial
  MAX_DIST: 300,           // farther feels like a chore
  ARRIVE_RADIUS: 25,
  ARRIVE_SPEED: 2,         // m/s; the cart must nearly stop to let someone off
  NEAR_MARGIN: 22,         // "almost there" fires this far outside the arrive radius
  MISSED_DISTANCE: 60,     // beyond the radius, after having been inside it
  STALL_SECONDS: 75,       // patience runs only while the player is not getting closer
  STALL_PROGRESS: 5,       // metres closer that count as progress
  IDLE_SECONDS: 9,         // parked this long with a waiting rider prompts a nudge
  HINT_GAP: 7,             // seconds between remarks across ALL riders
  HINT_MIN: 14, HINT_SPAN: 12,   // per-rider gap between ambient remarks
  URGENT_CHANCE: 0.12,
  URGENT_MIN: 60, URGENT_MAX: 220,
  URGENT_BASE_SECONDS: 30, URGENT_METRES_PER_SECOND: 5,
  URGENT_REWARD: 10, URGENT_BONUS: 5, URGENT_PENALTY: 2,
  SUMMIT_CHANCE: 0.10,
  SUMMIT_MIN: 200, SUMMIT_MAX: 900,
  PARTY_REWARD_EACH: 3,
});

const GENERIC_WARM = ['This way!', 'Getting closer!', 'Yes, yes, keep going!', 'Ooh, I think I see it!'];
const GENERIC_COLD = ['Hmm, I think it was the other way…', 'Are we taking the scenic route?', 'We seem to be getting farther…'];
const GENERIC_THANKS = ['Thanks for the ride!', 'That was rad!', 'Far out!', 'Cheers, friend!'];

// `weight` biases how often a kind is requested. `radius` is the minimum
// arrive radius; a source may supply a larger one for a sprawling venue.
// `sense` is a remark that only makes sense within `senseRange` metres.
export const DESTINATIONS = Object.freeze({
  main_stage: { label: 'the main stage', short: 'Main stage', icon: 'stage', weight: 1.3, radius: 34,
    ask: ['Take me to the main stage!', 'The headliner is about to start. Main stage, please!'],
    sense: ['I can feel the bass from here!', 'Listen, that is the main stage!'], senseRange: 120 },
  side_stage: { label: 'the side stage', short: 'Side stage', icon: 'stage', weight: 1.1, radius: 28,
    ask: ['My friend is playing the side stage!', 'Could you run me over to the side stage?'],
    sense: ['I hear a band tuning up…', 'That sounds like the side stage!'], senseRange: 90 },
  tent_stage: { label: 'the big tent', short: 'Big tent', icon: 'tent', weight: 1.1, radius: 30,
    ask: ['To the big tent, please!', 'There is a set in the big tent I cannot miss.'],
    sense: ['I can hear the tent crowd!', 'The big top is close, I can tell.'], senseRange: 90 },
  food_court: { label: 'the food trucks', short: 'Food trucks', icon: 'food', weight: 1.3, radius: 32,
    ask: ['I am starving. Food trucks, please!', 'Take me to the food trucks?'],
    sense: ['I can smell the food trucks from here!', 'Mmm, is that fry bread?'], senseRange: 70 },
  vendor_row: { label: 'the vendor row', short: 'Vendors', icon: 'market', weight: 0.8, radius: 28,
    ask: ['I need a new hat. Vendor row!', 'Could you drop me at the vendors?'],
    sense: ['I can see the vendor flags!', 'Ooh, tie-dye ahead.'], senseRange: 60 },
  drum_circle: { label: 'the drum circle', short: 'Drum circle', icon: 'drum', weight: 1.0, radius: 25,
    ask: ['The drum circle is calling me!', 'Take me to the drum circle?'],
    sense: ['I hear drums…', 'That rhythm! We are close.'], senseRange: 90 },
  camp_village: { label: 'my camp', short: 'Camp', icon: 'camp', weight: 0.9, radius: 45,
    ask: ['Could you run me back to my camp?', 'I left my jacket at camp. Mind dropping me there?'],
    sense: ['I think I see my tent!', 'That is our campfire smoke.'], senseRange: 80 },
  arch: { label: 'the front gate', short: 'Front gate', icon: 'gate', weight: 0.5, radius: 25,
    ask: ['I am meeting someone at the front gate!', 'To the front gate, please.'],
    sense: ['There is the arch!'], senseRange: 70 },
  healing_arts: { label: 'the healing arts', short: 'Healing arts', icon: 'healing', weight: 0.6, radius: 28,
    ask: ['I have a massage booked at the healing arts!', 'The healing arts area, please. Slowly.'],
    sense: ['It is so peaceful over here…'], senseRange: 60 },
  beach: { label: 'the beach', short: 'Beach', icon: 'beach', weight: 1.3, radius: 28,
    ask: ['Take me to the beach!', 'I want to put my feet in the lake.'],
    sense: ['I can see the water!', 'Smell that lake air.'], senseRange: 90 },
  hammock: { label: 'the hammocks', short: 'Hammocks', icon: 'hammock', weight: 0.8, radius: 25,
    ask: ['I need a nap. Hammocks, please.', 'To the hammocks!'],
    sense: ['I can almost feel the sway…'], senseRange: 50 },
  porta_potty: { label: 'the nearest porta-potty', short: 'Potty!!!', icon: 'potty', weight: 0, radius: 16,
    ask: ['Gotta GO! Nearest porta-potty, FAST!', 'Oh no oh no. Potty. NOW. Please!'],
    warm: ['Hurry hurry hurry!', 'Faster, friend, faster!', 'I can make it. I can make it.'],
    cold: ['NOT that way!', 'Wrong way! Wrong way!'],
    sense: ['I see the blue boxes!!'], senseRange: 45,
    thanks: ['Made it! You are a hero!', 'Phew. I owe you one!'],
    failed: ['Never mind… too late. I am going to go find a lake.', 'Forget it. Do not look at me.'] },
  mountaintop: { label: 'the mountaintop', short: 'Mountaintop', icon: 'mountain', weight: 0, radius: 40,
    ask: ['Take me to the mountaintop!', 'My camp is way up on the mountain. Can Zerble make it?'],
    warm: ['Up, up, up we go!', 'The air is getting thinner!', 'Look at that view already!'],
    sense: ['I can see the summit camps!'], senseRange: 150,
    thanks: ['What a climb. What a view!', 'Top of the world. Thank you!'] },
  monk_party: { label: 'where the monks are headed', short: 'Monks', icon: 'monk', weight: 0, radius: 30,
    ask: ['The monks bow, and point the way.', 'The monks would be grateful for a lift.'],
    warm: ['The monks hum in approval.', 'A monk nods serenely.'],
    cold: ['A monk raises one eyebrow.', 'The monks exchange a patient look.'],
    thanks: ['The monks bow deeply. Blessings on your cart.', 'The monks leave you with a quiet smile.'],
    near: ['The monks gather their robes. Nearly there.', 'A monk gently taps the roof: here is good.'],
    missed: ['The monks watch their stop drift by, unbothered.', 'A monk clears his throat, very softly.'],
    idle: ['The monks wait. They are good at waiting.', 'A monk begins, quietly, to hum.'],
    gaveUp: ['The monks decide the journey was the destination, and step down.'] },
});

export const LINES = Object.freeze({
  warm: GENERIC_WARM,
  cold: GENERIC_COLD,
  thanks: GENERIC_THANKS,
  near: ['Almost there!', 'Right up here is perfect!', 'Just ahead! Ease up and let me hop off.'],
  missed: ['Hey! You missed it!', 'That was my stop back there!', 'Whoa, we passed it!'],
  idle: ['Hellooo? Where we going?', 'Whenever you are ready, driver.', 'Are we… going?'],
  gaveUp: ['Eh, I will just walk from here.', 'No worries, I can hoof it. Thanks anyway!'],
  failed: ['Never mind…'],
});

export function destinationInfo(kind) { return DESTINATIONS[kind] || null; }

// Kind-specific lines win, then the shared bank.
export function linesFor(kind, type) {
  const own = DESTINATIONS[kind]?.[type];
  return own && own.length ? own : (LINES[type] || []);
}
