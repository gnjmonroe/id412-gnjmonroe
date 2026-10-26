"use client";

import { useEffect, useRef, useState } from "react";
import {
	createFarm,
	graft,
	plant,
	step,
	stats,
	traitsOf,
	type Farm,
	type Farmer,
	type Tree,
} from "./farm";
import styles from "./page.module.css";
import { AdminPanel } from "./AdminPanel";
import { HEIGHT, settings, VARIETIES, WIDTH } from "./settings";

// The mango farm from farm.ts, drawn top-down on a canvas.
// Click empty ground to plant a seed. Click a grown tree, then empty ground, to graft a copy.

const SPEEDS = [1, 4, 16];
const TASK_NAMES = {
	idle: "looking",
	toTree: "walking to tree",
	cutting: "cutting",
	toSpot: "carrying cutting",
	resting: "resting",
};
const RADIUS = {
	seed: 3,
	seedling: 6,
	sapling: 11,
	mature: 20,
	fruiting: 22,
	senescent: 18,
};

// Canopy outline as an SVG path: a circle, or a wavy shape with `lobes` bumps.
// The canvas draws it with Path2D and the legend draws it with <svg>, so both look the same.
function canopyPath(x: number, y: number, r: number, lobes: number) {
	let path = "";
	for (let i = 0; i < 72; i++) {
		const angle = (i / 72) * Math.PI * 2;
		const radius = lobes < 1 ? r : r * (0.8 + 0.2 * Math.cos(angle * lobes));
		path += `${i === 0 ? "M" : "L"}${(x + Math.cos(angle) * radius).toFixed(2)} ${(y + Math.sin(angle) * radius).toFixed(2)}`;
	}
	return path + "Z";
}

