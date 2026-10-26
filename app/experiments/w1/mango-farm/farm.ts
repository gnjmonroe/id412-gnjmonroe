// The mango farm as plain data. No React, no canvas: page.tsx only reads this and draws it.
import { CULTIVARS, HEIGHT, settings, WIDTH } from "./settings";

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
	cultivar: string; // one of CULTIVARS
	vigor: number;
	rest: number; // days since the last fruit season
	fruits: Fruit[];
};

export type Farm = {
	day: number;
	trees: Tree[];
	harvested: number;
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
		cultivar: "Keitt",
		vigor: 1,
		rest: settings.rules.restDays,
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
		harvested: 0,
		nextId: 1,
		random: settings.rules.seed,
	};
	const names = CULTIVARS;
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
			cultivar: names[farm.trees.length % names.length],
		});
	}
	return farm;
}

// Propagation by seed: a new tree starts as a seed, with a vigor a little different from its parent.
export function plant(farm: Farm, x: number, y: number, parent?: Tree) {
	if (!isFree(farm, x, y)) return null;
	const names = CULTIVARS;
	const vigor = parent
		? parent.vigor + (random(farm) - 0.5) * 2 * settings.rules.vigorJitter
		: 1;
	return addTree(farm, x, y, {
		origin: "seed",
		parentId: parent?.id,
		cultivar: parent
			? parent.cultivar
			: names[Math.floor(random(farm) * names.length)],
		vigor: Math.max(0.5, vigor),
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
		cultivar: parent.cultivar,
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
	tree.age += dt * tree.vigor;
	const next = STAGES[STAGES.indexOf(tree.stage) + 1];
	if (next && tree.age >= settings.stageDays[tree.stage]) {
		tree.stage = next;
		tree.age = 0;
	}
}

function growFruits(farm: Farm, tree: Tree, dt: number) {
	if (tree.stage === "fruiting" && tree.fruits.length === 0) {
		tree.rest += dt;
		if (tree.rest >= settings.rules.restDays) {
			tree.rest = 0;
			for (let i = 0; i < settings.rules.fruitPerTree; i++)
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
		} else if (
			fruit.stage === "green" &&
			fruit.age >= settings.rules.greenDays
		) {
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

export function stats(farm: Farm) {
	const trees = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
		Stage,
		number
	>;
	for (const tree of farm.trees) trees[tree.stage]++;
	return { day: Math.floor(farm.day), trees, harvested: farm.harvested };
}
