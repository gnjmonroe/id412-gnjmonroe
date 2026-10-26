// All the numbers and colours that shape the mango farm. Time is in days.
// `settings` is read every frame, so the admin panel can change it while the farm runs.

export const WIDTH = 1000; // farm size in farm units; the canvas scales it to fit
export const HEIGHT = 640;
export const CULTIVARS = ["Keitt", "Kent"]; // each has a ripe fruit colour in settings.colors

export const settings = {
	rules: {
		minSpacing: 56, // closest two trunks may be
		fruitPerTree: 6,
		restDays: 120, // days with no fruit between two seasons
		flowerDays: 15,
		greenDays: 60,
		ripeDays: 10, // ripe fruit waits this long to be picked or to fall
		harvestShare: 0.8, // share of ripe fruit that is picked; the rest falls
		seedChance: 0.3, // chance that a fallen fruit grows a new seed
		seedDistance: 70, // how far a fallen seed may land from its parent
		vigorJitter: 0.2, // how much a seed tree can differ from its parent (vigor 1 = normal)
		daysPerSecond: 20, // normal speed
		startTrees: 4, // used when the farm restarts
		seed: 412, // random seed, so every run is the same; used when the farm restarts
	},
	// Days a tree spends in each stage before moving to the next one.
	stageDays: {
		seed: 10,
		seedling: 40,
		sapling: 120,
		mature: 60,
		fruiting: 900,
		senescent: 60,
	},
	colors: {
		soil: "#6b4f33",
		leaf: "#2f7d32",
		oldLeaf: "#8a7a4a",
		seed: "#5b3a1e",
		flower: "#f7b6d2",
		green: "#9bc53d",
		fallen: "#8a5a2b",
		link: "#ffffff", // lines from a tree to its parent
		Keitt: "#e8a317", // ripe fruit, one colour per cultivar
		Kent: "#d9482b",
	},
};

const defaults = structuredClone(settings);

export function resetSettings() {
	Object.assign(settings.rules, defaults.rules);
	Object.assign(settings.stageDays, defaults.stageDays);
	Object.assign(settings.colors, defaults.colors);
}
