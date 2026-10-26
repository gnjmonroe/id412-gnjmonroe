"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import data from "../json/crucifers.json";
import { buildGraph, type SigNode } from "../signature";
import styles from "./page.module.css";

// The crucifer lineage rebuilt from genome signatures only (see ../signature.ts), drawn as a radial
// tree: the family's first genome event in the centre, one ring per genome change outward.
// Every named entry gets its own slot on the outer ring, so no labels overlap. Joins (hybrids and
// crosses) are dashed curves. Drag to move, scroll to zoom, hover to see a path and its signature.

const PAPER = "#efece4";
const INK = "#1d1d1b";
const JOIN = "#ff4f1f";
const HIGHLIGHT = "#e6007e";
const RING = 48; // distance between rings
const HEADER = 70;

const graph = buildGraph(
	data.nodes.map((n) => ({ name: n.name, signature: n.genome.signature })),
);
const nodes = [...graph.values()];
const root = nodes.find((n) => n.parents.length === 0)!;

// Layout tree: each node under its first parent.
const children = new Map<string, SigNode[]>();
for (const n of nodes)
	if (n.parents.length)
		children.set(n.parents[0], [...(children.get(n.parents[0]) ?? []), n]);

// Slots on the outer ring, in depth-first order: one per named node, so every entry is labelled.
const slots: SigNode[] = [];
const angle = new Map<string, number>();
function place(n: SigNode): [number, number] {
	let first = Infinity;
	let last = -Infinity;
	if (n.names.length) {
		first = last = slots.length;
		slots.push(n);
	}
	for (const kid of children.get(n.key) ?? []) {
		const [a, b] = place(kid);
		first = Math.min(first, a);
		last = Math.max(last, b);
	}
	angle.set(n.key, (first + last) / 2); // in slot units for now
	return [first, last];
}
place(root);
for (const [key, slot] of angle)
	angle.set(key, (slot / slots.length) * Math.PI * 2 - Math.PI / 2);
const slotAngle = (i: number) => (i / slots.length) * Math.PI * 2 - Math.PI / 2;

const maxDepth = Math.max(...nodes.map((n) => n.depth));
const OUTER = (maxDepth + 1.5) * RING; // radius of the label ring
const radius = (n: SigNode) => n.depth * RING;
const pos = (n: SigNode) => ({
	x: Math.cos(angle.get(n.key)!) * radius(n),
	y: Math.sin(angle.get(n.key)!) * radius(n),
});

function labelOf(n: SigNode) {
	return n.names.length > 2
		? `${n.names[0]} (= ${n.names.length - 1} more)`
		: n.names.join(" = ");
}

// Every node on the way back to the root, through both parents at a join.
function ancestors(key: string, out = new Set<string>()) {
	if (out.has(key)) return out;
	out.add(key);
	for (const p of graph.get(key)!.parents) ancestors(p, out);
	return out;
}

type View = { x: number; y: number; scale: number };