// A farmer seen from above: a wide hat around a small head, with feet that step while walking.
// Walking to a tree: a faint trail to it. Cutting: a filling wedge shows progress.
// Carrying a cutting: a green sprig and a faint trail to the spot it will go. Resting: faded, with a "z".
function drawFarmer(ctx: CanvasRenderingContext2D, farm: Farm, farmer: Farmer) {
	const { colors, rules } = settings;
	const tree = farm.trees.find((t) => t.id === farmer.treeId);
	const walking = farmer.task === "toTree" || farmer.task === "toSpot";

	if (walking) {
		const goal =
			farmer.task === "toTree" ? tree : { x: farmer.spotX, y: farmer.spotY };
		if (goal) {
			ctx.globalAlpha = 0.25;
			ctx.fillStyle = colors.hat;
			for (let t = 0.1; t < 1; t += 0.1) {
				ctx.beginPath();
				ctx.arc(
					farmer.x + (goal.x - farmer.x) * t,
					farmer.y + (goal.y - farmer.y) * t,
					1.5,
					0,
					Math.PI * 2,
				);
				ctx.fill();
			}
			// Where the graft will go: a soft patch of ground
			if (farmer.task === "toSpot") {
				ctx.beginPath();
				ctx.arc(goal.x, goal.y, 8, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
		}
	}

	ctx.save();
	ctx.translate(farmer.x, farmer.y);
	ctx.rotate(farmer.angle);
	if (farmer.task === "resting") ctx.globalAlpha = 0.5;

	// Feet: one ahead, one behind, swapping every few steps while walking.
	const stride = walking ? Math.sin(farmer.walked * 0.5) * 5 : 0;
	ctx.fillStyle = colors.hat;
	for (const [x, y] of [
		[stride, -6],
		[-stride, 6],
	]) {
		ctx.beginPath();
		ctx.arc(x, y, 2.2, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.fillStyle = colors.hat;
	ctx.beginPath();
	ctx.arc(0, 0, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = colors.farmer;
	ctx.beginPath();
	ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
	ctx.fill();

	if (farmer.task === "toSpot") {
		ctx.fillStyle = colors.green;
		ctx.fillRect(7, -2, 7, 4);
	}
	ctx.restore();

	if (farmer.task === "cutting") {
		const done = 1 - farmer.timer / rules.graftDays;
		ctx.fillStyle = colors.green;
		ctx.beginPath();
		ctx.moveTo(farmer.x, farmer.y - 14);
		ctx.arc(
			farmer.x,
			farmer.y - 14,
			5,
			-Math.PI / 2,
			-Math.PI / 2 + done * Math.PI * 2,
		);
		ctx.fill();
	}
	if (farmer.task === "resting") {
		ctx.fillStyle = colors.hat;
		ctx.font = "10px monospace";
		ctx.fillText("z", farmer.x + 7, farmer.y - 7);
	}
}

// A fresh farmer graft: a pale disc that grows and fades over 20 days.
function drawGraftPulses(ctx: CanvasRenderingContext2D, farm: Farm) {
	for (const entry of farm.graftLog) {
		const t = (farm.day - entry.day) / 20;
		ctx.globalAlpha = 0.35 * (1 - t);
		ctx.fillStyle = settings.colors.green;
		ctx.beginPath();
		ctx.arc(entry.x, entry.y, 8 + t * 30, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
}

function drawTree(ctx: CanvasRenderingContext2D, tree: Tree) {
	const r = RADIUS[tree.stage];
	const { colors } = settings;
	const variety = traitsOf(tree);
	if (tree.stage === "seed") {
		ctx.fillStyle = colors.seed;
		ctx.beginPath();
		ctx.arc(tree.x, tree.y, r, 0, Math.PI * 2);
		ctx.fill();
		return;
	}
	ctx.fillStyle = tree.stage === "senescent" ? colors.oldLeaf : variety.leaf;
	ctx.fill(new Path2D(canopyPath(tree.x, tree.y, r, variety.lobes)));

	tree.fruits.forEach((fruit, i) => {
		const angle = (i / tree.fruits.length) * Math.PI * 2;
		const reach = fruit.stage === "fallen" ? r + 8 : r * 0.6;
		ctx.fillStyle = fruit.stage === "ripe" ? variety.ripe : colors[fruit.stage];
		ctx.beginPath();
		ctx.arc(
			tree.x + Math.cos(angle) * reach,
			tree.y + Math.sin(angle) * reach,
			3.5,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	});
}

function draw(
	ctx: CanvasRenderingContext2D,
	farm: Farm,
	selectedId: number | null,
) {
	// Lines from each tree to the tree it came from: solid for seed, dashed for graft.
	ctx.lineWidth = 1;
	for (const tree of farm.trees) {
		const parent = farm.trees.find((other) => other.id === tree.parentId);
		if (!parent) continue;
		ctx.globalAlpha = 0.4;
		ctx.strokeStyle = settings.colors.link;
		ctx.setLineDash(tree.origin === "graft" ? [4, 4] : []);
		ctx.beginPath();
		ctx.moveTo(parent.x, parent.y);
		ctx.lineTo(tree.x, tree.y);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);

	// Multiply: overlapping canopies and pulses mix like overprinted ink.
	ctx.globalCompositeOperation = "multiply";
	drawGraftPulses(ctx, farm);
	for (const tree of farm.trees) drawTree(ctx, tree);
	ctx.globalCompositeOperation = "source-over";
	for (const farmer of farm.farmers) drawFarmer(ctx, farm, farmer);

	const selected = farm.trees.find((tree) => tree.id === selectedId);
	if (selected) {
		ctx.strokeStyle = settings.colors.link;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(selected.x, selected.y, RADIUS[selected.stage] + 6, 0, Math.PI * 2);
		ctx.stroke();
	}
}

export default function MangoFarm() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const farmRef = useRef<Farm>(createFarm());
	const selectedRef = useRef<number | null>(null);
	const speedRef = useRef(1);
	const pausedRef = useRef(false);
	const [speed, setSpeed] = useState(1);
	const [paused, setPaused] = useState(false);
	const [info, setInfo] = useState("");
	const [counts, setCounts] = useState<Record<string, number>>({});
	const [selectedInfo, setSelectedInfo] = useState("");
	const [adminOpen, setAdminOpen] = useState(false);

	// Press A to show or hide the admin panel.
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (event.key === "a") setAdminOpen((open) => !open);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;

		// The farm is scaled to fit the window and centred; the soil colour fills the rest.
		let scale = 1;
		let offsetX = 0;
		let offsetY = 0;
		function resize() {
			if (!canvas) return;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
			offsetX = (window.innerWidth - WIDTH * scale) / 2;
			offsetY = (window.innerHeight - HEIGHT * scale) / 2;
			ctx?.setTransform(
				dpr * scale,
				0,
				0,
				dpr * scale,
				dpr * offsetX,
				dpr * offsetY,
			);
		}
		resize();
		window.addEventListener("resize", resize);

		function onClick(event: MouseEvent) {
			const farm = farmRef.current;
			const x = (event.clientX - offsetX) / scale;
			const y = (event.clientY - offsetY) / scale;
			const hit = farm.trees.find(
				(tree) => Math.hypot(tree.x - x, tree.y - y) < RADIUS[tree.stage] + 4,
			);
			if (hit) {
				const grown = hit.stage === "mature" || hit.stage === "fruiting";
				selectedRef.current =
					grown && hit.id !== selectedRef.current ? hit.id : null;
			} else if (selectedRef.current !== null) {
				graft(farm, selectedRef.current, x, y);
				selectedRef.current = null;
			} else {
				plant(farm, x, y);
			}
		}
		canvas.addEventListener("click", onClick);

		let last = performance.now();
		let frame = 0;
		function loop(now: number) {
			const dt = Math.min((now - last) / 1000, 0.1);
			last = now;
			const farm = farmRef.current;
			if (!pausedRef.current)
				step(farm, dt * settings.rules.daysPerSecond * speedRef.current);

			ctx?.save();
			ctx?.setTransform(1, 0, 0, 1, 0, 0);
			ctx!.fillStyle = settings.colors.soil;
			ctx?.fillRect(0, 0, canvas!.width, canvas!.height);
			ctx?.restore();
			draw(ctx!, farm, selectedRef.current);

			const s = stats(farm);
			const t = s.trees;
			setInfo(
				`day ${s.day} · seeds ${t.seed} · seedlings ${t.seedling} · saplings ${t.sapling} · mature ${t.mature} · fruiting ${t.fruiting} · senescent ${t.senescent} · harvested ${s.harvested} · farmer grafts ${s.grafts} · farmers ${farm.farmers.map((f) => TASK_NAMES[f.task]).join(", ")}`,
			);
			setCounts(s.varieties);
			const selected = farm.trees.find(
				(tree) => tree.id === selectedRef.current,
			);
			const traits = selected && traitsOf(selected);
			setSelectedInfo(
				selected && traits
					? `selected: ${selected.variety} · fruit ${traits.fruit} · growth ${traits.growth} · ripen ${traits.ripenDays} d · ${traits.alternate ? "alternate bearing" : "steady"} · ${traits.trueSeed ? "true seed" : "seeds vary"}`
					: "",
			);
			frame = requestAnimationFrame(loop);
		}
		frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", resize);
			canvas.removeEventListener("click", onClick);
		};
	}, []);

	return (
		<main className={styles.container}>
			<canvas ref={canvasRef} className={styles.canvas} />
			<div className={styles.panel}>
				{selectedInfo && <div>{selectedInfo}</div>}
				<div>{info}</div>
				<div className={styles.legend}>
					{VARIETIES.map((name) => (
						<span key={name}>
							<svg viewBox="-8 -8 16 16">
								<path
									d={canopyPath(0, 0, 8, settings.varieties[name].lobes)}
									fill={settings.varieties[name].leaf}
								/>
							</svg>
							{name} {counts[name] ?? 0}
						</span>
					))}
					<span>
						<svg viewBox="-8 -8 16 16">
							<path d={canopyPath(0, 0, 8, 4)} fill={settings.colors.oldLeaf} />
						</svg>
						seedlings {counts.seedlings ?? 0}
					</span>
				</div>
				<div className={styles.controls}>
					<button
						onClick={() => {
							pausedRef.current = !paused;
							setPaused(!paused);
						}}
					>
						{paused ? "play" : "pause"}
					</button>
					{SPEEDS.map((value) => (
						<button
							key={value}
							className={value === speed ? styles.active : undefined}
							onClick={() => {
								speedRef.current = value;
								setSpeed(value);
							}}
						>
							{value}×
						</button>
					))}
					<button onClick={() => setAdminOpen(!adminOpen)}>admin (A)</button>
					<span>click ground: plant · click tree then ground: graft</span>
				</div>
			</div>
			{adminOpen && (
				<AdminPanel
					onRestart={() => {
						farmRef.current = createFarm();
						selectedRef.current = null;
					}}
				/>
			)}
		</main>
	);
}
