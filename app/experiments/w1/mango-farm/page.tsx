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
import { CULTIVARS, DAYS_PER_SECOND, HEIGHT, WIDTH } from "./settings";

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
const FRUIT_COLOR = { flower: "#f7b6d2", green: "#9bc53d", fallen: "#8a5a2b" };

function drawTree(ctx: CanvasRenderingContext2D, tree: Tree) {
	const r = RADIUS[tree.stage];
	if (tree.stage === "seed") {
		ctx.fillStyle = "#5b3a1e";
	} else {
		ctx.fillStyle = tree.stage === "senescent" ? "#8a7a4a" : "#2f7d32";
	}
	ctx.beginPath();
	ctx.arc(tree.x, tree.y, r, 0, Math.PI * 2);
	ctx.fill();

	tree.fruits.forEach((fruit, i) => {
		const angle = (i / tree.fruits.length) * Math.PI * 2;
		const reach = fruit.stage === "fallen" ? r + 8 : r * 0.6;
		ctx.fillStyle =
			fruit.stage === "ripe"
				? CULTIVARS[tree.cultivar].ripe
				: FRUIT_COLOR[fruit.stage];
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
		ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
		ctx.setLineDash(tree.origin === "graft" ? [4, 4] : []);
		ctx.beginPath();
		ctx.moveTo(parent.x, parent.y);
		ctx.lineTo(tree.x, tree.y);
		ctx.stroke();
	}
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
				step(farm, dt * DAYS_PER_SECOND * speedRef.current);

			ctx?.save();
			ctx?.setTransform(1, 0, 0, 1, 0, 0);
			ctx!.fillStyle = "#6b4f33";
			ctx?.fillRect(0, 0, canvas!.width, canvas!.height);
			ctx?.restore();
			draw(ctx!, farm, selectedRef.current);

			const s = stats(farm);
			const t = s.trees;
			setInfo(
				`day ${s.day} · seeds ${t.seed} · seedlings ${t.seedling} · saplings ${t.sapling} · mature ${t.mature} · fruiting ${t.fruiting} · senescent ${t.senescent} · harvested ${s.harvested}`,
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
				<div>{info}</div>
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
					<span>click ground: plant · click tree then ground: graft</span>
				</div>
			</div>
		</main>
	);
}
