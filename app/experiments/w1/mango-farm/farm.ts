// The mango farm as plain data. No React, no canvas: page.tsx only reads this and draws it.
import {
	HEIGHT,
	settings,
	VARIETIES,
	WIDTH,
	type Traits,
	type Variety,
} from "./settings";

// Life of a tree, in order. A senescent tree is removed when its time is up.
export const STAGES = [
	"seed",
	"seedling",
	"sapling",
	"mature",
	"fruiting",
	"senescent",
] as const;
export type Stage = (typeof STAGES)[number];

// Life of one fruit. A fallen fruit may grow a new seed, then disappears.
export type Fruit = {
	stage: "flower" | "green" | "ripe" | "fallen";
	age: number;
};

export type Tree = {
	id: number;
	x: number;
	y: number;
	stage: Stage;
	age: number; // days spent in this stage
	origin: "start" | "seed" | "graft"; // how this tree began
	parentId?: number;
	variety: string; // a named variety, or "seedling #id" for a new one grown from seed
	traits?: Traits; // only seedling varieties carry their own traits; named ones use settings
	vigor: number; // this tree's own growth speed, on top of its variety's
	rest: number; // days since the last fruit season
	seasons: number; // fruit seasons so far
	fruits: Fruit[];
};

// A farmer keeps the non-true-seed varieties alive by grafting them, since their seeds won't.
// idle → walk to a grown tree → take a cutting → walk to free ground → graft a sapling → rest → idle
export type Farmer = {
	id: number;
	x: number;
	y: number;
	task: "idle" | "toTree" | "cutting" | "toSpot" | "resting";
	treeId?: number; // the tree the cutting comes from
	spotX: number; // where the graft will go
	spotY: number;
	timer: number; // days left cutting or resting
	angle: number; // direction the farmer last walked, for drawing
	walked: number; // total distance walked, for drawing footsteps
};

// A fruit bat lives at a roost off the farm. It flies in to a tree with ripe fruit, eats one,
// and flies off again. Sometimes it carries the seed away and drops it, which plants a new tree.
// away → fly to a tree → eat → fly off (maybe dropping a seed) → away
export type Bat = {
	id: number;
	x: number;
	y: number;
	task: "away" | "toTree" | "eating" | "leaving";
	treeId?: number;
	seedFrom?: Tree; // the tree whose seed it carries, if any
	exitX: number; // where it leaves the farm
	exitY: number;
	timer: number; // days left eating or away
	angle: number; // direction of flight, for drawing
	flown: number; // distance flown since it started leaving
	flaps: number; // total distance flown, for drawing the wing beat
};

export type Farm = {
	day: number;
	trees: Tree[];
	farmers: Farmer[];
	bats: Bat[];
	batEaten: number; // fruit eaten by bats
	harvested: number;
	grafts: number; // grafts made by farmers
	attention: Record<string, number>; // grafting trips started per variety ("seedlings" for all seedlings)
	graftLog: { x: number; y: number; day: number }[]; // recent farmer grafts, for drawing
	nextId: number;
	random: number; // state of the random number generator
};

// Small seeded random number generator (mulberry32): the same seed gives the same farm.
function random(farm: Farm) {
	farm.random = (farm.random + 0x6d2b79f5) | 0;
	let t = Math.imul(farm.random ^ (farm.random >>> 15), 1 | farm.random);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function isFree(farm: Farm, x: number, y: number) {
	if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT) return false;
	return farm.trees.every(
		(tree) => Math.hypot(tree.x - x, tree.y - y) >= settings.rules.minSpacing,
	);
}

function addTree(farm: Farm, x: number, y: number, fields: Partial<Tree>) {
	const tree: Tree = {
		id: farm.nextId++,
		x,
		y,
		stage: "seed",
		age: 0,
		origin: "seed",
		variety: "Keitt",
		vigor: 1,
		rest: settings.rules.restDays,
		seasons: 0,
		fruits: [],
		...fields,
	};
	farm.trees.push(tree);
	return tree;
}

