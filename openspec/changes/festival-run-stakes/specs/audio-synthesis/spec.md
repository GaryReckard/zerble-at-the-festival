# audio-synthesis — delta

## ADDED Requirements

### Requirement: Smile pitch-ladder SFX

Smile collection SHALL play a short, soft synthesized bell/marimba blip on the SFX
bus. Consecutive collects within the combo chain window SHALL step up a pentatonic
ladder (resetting to the root after a lull or combo break), so the ladder is the
audible combo signal. Per-hit randomized micro-detune SHALL prevent stamped-out
repetition. A hard voice cap SHALL coalesce same-frame bursts into one chord. All
synthesis SHALL use existing node patterns — no samples, no new init requirements,
no changes to the iOS unlock chain.

#### Scenario: A chain is audible

- **WHEN** the player collects five smiles in quick succession
- **THEN** five ascending pentatonic blips play, and the next collect after a lull
  starts back at the root

#### Scenario: Bursts don't machine-gun

- **WHEN** many smiles collect in the same frame
- **THEN** one coalesced chord plays instead of overlapping copies

### Requirement: Stakes cues — frown, sputter, marshal

The audio layer SHALL provide: a single soft low down-note on frown-caused smile
loss; a distinct sputter loop while the sputter state is active (replacing or
layering the existing dry-sputter one-shot); a marshal whistle for the vibe warning;
and a short run-end sting (distinct for `ran_dry` vs `vibed_out`). All are gated to
Festival Run except the frown down-note, which MAY play in Just Cruisin' at reduced
prominence.

#### Scenario: Warnings are heard before ejection

- **WHEN** the vibe meter crosses the warning threshold
- **THEN** the marshal whistle plays on the SFX bus