function draw(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	view: View,
	hover: SigNode | null,
) {
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const dpr = window.devicePixelRatio || 1;
	ctx.scale(dpr, dpr);
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, height);

	const lit = hover ? ancestors(hover.key) : new Set<string>();
	ctx.save();
	ctx.translate(view.x, view.y);
	ctx.scale(view.scale, view.scale);

	// Rings: one per genome change
	ctx.strokeStyle = INK;
	ctx.globalAlpha = 0.06;
	ctx.lineWidth = 1 / view.scale;
	for (let d = 1; d <= maxDepth; d++) {
		ctx.beginPath();
		ctx.arc(0, 0, d * RING, 0, Math.PI * 2);
		ctx.stroke();
	}

	// Branches to the first parent: along the parent's ring, then straight out.
	for (const n of nodes) {
		if (!n.parents.length) continue;
		const parent = graph.get(n.parents[0])!;
		const on = lit.has(n.key) && lit.has(parent.key);
		ctx.strokeStyle = on ? HIGHLIGHT : INK;
		ctx.globalAlpha = on ? 1 : 0.35;
		ctx.lineWidth = (on ? 2.5 : 1) / view.scale;
		const a1 = angle.get(parent.key)!;
		const a2 = angle.get(n.key)!;
		const r1 = radius(parent);
		ctx.beginPath();
		if (r1 > 0) ctx.arc(0, 0, r1, a1, a2, a2 < a1);
		else ctx.moveTo(0, 0);
		ctx.lineTo(Math.cos(a2) * radius(n), Math.sin(a2) * radius(n));
		ctx.stroke();
	}

	// Second parents at joins: dashed curves
	ctx.setLineDash([5 / view.scale, 4 / view.scale]);
	for (const n of nodes) {
		for (const p of n.parents.slice(1)) {
			const parent = graph.get(p)!;
			const on = lit.has(n.key) && lit.has(p);
			ctx.strokeStyle = on ? HIGHLIGHT : JOIN;
			ctx.globalAlpha = on ? 1 : 0.8;
			ctx.lineWidth = (on ? 2.5 : 1.5) / view.scale;
			const a = pos(parent);
			const b = pos(n);
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.quadraticCurveTo(0, 0, b.x, b.y); // bends toward the centre, away from the labels
			ctx.stroke();
		}
	}
	ctx.setLineDash([]);

	// Leaders from each named node out to its slot, then the label along the radius.
	ctx.font = `${12 / Math.max(view.scale, 0.6)}px ui-monospace, Menlo, monospace`;
	ctx.textBaseline = "middle";
	slots.forEach((n, i) => {
		const a = slotAngle(i);
		const p = pos(n);
		const on = lit.has(n.key);
		ctx.strokeStyle = on ? HIGHLIGHT : INK;
		ctx.globalAlpha = on ? 0.9 : 0.15;
		ctx.lineWidth = 1 / view.scale;
		ctx.setLineDash([2 / view.scale, 3 / view.scale]);
		ctx.beginPath();
		ctx.moveTo(p.x, p.y);
		ctx.lineTo(Math.cos(a) * OUTER, Math.sin(a) * OUTER);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.save();
		ctx.translate(Math.cos(a) * (OUTER + 6), Math.sin(a) * (OUTER + 6));
		const flip = Math.cos(a) < 0; // keep text upright on the left half
		ctx.rotate(flip ? a + Math.PI : a);
		ctx.textAlign = flip ? "right" : "left";
		ctx.globalAlpha = 1;
		ctx.fillStyle = on ? HIGHLIGHT : INK;
		ctx.fillText(labelOf(n), 0, 0);
		ctx.restore();
	});

	// Nodes, then their tags (the genome change that happens there). Tags are placed greedily:
	// the highlighted path first, then from the centre outward; a tag that would overlap one
	// already placed is skipped (it appears when you zoom in).
	for (const n of nodes) {
		const p = pos(n);
		ctx.globalAlpha = 1;
		ctx.fillStyle = lit.has(n.key)
			? HIGHLIGHT
			: n.parents.length > 1
				? JOIN
				: INK;
		ctx.beginPath();
		ctx.arc(p.x, p.y, (n.names.length ? 4 : 2.5) / view.scale, 0, Math.PI * 2);
		ctx.fill();
	}
	const fontSize = 10 / Math.max(view.scale, 0.6);
	ctx.font = `${fontSize}px ui-monospace, Menlo, monospace`;
	ctx.textAlign = "left";
	const placed: { x: number; y: number; w: number; h: number }[] = [];
	const order = [...nodes].sort(
		(a, b) =>
			Number(lit.has(b.key)) - Number(lit.has(a.key)) || a.depth - b.depth,
	);
	for (const n of order) {
		const p = pos(n);
		const box = {
			x: p.x + 6 / view.scale,
			y: p.y - 7 / view.scale - fontSize / 2,
			w: ctx.measureText(n.tag).width,
			h: fontSize,
		};
		const overlaps = placed.some(
			(o) =>
				box.x < o.x + o.w &&
				o.x < box.x + box.w &&
				box.y < o.y + o.h &&
				o.y < box.y + box.h,
		);
		if (overlaps && !lit.has(n.key)) continue;
		placed.push(box);
		ctx.fillStyle = lit.has(n.key) ? HIGHLIGHT : "rgba(29, 29, 27, 0.75)";
		ctx.fillText(n.tag, box.x, p.y - 7 / view.scale);
	}
	ctx.restore();

	// Fixed header
	ctx.globalAlpha = 1;
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, HEADER);
	ctx.fillStyle = INK;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.font = "14px ui-monospace, Menlo, monospace";
	ctx.fillText("Crucifer lineage from genome signatures only", 20, 20);
	ctx.font = "11px ui-monospace, Menlo, monospace";
	if (hover) {
		ctx.fillStyle = HIGHLIGHT;
		ctx.fillText(hover.names.join(" = ") || hover.tag, 20, 40);
		ctx.fillStyle = INK;
		ctx.fillText(hover.key, 20, 56);
	} else {
		ctx.fillStyle = "rgba(29, 29, 27, 0.6)";
		ctx.fillText(
			"centre: family root · one ring per genome change · dashed: hybrid or cross",
			20,
			40,
		);
		ctx.fillText(
			"hover a name or dot to trace its path · drag to move · scroll to zoom",
			20,
			56,
		);
	}
}