export function createFarm(): Farm {
	const farm: Farm = {
		day: 0,
		trees: [],
		farmers: [],
		bats: [],
		batEaten: 0,
		harvested: 0,
		grafts: 0,
		graftLog: [],
		attention: {},
		nextId: 1,
		random: settings.rules.seed,
	};
	for (
		let i = 0;
		i < settings.rules.startTrees * 20 &&
		farm.trees.length < settings.rules.startTrees;
		i++
	) {
		const x = random(farm) * WIDTH;
		const y = random(farm) * HEIGHT;
		if (!isFree(farm, x, y)) continue;
		addTree(farm, x, y, {
			stage: "mature",
			origin: "start",
			variety: VARIETIES[farm.trees.length % VARIETIES.length],
		});
	}
	for (let i = 0; i < settings.rules.farmers; i++) {
		farm.farmers.push({
			id: i + 1,
			x: random(farm) * WIDTH,
			y: random(farm) * HEIGHT,
			task: "idle",
			spotX: 0,
			spotY: 0,
			timer: 0,
			angle: 0,
			walked: 0,
		});
	}
	for (let i = 0; i < settings.rules.farmers; i++) {
		// one bat per farmer
		farm.bats.push({
			id: i + 1,
			x: 0,
			y: 0,
			task: "away",
			exitX: 0,
			exitY: 0,
			timer: random(farm) * settings.rules.batAwayDays, // so they don't all arrive at once
			angle: 0,
			flown: 0,
			flaps: 0,
		});
	}
	return farm;
}

function randomVariety(farm: Farm) {
	return VARIETIES[Math.floor(random(farm) * VARIETIES.length)];
}

// The traits a tree grows by: its own if it is a seedling variety, otherwise its named variety's.
export function traitsOf(tree: Tree): Traits {
	return tree.traits ?? settings.varieties[tree.variety as Variety];
}

// A new seedling variety: the mother's traits, each nudged by chance. Like real mango seedlings,
// most yield a little less than their mother, and a few turn out better.
function seedlingTraits(farm: Farm, mother: Traits): Traits {
	const v = settings.rules.seedlingVariation;
	const nudge = (value: number) => value * (1 + (random(farm) - 0.5) * 2 * v);
	return {
		fruit: Math.max(1, Math.round(nudge(mother.fruit) * 0.85)),
		growth: Math.max(0.3, Number(nudge(mother.growth).toFixed(2))),
		ripenDays: Math.max(10, Math.round(nudge(mother.ripenDays))),
		alternate: random(farm) < 0.5 ? 1 : 0,
		trueSeed: 0,
		// Now and then a seedling grows a different kind of canopy altogether.
		shape: random(farm) < 0.3 ? Math.floor(random(farm) * 6) : mother.shape,
		lobes: Math.max(3, mother.lobes + Math.round((random(farm) - 0.5) * 4)),
		leaf: shiftColor(farm, mother.leaf, 60),
		ripe: shiftColor(farm, mother.ripe, 70),
	};
}

// Move each of a "#rrggbb" colour's channels by up to `amount`.
function shiftColor(farm: Farm, hex: string, amount: number) {
	let out = "#";
	for (let i = 1; i < 7; i += 2) {
		const channel =
			parseInt(hex.slice(i, i + 2), 16) + (random(farm) - 0.5) * 2 * amount;
		out += Math.round(Math.min(255, Math.max(0, channel)))
			.toString(16)
			.padStart(2, "0");
	}
	return out;
}

// Propagation by seed: a new tree starts as a seed, with a vigor a little different from its parent.
// A true-seed (polyembryonic) variety mostly grows a copy of itself. Any other seed, and the odd
// off-type true seed, grows a new seedling variety of its own.
export function plant(farm: Farm, x: number, y: number, parent?: Tree) {
	if (!isFree(farm, x, y)) return null;
	if (!parent)
		return addTree(farm, x, y, {
			origin: "seed",
			variety: randomVariety(farm),
		});
	const mother = traitsOf(parent);
	if (mother.trueSeed === 1 && random(farm) >= settings.rules.offTypeChance) {
		const jitter = settings.rules.vigorJitter;
		return addTree(farm, x, y, {
			origin: "seed",
			parentId: parent.id,
			variety: parent.variety,
			traits: parent.traits,
			vigor: Math.max(0.5, parent.vigor + (random(farm) - 0.5) * 2 * jitter),
		});
	}
	const id = farm.nextId;
	return addTree(farm, x, y, {
		origin: "seed",
		parentId: parent.id,
		variety: `seedling #${id}`,
		traits: seedlingTraits(farm, mother),
	});
}

