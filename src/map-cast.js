// Authentic Littlelands Cast Catalog and Action Binding
// Contains authored 3D-baked motion manifests for foundational NPCs and livestock.

export const AUTHENTIC_CAST = {
  'npc-farmer': {
    id: 'npc-farmer',
    name: 'Mara',
    species: 'human',
    dir: 'npcs/npc-farmer',
    frameWidth: 128,
    frameHeight: 176,
    spec: { width: 60, height: 82.5, anchorX: 0.5, anchorY: 0.7997777105572947 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.333 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      work: { name: 'work', frames: 16, directions: 16, duration: 1.6 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  },
  'npc-miller': {
    id: 'npc-miller',
    name: 'Bram',
    species: 'human',
    dir: 'npcs/npc-miller',
    frameWidth: 128,
    frameHeight: 176,
    spec: { width: 60, height: 82.5, anchorX: 0.5, anchorY: 0.7997777105572947 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.333 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      work: { name: 'work', frames: 12, directions: 16, duration: 1.333 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  },
  'npc-child-1': {
    id: 'npc-child-1',
    name: 'Pip',
    species: 'child',
    dir: 'npcs/npc-child-1',
    frameWidth: 128,
    frameHeight: 176,
    // Pip is modeled directly at 1.20m child scale within the 128x176 cell, requiring no runtime downscaling.
    spec: { width: 60, height: 82.5, anchorX: 0.5, anchorY: 0.7997777105572947 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.333 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      work: { name: 'work', frames: 12, directions: 16, duration: 1.2 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  },
  'ewe-cream': {
    id: 'ewe-cream',
    name: 'Cream Ewe',
    species: 'sheep',
    dir: 'animals/ewe-cream',
    frameWidth: 176,
    frameHeight: 144,
    spec: { width: 85.32, height: 69.808, anchorX: 0.5, anchorY: 0.7165061242913795 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.333 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      graze: { name: 'graze', frames: 16, directions: 16, duration: 1.6 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  },
  'cow-brown-white': {
    id: 'cow-brown-white',
    name: 'Brown-and-white Cow',
    species: 'cow',
    dir: 'animals/cow-brown-white',
    frameWidth: 176,
    frameHeight: 144,
    spec: { width: 116.346, height: 95.192, anchorX: 0.5, anchorY: 0.7453736075302302 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.5 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      graze: { name: 'graze', frames: 16, directions: 16, duration: 1.6 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  },
  'hen-brown': {
    id: 'hen-brown',
    name: 'Brown Hen',
    species: 'chicken',
    dir: 'animals/hen-brown',
    frameWidth: 96,
    frameHeight: 96,
    spec: { width: 28.558, height: 28.558, anchorX: 0.5, anchorY: 0.7116948770849049 },
    actions: {
      idle: { name: 'idle', frames: 8, directions: 16, duration: 1.6 },
      walk: { name: 'walk', frames: 12, directions: 16, duration: 1.0 },
      turn: { name: 'turn', frames: 8, directions: 16, duration: 0.8 },
      peck: { name: 'peck', frames: 16, directions: 16, duration: 1.6 },
      interact: { name: 'interact', frames: 12, directions: 16, duration: 1.2 }
    }
  }
};

const ACTOR_SPECIES_MAPPING = {
  'npc-farmer': 'npc-farmer',
  'npc-miller': 'npc-miller',
  'npc-child-1': 'npc-child-1',
  'farm-sheep': 'ewe-cream',
  'sheep-1': 'ewe-cream',
  'sheep-2': 'ewe-cream',
  'sheep-3': 'ewe-cream',
  'farm-cow': 'cow-brown-white',
  'cow-1': 'cow-brown-white',
  'cow-2': 'cow-brown-white',
  'farm-chicken': 'hen-brown',
  'chicken-1': 'hen-brown',
  'chicken-2': 'hen-brown',
  'chicken-3': 'hen-brown'
};

export function getAuthenticCast(actorId, definition) {
  if (definition?.appearance?.authenticId && AUTHENTIC_CAST[definition.appearance.authenticId]) {
    return AUTHENTIC_CAST[definition.appearance.authenticId];
  }
  const mapped = ACTOR_SPECIES_MAPPING[actorId];
  if (mapped && AUTHENTIC_CAST[mapped]) {
    return AUTHENTIC_CAST[mapped];
  }
  if (definition?.appearance?.authentic && definition?.npc?.species) {
    const s = definition.npc.species;
    if (s === 'sheep') return AUTHENTIC_CAST['ewe-cream'];
    if (s === 'cow') return AUTHENTIC_CAST['cow-brown-white'];
    if (s === 'chicken') return AUTHENTIC_CAST['hen-brown'];
  }
  return null;
}

export function resolveAuthenticAction(authentic, actionName, isMoving) {
  if (isMoving) {
    return authentic.actions.walk || authentic.actions.idle;
  }
  if (!actionName || actionName === 'idle') {
    return authentic.actions.idle;
  }
  if (actionName === 'walk' || actionName === 'run' || actionName === 'trot') {
    return authentic.actions.walk || authentic.actions.idle;
  }
  if (actionName === 'turn' || actionName === 'turn-left-90' || actionName === 'turn-right-90') {
    return authentic.actions.turn || authentic.actions.idle;
  }
  if (['graze', 'eat', 'hay', 'drink', 'pasture'].includes(actionName)) {
    return authentic.actions.graze || authentic.actions.idle;
  }
  if (['peck', 'scratch-ground', 'dust-bathe'].includes(actionName)) {
    return authentic.actions.peck || authentic.actions.idle;
  }
  if (['work', 'till', 'hoe', 'harvest', 'carry', 'play-ball'].includes(actionName)) {
    return authentic.actions.work || authentic.actions.idle;
  }
  if (['interact', 'social', 'wave', 'cheer', 'talk', 'react', 'intimidate', 'bleat', 'moo', 'cluck'].includes(actionName)) {
    return authentic.actions.interact || authentic.actions.idle;
  }
  return authentic.actions[actionName] || authentic.actions.idle;
}
