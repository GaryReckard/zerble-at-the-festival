// Deterministic crowd-photographer role + shot timing.
//
// This module intentionally owns its own salted random stream. Adding the
// photographer must never consume or reorder the crowd/chunk RNG calls that
// already determine people, props, and world layout.

import { mulberry32, worldHash } from './rng.js';

export const PHOTOGRAPHER_SALT = 0x50A70F17 | 0;
export const PHOTOGRAPHER_RATE = 0.0125;
export const PHOTO_NOTICE_RANGE = 17;
export const PHOTO_NOTICE_MIN_RANGE = 4.5;
export const PHOTO_NOTICE_DURATION = 0.42;
export const PHOTO_POSE_DURATION = 1.05;
export const PHOTO_FLASH_DURATION = 0.12;
export const PHOTO_FLASH_AT = 0.62;

export const PHOTO_STATE_NOTICE = 'photographer_notice';
export const PHOTO_STATE_POSE = 'photographer_pose';

export function isPhotographerState(state) {
  return state === PHOTO_STATE_NOTICE || state === PHOTO_STATE_POSE;
}

// Position-derived and session-salted, so the same person is a photographer
// at the same seed regardless of spawn order or unrelated RNG consumers.
export function photographerProfile(pos, force = false) {
  const qx = Math.round(pos.x * 4) | 0;
  const qz = Math.round(pos.z * 4) | 0;
  const seed = worldHash(qx, qz, PHOTOGRAPHER_SALT);
  const rng = mulberry32(seed);
  const roll = rng();
  return {
    isPhotographer: force || roll < PHOTOGRAPHER_RATE,
    photoSeed: (rng() * 0x100000000) >>> 0,
    photoCrouch: rng() < 0.68,
    photoNoticeTimer: 1.5 + rng() * 7,
    photoCooldown: 0,
    photoFlashTimer: 0,
    photoShot: false,
  };
}

// A tiny per-NPC stream for later cooldowns. It never touches Math.random or
// the chunk RNG, and it mutates only the photographer's own seed.
export function nextPhotographerRandom(npc) {
  let x = (npc.photoSeed + 0x6D2B79F5) >>> 0;
  npc.photoSeed = x;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function startPhotographerShot(npc) {
  npc.state = PHOTO_STATE_NOTICE;
  npc.stateTimer = PHOTO_NOTICE_DURATION;
  npc.photoFlashTimer = 0;
  npc.photoShot = false;
  if (npc.vel) npc.vel.set(0, 0, 0);
}

// Return codes keep this steady-state helper allocation-free:
//   0 = not a photographer shot state
//   1 = shot state handled
//   2 = shot state handled and the flash began this tick
export function advancePhotographerShot(npc, dt) {
  if (!isPhotographerState(npc.state)) return 0;

  if (npc.photoFlashTimer > 0) {
    npc.photoFlashTimer = Math.max(0, npc.photoFlashTimer - dt);
  }
  npc.stateTimer -= dt;

  if (npc.state === PHOTO_STATE_NOTICE) {
    if (npc.stateTimer <= 0) {
      npc.state = PHOTO_STATE_POSE;
      npc.stateTimer = PHOTO_POSE_DURATION;
    }
    return 1;
  }

  let result = 1;
  if (!npc.photoShot && npc.stateTimer <= PHOTO_FLASH_AT) {
    npc.photoShot = true;
    npc.photoFlashTimer = PHOTO_FLASH_DURATION;
    result = 2;
  }
  if (npc.stateTimer <= 0) {
    npc.state = 'watching';
    npc.stateTimer = 1.2;
    npc.photoCooldown = 18 + nextPhotographerRandom(npc) * 24;
    npc.photoNoticeTimer = 1.5 + nextPhotographerRandom(npc) * 5;
  }
  return result;
}

export function tickPhotographerOpportunity(npc, dt, distance, eligible) {
  if (!npc.isPhotographer) return false;
  if (npc.photoCooldown > 0) npc.photoCooldown = Math.max(0, npc.photoCooldown - dt);
  if (!eligible || npc.photoCooldown > 0 || distance < PHOTO_NOTICE_MIN_RANGE || distance > PHOTO_NOTICE_RANGE) {
    return false;
  }
  npc.photoNoticeTimer -= dt;
  if (npc.photoNoticeTimer > 0) return false;
  startPhotographerShot(npc);
  return true;
}