// Propagation by graft: a cutting of a grown tree, an exact copy that starts as a sapling.
export function graft(farm: Farm, parentId: number, x: number, y: number) {
	const parent = farm.trees.find((tree) => tree.id === parentId);
	if (!parent || !isFree(farm, x, y)) return null;
	return addTree(farm, x, y, {
		stage: "sapling",
		origin: "graft",
		parentId,
		variety: parent.variety,
		traits: parent.traits, // a graft is a clone, so a seedling variety spreads unchanged
		vigor: parent.vigor,
	});
}

// Advance the farm by a number of days.
export function step(farm: Farm, days: number) {
	while (days > 0) {
		const dt = Math.min(1, days);
		tick(farm, dt);
		days -= dt;
	}
}

function tick(farm: Farm, dt: number) {
	farm.day += dt;
	farm.graftLog = farm.graftLog.filter((entry) => farm.day - entry.day < 20);
	for (const farmer of farm.farmers) workFarmer(farm, farmer, dt);
	for (const bat of farm.bats) workBat(farm, bat, dt);
	for (const tree of [...farm.trees]) {
		growTree(tree, dt);
		growFruits(farm, tree, dt);
		if (
			tree.stage === "senescent" &&
			tree.age >= settings.stageDays.senescent
		) {
			farm.trees.splice(farm.trees.indexOf(tree), 1);
		}
	}
}

function growTree(tree: Tree, dt: number) {
	tree.age += dt * tree.vigor * traitsOf(tree).growth;
	const next = STAGES[STAGES.indexOf(tree.stage) + 1];
	if (next && tree.age >= settings.stageDays[tree.stage]) {
		tree.stage = next;
		tree.age = 0;
	}
}

function growFruits(farm: Farm, tree: Tree, dt: number) {
	const variety = traitsOf(tree);
	if (tree.stage === "fruiting" && tree.fruits.length === 0) {
		tree.rest += dt;
		if (tree.rest >= settings.rules.restDays) {
			tree.rest = 0;
			tree.seasons++;
			// Alternate bearing: every second season is a light one, with half the fruit.
			const light = variety.alternate === 1 && tree.seasons % 2 === 0;
			const count = light ? Math.floor(variety.fruit / 2) : variety.fruit;
			for (let i = 0; i < count; i++)
				tree.fruits.push({ stage: "flower", age: 0 });
		}
	}
	for (const fruit of [...tree.fruits]) {
		fruit.age += dt;
		if (tree.stage !== "fruiting" && fruit.stage !== "fallen") {
			fruit.stage = "fallen"; // the tree is done, fruit drops
			fruit.age = 0;
		} else if (
			fruit.stage === "flower" &&
			fruit.age >= settings.rules.flowerDays
		) {
			fruit.stage = "green";
			fruit.age = 0;
		} else if (fruit.stage === "green" && fruit.age >= variety.ripenDays) {
			fruit.stage = "ripe";
			fruit.age = 0;
		} else if (fruit.stage === "ripe" && fruit.age >= settings.rules.ripeDays) {
			if (random(farm) < settings.rules.harvestShare) {
				farm.harvested++;
				tree.fruits.splice(tree.fruits.indexOf(fruit), 1);
			} else {
				fruit.stage = "fallen";
				fruit.age = 0;
			}
		} else if (fruit.stage === "fallen" && fruit.age >= 5) {
			tree.fruits.splice(tree.fruits.indexOf(fruit), 1);
			if (random(farm) < settings.rules.seedChance) {
				const angle = random(farm) * Math.PI * 2;
				const distance =
					settings.rules.minSpacing +
					random(farm) * settings.rules.seedDistance;
				plant(
					farm,
					tree.x + Math.cos(angle) * distance,
					tree.y + Math.sin(angle) * distance,
					tree,
				);
			}
		}
	}
}

