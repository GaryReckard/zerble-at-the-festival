// Sample once for either a real Shack or its omitted historical slot, so a
// spacing decision cannot reroll the other stalls, tables or decorations.
export function sampleSugarShackVariation(rng){
 return {cook:[rng(),rng(),rng()],start:rng(),hold:rng(),speed:rng(),tilt:rng()};
}
