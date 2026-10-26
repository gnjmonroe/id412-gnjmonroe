"use client";

import { useEffect, useRef, useState } from "react";
import {
	createFarm,
	graft,
	plant,
	step,
	stats,
	type Farm,
	type Tree,
} from "./farm";
import styles from "./page.module.css";
import { AdminPanel } from "./AdminPanel";
import { HEIGHT, settings, VARIETIES, WIDTH } from "./settings";

// The mango farm from farm.ts, drawn top-down on a canvas.
// Click empty ground to plant a seed. Click a grown tree, then empty ground, to graft a copy.

const SPEEDS = [1, 4, 16];
const RADIUS = {
	seed: 3,
	seedling: 6,
	sapling: 11,
	mature: 20,
	fruiting: 22,
	senescent: 18,
};

// Canopy outline: a circle, or a wavy shape with `lobes` bumps.
function canopy(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	lobes: number,
) {
	ctx.beginPath();
	if (lobes < 1) {
		ctx.arc(x, y, r, 0, Math.PI * 2);
		return;
	}
	for (let i = 0; i <= 60; i++) {
		const angle = (i / 60) * Math.PI * 2;
		const radius = r * (0.85 + 0.15 * Math.cos(angle * lobes));
		ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
	}
	ctx.closePath();
}

function drawTree(ctx: CanvasRenderingContext2D, tree: Tree) {
	const r = RADIUS[tree.stage];
	const { colors } = settings;
	const variety = settings.varieties[tree.variety];
	if (tree.stage === "seed") {
		ctx.fillStyle = colors.seed;
		ctx.beginPath();
		ctx.arc(tree.x, tree.y, r, 0, Math.PI * 2);
		ctx.fill();
		return;
	}
	ctx.fillStyle = tree.stage === "senescent" ? colors.oldLeaf : variety.leaf;
	canopy(ctx, tree.x, tree.y, r, variety.lobes);
	ctx.fill();
	// A ring in the ripe colour shows the variety even when the tree has no fruit.
	ctx.strokeStyle = variety.ripe;
	ctx.lineWidth = 1.5;
	ctx.stroke();

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

	for (const tree of farm.trees) drawTree(ctx, tree);

	const selected = farm.trees.find((tree) => tree.id === selectedId);
	if (selected) {
		ctx.strokeStyle = "white";
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
				`day ${s.day} · seeds ${t.seed} · seedlings ${t.seedling} · saplings ${t.sapling} · mature ${t.mature} · fruiting ${t.fruiting} · senescent ${t.senescent} · harvested ${s.harvested}`,
			);
			setCounts(s.varieties);
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
				<div>{info}</div>
				<div className={styles.legend}>
					{VARIETIES.map((name) => (
						<span key={name}>
							<i
								style={{
									background: settings.varieties[name].leaf,
									borderColor: settings.varieties[name].ripe,
								}}
							/>
							{name} {counts[name] ?? 0}
						</span>
					))}
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