// Farmers graft varieties whose seeds won't carry them on: named varieties that don't breed true
// (trueSeed 0), and seedling varieties that turned out promising (enough fruit).
function worthGrafting(tree: Tree) {
	if (tree.traits) return tree.traits.fruit >= settings.rules.promisingFruit;
	return settings.varieties[tree.variety as Variety].trueSeed === 0;
}

function pickTree(farm: Farm) {
	const grown = farm.trees.filter(
		(tree) =>
			worthGrafting(tree) &&
			(tree.stage === "mature" || tree.stage === "fruiting"),
	);
	if (grown.length === 0) return undefined;
	// Equal attention: go to the variety that has had the fewest grafting trips so far.
	// All seedling varieties share one turn, so a crowd of seedlings can't take over.
	const turns = (tree: Tree) => farm.attention[attentionKey(tree)] ?? 0;
	const fewest = Math.min(...grown.map(turns));
	const next = grown.filter((tree) => turns(tree) === fewest);
	return next[Math.floor(random(farm) * next.length)];
}

function attentionKey(tree: Tree) {
	return tree.traits ? "seedlings" : tree.variety;
}

// Look for free ground near a tree, at most 20 tries.
function findSpot(farm: Farm, tree: Tree) {
	for (let i = 0; i < 20; i++) {
		const angle = random(farm) * Math.PI * 2;
		const distance =
			settings.rules.minSpacing + random(farm) * settings.rules.seedDistance;
		const x = tree.x + Math.cos(angle) * distance;
		const y = tree.y + Math.sin(angle) * distance;
		if (isFree(farm, x, y)) return { x, y };
	}
	return undefined;
}

// Move a farmer toward a point. Returns true once there.
function walk(farmer: Farmer, x: number, y: number, dt: number) {
	const dx = x - farmer.x;
	const dy = y - farmer.y;
	const distance = Math.hypot(dx, dy);
	const reach = settings.rules.farmerSpeed * dt;
	if (distance > 0) farmer.angle = Math.atan2(dy, dx);
	farmer.walked += Math.min(distance, reach);
	if (distance <= reach) {
		farmer.x = x;
		farmer.y = y;
		return true;
	}
	farmer.x += (dx / distance) * reach;
	farmer.y += (dy / distance) * reach;
	return false;
}

function workFarmer(farm: Farm, farmer: Farmer, dt: number) {
	const tree = farm.trees.find((t) => t.id === farmer.treeId);
	if (farmer.task === "idle") {
		const target = pickTree(farm);
		const spot = target && findSpot(farm, target);
		if (target && spot) {
			const key = attentionKey(target);
			farm.attention[key] = (farm.attention[key] ?? 0) + 1;
			farmer.task = "toTree";
			farmer.treeId = target.id;
			farmer.spotX = spot.x;
			farmer.spotY = spot.y;
		}
	} else if (farmer.task === "toTree") {
		if (!tree) farmer.task = "idle"; // the tree died on the way
		else if (walk(farmer, tree.x, tree.y, dt)) {
			farmer.task = "cutting";
			farmer.timer = settings.rules.graftDays;
		}
	} else if (farmer.task === "cutting") {
		farmer.timer -= dt;
		if (farmer.timer <= 0) farmer.task = "toSpot";
	} else if (farmer.task === "toSpot") {
		if (walk(farmer, farmer.spotX, farmer.spotY, dt)) {
			// The spot may have filled up meanwhile; then the cutting is lost.
			if (
				farmer.treeId &&
				graft(farm, farmer.treeId, farmer.spotX, farmer.spotY)
			) {
				farm.grafts++;
				farm.graftLog.push({ x: farmer.spotX, y: farmer.spotY, day: farm.day });
			}
			farmer.task = "resting";
			farmer.timer = settings.rules.farmerRestDays;
		}
	} else if (farmer.task === "resting") {
		farmer.timer -= dt;
		if (farmer.timer <= 0) farmer.task = "idle";
	}
}