export default function SignatureTree() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;

		let width = 0;
		let height = 0;
		const view: View = { x: 0, y: 0, scale: 1 };
		let hover: SigNode | null = null;
		const redraw = () => draw(ctx, width, height, view, hover);

		// Fit the whole ring, labels included, below the header.
		function fit() {
			const size = (OUTER + 230) * 2;
			view.scale = Math.min(width / size, (height - HEADER) / size);
			view.x = width / 2;
			view.y = HEADER + (height - HEADER) / 2;
		}
		function resize() {
			const dpr = window.devicePixelRatio || 1;
			width = window.innerWidth;
			height = window.innerHeight;
			canvas!.width = width * dpr;
			canvas!.height = height * dpr;
			fit();
			redraw();
		}

		// What is under the pointer: a node dot, or a label slot on the outer ring.
		function pick(clientX: number, clientY: number) {
			const x = (clientX - view.x) / view.scale;
			const y = (clientY - view.y) / view.scale;
			for (const n of nodes) {
				const p = pos(n);
				if (Math.hypot(p.x - x, p.y - y) < 8 / view.scale) return n;
			}
			if (Math.hypot(x, y) < OUTER - RING / 2) return null;
			let a = Math.atan2(y, x) + Math.PI / 2;
			if (a < 0) a += Math.PI * 2;
			return slots[
				Math.round((a / (Math.PI * 2)) * slots.length) % slots.length
			];
		}

		let dragging = false;
		let lastX = 0;
		let lastY = 0;
		function onDown(event: PointerEvent) {
			dragging = true;
			lastX = event.clientX;
			lastY = event.clientY;
			canvas!.setPointerCapture(event.pointerId);
		}
		function onMove(event: PointerEvent) {
			if (dragging) {
				view.x += event.clientX - lastX;
				view.y += event.clientY - lastY;
				lastX = event.clientX;
				lastY = event.clientY;
			} else {
				hover = pick(event.clientX, event.clientY);
			}
			redraw();
		}
		function onUp() {
			dragging = false;
		}
		// Zoom around the pointer
		function onWheel(event: WheelEvent) {
			event.preventDefault();
			const factor = Math.exp(-event.deltaY * 0.0015);
			const scale = Math.min(4, Math.max(0.2, view.scale * factor));
			view.x = event.clientX - ((event.clientX - view.x) * scale) / view.scale;
			view.y = event.clientY - ((event.clientY - view.y) * scale) / view.scale;
			view.scale = scale;
			redraw();
		}

		resize();
		window.addEventListener("resize", resize);
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);
		canvas.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			window.removeEventListener("resize", resize);
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
			canvas.removeEventListener("wheel", onWheel);
		};
	}, []);

	return (
		<main className={styles.container}>
			<canvas ref={canvasRef} className={styles.canvas} />
			<Link className={styles.link} href="/experiments/w1/brassicaceae">
				← outline view
			</Link>
		</main>
	);
}
