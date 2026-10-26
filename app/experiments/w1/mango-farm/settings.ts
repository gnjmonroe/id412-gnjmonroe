// All the numbers that shape the mango farm. Time is in days.

export const WIDTH = 1000; // farm size in farm units; the canvas scales it to fit
export const HEIGHT = 640;
export const MIN_SPACING = 56; // closest two trunks may be

// Days a tree spends in each stage before moving to the next one.
export const STAGE_DAYS = {
	seed: 10,
	seedling: 40,
	sapling: 120,
	mature: 60,
	fruiting: 900,
	senescent: 60,
};

// Fruit cycle on a fruiting tree
export const FRUIT_PER_TREE = 6;
export const REST_DAYS = 120; // days with no fruit between two seasons
export const FLOWER_DAYS = 15;
export const GREEN_DAYS = 60;
export const RIPE_DAYS = 10; // ripe fruit waits this long to be picked or to fall
export const HARVEST_SHARE = 0.8; // share of ripe fruit that is picked; the rest falls
export const SEED_CHANCE = 0.3; // chance that a fallen fruit grows a new seed
export const SEED_DISTANCE = 70; // how far a fallen seed may land from its parent

// Cultivars: the colour of ripe fruit. Vigor (1 = normal) makes a tree age faster or slower.
export const CULTIVARS: Record<string, { ripe: string }> = {
	Keitt: { ripe: "#e8a317" },
	Kent: { ripe: "#d9482b" },
};
export const VIGOR_JITTER = 0.2; // how much a seed tree can differ from its parent

export const START_TREES = 4;
export const SEED = 412; // random seed, so every run is the same
export const DAYS_PER_SECOND = 20; // normal speed