// A random point just outside the farm, where bats come from and go to.
function edgePoint(farm: Farm) {
	const t = random(farm);
	const side = Math.floor(random(farm) * 4);
	if (side === 0) return { x: t * WIDTH, y: -40 };
	if (side === 1) return { x: t * WIDTH, y: HEIGHT + 40 };
	if (side === 2) return { x: -40, y: t * HEIGHT };
	return { x: WIDTH + 40, y: t * HEIGHT };
}

// Move a bat toward a point. Returns true once there.
function fly(bat: Bat, x: number, y: number, dt: number) {
	const dx = x - bat.x;
	const dy = y - bat.y;
	const distance = Math.hypot(dx, dy);
	const reach = settings.rules.batSpeed * dt;
	if (distance > 0) bat.angle = Math.atan2(dy, dx);
	bat.flaps += Math.min(distance, reach);
	if (distance <= reach) {
		bat.x = x;
		bat.y = y;
		return true;
	}
	bat.x += (dx / distance) * reach;
	bat.y += (dy / distance) * reach;
	return false;
}

const hasRipe = (tree: Tree) =>
	tree.fruits.some((fruit) => fruit.stage === "ripe");

function workBat(farm: Farm, bat: Bat, dt: number) {
	const tree = farm.trees.find((t) => t.id === bat.treeId);
	if (bat.task === "away") {
		bat.timer -= dt;
		if (bat.timer > 0) return;
		const ripe = farm.trees.filter(hasRipe);
		if (ripe.length === 0) {
			bat.timer = 1; // nothing to eat yet; look again tomorrow
			return;
		}
		const start = edgePoint(farm);
		bat.x = start.x;
		bat.y = start.y;
		bat.treeId = ripe[Math.floor(random(farm) * ripe.length)].id;
		bat.task = "toTree";
	} else if (bat.task === "toTree") {
		// The fruit may be picked, or the tree gone, before the bat gets there.
		if (!tree || !hasRipe(tree)) {
			const other = farm.trees.filter(hasRipe);
			if (other.length === 0) return leave(farm, bat);
			bat.treeId = other[Math.floor(random(farm) * other.length)].id;
		} else if (fly(bat, tree.x, tree.y, dt)) {
			bat.task = "eating";
			bat.timer = settings.rules.batEatDays;
		}
	} else if (bat.task === "eating") {
		bat.timer -= dt;
		if (bat.timer > 0) return;
		const fruit = tree?.fruits.find((f) => f.stage === "ripe");
		if (tree && fruit) {
			tree.fruits.splice(tree.fruits.indexOf(fruit), 1);
			farm.batEaten++;
			if (random(farm) < settings.rules.batSeedChance) bat.seedFrom = tree;
		}
		leave(farm, bat);
	} else if (bat.task === "leaving") {
		// Drop the seed once well away from the tree, on the first free ground it passes.
		if (bat.seedFrom && bat.flown > settings.rules.minSpacing * 2) {
			if (plant(farm, bat.x, bat.y, bat.seedFrom)) bat.seedFrom = undefined;
		}
		const before = bat.flaps;
		const out = fly(bat, bat.exitX, bat.exitY, dt);
		bat.flown += bat.flaps - before;
		if (out) {
			bat.task = "away";
			bat.seedFrom = undefined; // a seed not dropped on the farm is lost
			bat.timer = settings.rules.batAwayDays * (0.5 + random(farm));
		}
	}
}

function leave(farm: Farm, bat: Bat) {
	const exit = edgePoint(farm);
	bat.exitX = exit.x;
	bat.exitY = exit.y;
	bat.flown = 0;
	bat.task = "leaving";
}

export function stats(farm: Farm) {
	const trees = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
		Stage,
		number
	>;
	const varieties = Object.fromEntries(
		VARIETIES.map((name) => [name, 0]),
	) as Record<string, number>;
	varieties.seedlings = 0;
	for (const tree of farm.trees) {
		trees[tree.stage]++;
		varieties[tree.traits ? "seedlings" : tree.variety]++;
	}
	return {
		day: Math.floor(farm.day),
		trees,
		varieties,
		harvested: farm.harvested,
		grafts: farm.grafts,
		batEaten: farm.batEaten,
	};
}
