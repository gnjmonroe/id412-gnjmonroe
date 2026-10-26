// All the numbers and colours that shape the mango farm. Time is in days.
// `settings` is read every frame, so the admin panel can change it while the farm runs.

export const WIDTH = 1000; // farm size in farm units; the canvas scales it to fit
export const HEIGHT = 640;

export const settings = {
	rules: {
		minSpacing: 56, // closest two trunks may be
		restDays: 120, // days with no fruit between two seasons
		flowerDays: 15,
		ripeDays: 10, // ripe fruit waits this long to be picked or to fall
		harvestShare: 0.8, // share of ripe fruit that is picked; the rest falls
		seedChance: 0.3, // chance that a fallen fruit grows a new seed
		seedDistance: 70, // how far a fallen seed may land from its parent
		vigorJitter: 0.2, // how much a true seed tree can differ from its parent (vigor 1 = normal)
		seedlingVariation: 0.4, // how far a new seedling variety's traits may stray from its mother
		offTypeChance: 0.1, // chance that a true-seed variety still grows a new seedling variety
		daysPerSecond: 20, // normal speed
		farmerSpeed: 60, // farm units a farmer walks per day
		graftDays: 5, // days a farmer spends taking a cutting
		farmerRestDays: 30, // days a farmer rests after each graft
		promisingFruit: 8, // a seedling variety with at least this much fruit is worth grafting
		startTrees: 4, // used when the farm restarts
		farmers: 2, // used when the farm restarts
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
	// Mango varieties. Each one grows, fruits and spreads differently, and looks different.
	//   fruit: fruit per season          growth: how fast it ages (1 = normal)
	//   ripenDays: green → ripe          alternate: 1 = heavy and light years take turns
	//   trueSeed: 1 = its seeds grow the same variety (polyembryonic), 0 = each seed is a new seedling variety
	//   lobes: canopy outline (0 = round)   leaf: canopy fill colour   ripe: ripe fruit colour
	varieties: {
		Keitt: {
			fruit: 4,
			growth: 0.8,
			ripenDays: 90,
			alternate: 0,
			trueSeed: 0,
			lobes: 0,
			leaf: "#00a0e0", // cyan
			ripe: "#ffd400",
		},
		Kent: {
			fruit: 6,
			growth: 1,
			ripenDays: 70,
			alternate: 0,
			trueSeed: 0,
			lobes: 5,
			leaf: "#e6007e", // magenta
			ripe: "#1f3fd1",
		},
		Alphonso: {
			fruit: 9,
			growth: 1.1,
			ripenDays: 50,
			alternate: 1,
			trueSeed: 0,
			lobes: 9,
			leaf: "#ff4f1f", // red-orange
			ripe: "#00a0e0",
		},
		Ataulfo: {
			fruit: 11,
			growth: 1,
			ripenDays: 60,
			alternate: 0,
			trueSeed: 1,
			lobes: 3,
			leaf: "#ffd400", // yellow
			ripe: "#e2001a",
		},
		Carabao: {
			fruit: 7,
			growth: 1.25,
			ripenDays: 65,
			alternate: 0,
			trueSeed: 1,
			lobes: 6,
			leaf: "#1f3fd1", // ultramarine
			ripe: "#ff7a00",
		},
	},
	// Printing inks on paper, after Karel Martens' overprinted monoprints. Canopies are drawn with a
	// multiply blend, so where trees overlap their colours mix like overprinted ink.
	colors: {
		soil: "#efece4", // paper
		oldLeaf: "#b8b2a7",
		seed: "#1d1d1b",
		flower: "#ff9ec8",
		green: "#00a651", // unripe fruit, cuttings and new grafts
		fallen: "#8c8c8c",
		link: "#1d1d1b", // lines from a tree to its parent, and the selection ring
		farmer: "#efece4",
		hat: "#1d1d1b",
	},
};

export type Variety = keyof typeof settings.varieties;
export type Traits = (typeof settings.varieties)[Variety];
export const VARIETIES = Object.keys(settings.varieties) as Variety[];

const defaults = structuredClone(settings);

export function resetSettings() {
	Object.assign(settings.rules, defaults.rules);
	Object.assign(settings.stageDays, defaults.stageDays);
	Object.assign(settings.colors, defaults.colors);
	for (const name of VARIETIES)
		Object.assign(settings.varieties[name], defaults.varieties[name]);
}
