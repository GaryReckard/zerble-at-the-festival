import { mulberry32 } from './rng.js';
import { makeStageArrangement } from './stageComposition.js';

// Each row is one bar of eighth notes, with a different pocket for each band.
// A dot leaves space. Zero denotes a root, and the other digits are intervals
// in scale degrees above the chord. The closing note can lead into the next bar.
const bands = {
  folk: {
    baseHz:196, tempoRange:[82,110], lead:'triangle', double:'sine', overtone:2, cutoff:2000,
    bass:'triangle', chords:'triangle', attack:.006, length:.8, drum:'heel',
    leadBars:['x.x.x.xx','x..xx.x.','x.xx..x.'], bassBars:['0...4...','0...2..4','0...4.2.'],
    chordBars:['..x...x.','..x..x.x','..x...xx'],
  },
  jam: {
    baseHz:174.61, tempoRange:[84,112], lead:'triangle', double:'triangle', overtone:1.004, cutoff:1800,
    bass:'sawtooth', chords:'sine', attack:.026, length:1.45, drum:'kit',
    leadBars:['x..xx.x.','..x.x..x','x.x..xx.'], bassBars:['0..24..2','0...42..','0.2..4.6'],
    chordBars:['x...x...','..x...x.','x....x..'],
  },
  brass: {
    baseHz:196, tempoRange:[104,136], lead:'sawtooth', double:'square', overtone:1.003, cutoff:1250,
    bass:'square', chords:'triangle', attack:.025, length:.86, drum:'none',
    leadBars:['x..x.xx.','.xx...x.','x.x..x.x'], bassBars:['0...4..2','0.2.4.5.','0..24.2.'],
    chordBars:['........','........','........'],
  },
  funk: {
    baseHz:164.81, tempoRange:[90,115], lead:'square', double:'triangle', overtone:2, cutoff:1200,
    bass:'sawtooth', chords:'sawtooth', attack:.004, length:.36, drum:'kit',
    leadBars:['..x..x.x','.x.x..x.','x..x.x..'], bassBars:['0..70.4.','0.0..42.','0..24..7'],
    chordBars:['.x.x...x','...x.x.x','.x...xx.'],
  },
};
const part = (name,bars,intensity) => [name,bars,intensity];
const leadGain = {folk:.105, jam:.105, brass:.088, funk:.077};
export function makeLiveStageGenre(style) {
  const band = bands[style];
  return {
    name:style, baseHz:band.baseHz, tempoRange:band.tempoRange, leadTypes:[band.lead],
    sectionTemplate(rng) {
      const middle = rng() < .5 ? ['bridge','solo'] : ['solo','bridge'];
      const headBars = rng() < .5 ? 8 : 12;
      return [part('intro',4,.42), part('verse',headBars,.68), part('chorus',8,.93),
        part(middle[0],4,.57), part('verse',8,.70), part(middle[1],4,.59),
        part('chorus',8,.97), part('outro',4,.44)].map(([name,bars,intensity]) =>
          ({name,bars,intensity,variation:Math.floor(rng()*3)}));
    },
    makeVoices(ctx, dest, rng, tonic, identity) {
      const score = makeStageArrangement(style,rng,tonic,identity);
      const nodes = [], sources = [];
      const track = node => { nodes.push(node); return node; };
      function amp(cutoff, filterType = 'lowpass') {
        const gain = track(ctx.createGain()), filter = track(ctx.createBiquadFilter());
        gain.gain.value = 0;
        filter.type = filterType; filter.frequency.value = cutoff;
        filter.connect(gain).connect(dest);
        return {gain:gain.gain, input:filter, tones:[]};
      }
      function tone(voice, type, tuning) {
        const osc = track(ctx.createOscillator()); osc.type = type;
        osc.connect(voice.input); osc.start(); sources.push(osc);
        voice.tones.push({frequency:osc.frequency, tuning});
      }
      const lead = amp(band.cutoff * (1 + .12 * score.register));
      tone(lead,band.lead,1); tone(lead,band.double,band.overtone);
      const bass = amp(style==='funk'?710:410); tone(bass,band.bass,1);
      let chord, kick, snare, hat;
      if (style !== 'brass') {
        chord = amp(style==='funk'?940:1550);
        tone(chord,band.chords,1); tone(chord,band.chords,1);
        kick = amp(320); tone(kick,'sine',1);
      }
      if (band.drum === 'kit') {
        snare = amp(1250,'bandpass'); hat = amp(5900,'highpass');
        const noise = track(ctx.createBufferSource());
        const buf = ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.07),ctx.sampleRate);
        const samples = buf.getChannelData(0);
        // Buffer length varies with the device's sample rate. This stream
        // belongs to the drum texture and cannot advance the song generator.
        const drumNoise = mulberry32((identity ?? 0) ^ 0x6472756d);
        for (let i=0;i<samples.length;i++) samples[i]=drumNoise()*2-1;
        noise.buffer=buf; noise.loop=true; noise.connect(snare.input); noise.connect(hat.input);
        noise.start(); sources.push(noise);
      }
      return {voices:{lead,bass,chord,kick,snare,hat,score}, teardown:[() => {
        for (const source of sources) source.stop();
        for (const node of nodes) node.disconnect();
      }]};
    },
    playBeat({t, beat, beatInBar:b, barInSection:bar, section, voices:v, gainMod, fill, cue}) {
      const {score} = v, name = section.name;
      const slot = (score.groove + (bar % 4 < 2 ? 0 : 1) + (name === 'chorus' ? 1 : 0)) % 3;
      const spare = name === 'intro' || name === 'outro' || name === 'bridge';
      const solo = name === 'solo', chorus = name === 'chorus';
      const level = gainMod * (.82 + section.intensity * .18);
      function envelope(voice,lane,at,length,gain,attack,pitch = 0) {
        cue?.(lane,at,length,pitch);
        voice.gain.cancelScheduledValues(at);
        voice.gain.setValueAtTime(.0001,at);
        voice.gain.exponentialRampToValueAtTime(gain * level, at+Math.min(attack,length*.3));
        if (lane === 'lead' && (style === 'brass' || style === 'jam' || length > beat)) {
          // Hold the horn breath or amplified guitar string through its vowel.
          // A straight fade all the way from the attack sounds like a mallet.
          voice.gain.exponentialRampToValueAtTime(gain * level * .64, at + length * .62);
        }
        voice.gain.exponentialRampToValueAtTime(.0001,at+length);
      }
      function note(voice,lane,pitch,at,length,gain,attack) {
        // Picked strings lose their bright attack before their fundamental.
        // Funk's bass opens the filter on accented notes and chokes it quickly.
        if ((style === 'folk' && lane === 'lead') || (style === 'funk' && lane === 'bass')) {
          const cutoff = voice.input.frequency;
          cutoff.cancelScheduledValues(at);
          cutoff.setValueAtTime(Math.min(3900,pitch * (style === 'folk' ? 8 : 13)),at);
          cutoff.exponentialRampToValueAtTime(Math.max(170,pitch * 2.4),at + length * .85);
        }
        for(const tone of voice.tones) tone.frequency.setValueAtTime(pitch*tone.tuning,at);
        envelope(voice,lane,at,length,gain,attack,pitch);
      }
      for (let sub=0;sub<2;sub++) {
        const step = b*2 + sub;
        // The funk guitarist and bassist anticipate the next downbeat with a
        // clipped last sixteenth once per phrase. The kit holds its backbeat.
        const offbeat = style === 'funk' && step === 7 && bar % 2 ? .75 : score.swing;
        const at = t + (sub ? offbeat*beat : 0);
        const eighth = (sub ? 1-offbeat : offbeat)*beat;
        const kitAt = t + (sub ? score.swing*beat : 0);
        const turnaround=fill && step===7;
        const answer=bar%4===3;
        const headPlays=band.leadBars[slot][step]==='x';
        // Let selected phrase endings sing through the following rests, with
        // no retrigger truncating the held monophonic voice. Funk gets fewer.
        const phraseHold = !sub && b===2 && bar%(style==='funk'?8:4)===(style==='funk'?7:3) && !spare;
        if (at >= (v.leadUntil ?? -Infinity) && (headPlays || phraseHold || turnaround || (solo && (step+bar)%3===0))
            && (!spare || (!sub && (b===0 || b===2)) || (answer && b===3))) {
          const pitch=turnaround && name==='outro' ? score.chord('verse',0) : score.lead(name,bar,b,sub);
          const hasRoom = band.leadBars[slot][(step+1)%8] === '.';
          const held = style !== 'funk' && hasRoom && (b === 0 || (answer && b === 2));
          const length = phraseHold ? beat*(style==='funk'?1.3:style==='folk'?1.85:2.4) : held ? Math.min(beat * 1.5,eighth * band.length + beat * .48) : eighth * band.length;
          v.leadUntil=phraseHold?at+length:-Infinity;
          note(v.lead,'lead',pitch,at,length,leadGain[style]*(sub?.8:1),band.attack);
        }
        const bassStep=band.bassBars[slot][step];
        if (bassStep!=='.' && (!spare || !sub) && (!solo || b%2===0)) {
          const pitch=turnaround ? score.bass(name,bar+1,-1) : score.bass(name,bar,Number(bassStep));
          note(v.bass,'bass',pitch,at,eighth*(style==='funk'?.9:1.6),.16,.008);
        }
        if (v.chord && band.chordBars[slot][step]==='x' && (!solo || step===0) && (!spare || b===1)) {
          const third=score.chord(name,bar,2), other=score.chord(name,bar,style==='funk'?6:4);
          v.chord.tones[0].frequency.setValueAtTime(third,at);
          v.chord.tones[1].frequency.setValueAtTime(other,at);
          envelope(v.chord,'chord',at,eighth*(style==='funk'?.43:1.32),.062,.009);
        }
        if (v.kick && ((!sub && (b===0 || (!spare && b===2))) || (style==='funk' && chorus && step===7))) {
          v.kick.tones[0].frequency.setValueAtTime(style==='folk'?83:116,kitAt);
          v.kick.tones[0].frequency.exponentialRampToValueAtTime(44,kitAt+.08);
          envelope(v.kick,'kick',kitAt,.14,style==='folk'?.105:.17,.004);
        }
        if (v.snare && !spare && ((!sub && b%2===1) || (fill && step===7))) {
          envelope(v.snare,'snare',kitAt,sub?.04:.105,sub?.041:.10,.003);
        }
        if (v.hat && !spare && !solo && (sub || (chorus && b%2===0))) {
          envelope(v.hat,'hat',kitAt,turnaround?.10:.044,sub?.048:.027,.003);
        }
      }
    },
  };
}
