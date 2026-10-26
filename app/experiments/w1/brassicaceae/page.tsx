"use client";

import { useEffect, useRef } from "react";
import data from "./json/crucifers.json";
import styles from "./page.module.css";

// The ancestry of the cruciferous vegetables from json/crucifers.json, drawn as an outline tree:
// the family at the top left, each node on its own row, indented one column per step of descent.
// Because every label sits alone on its row, no two labels can overlap. The tree is bigger than
// the screen: drag (or scroll) to move around it. Second parents of hybrids and crosses are drawn
// as extra coloured curves.

type Node = { id: string; kind: string; name: string; common?: string };
type Edge = { from: string; to: string; type: string };

const nodes = data.nodes as Node[];
const edges = data.edges as Edge[];

const KIND_COLOR: Record<string, string> = {
	clade: "#1d1d1b",
	species: "#1f3fd1",
	"crop-lineage": "#e6007e",
	vegetable: "#00a651",
};
const EDGE_COLOR: Record<string, string> = {
	"hybrid-parent": "#ff4f1f",
	cross: "#00a0e0",
};
const PAPER = "#efece4";
const INK = "#1d1d1b";
const FONT = "12px ui-monospace, Menlo, monospace";

const ROW = 26; // height of one row
const INDENT = 34; // width of one step of descent
const MARGIN = 40; // space around the tree
const HEADER = 64; // fixed title and legend at the top of the screen

// The main parent of each node: its first descent, domestication or selection edge. Hybrid species
// and crosses have none, so they hang under their first hybrid or cross parent instead.
const TREE_TYPES = ["descent", "domestication", "selection"];
const mainParent: Record<string, string> = {};
for (const e of edges)
	if (TREE_TYPES.includes(e.type) && !mainParent[e.to])
		mainParent[e.to] = e.from;
for (const e of edges) if (!mainParent[e.to]) mainParent[e.to] = e.from;

const children: Record<string, string[]> = {};
for (const n of nodes)
	if (mainParent[n.id]) (children[mainParent[n.id]] ??= []).push(n.id);

// Outline layout: walk the tree depth first; each node takes the next row, its depth is its column.
const depth: Record<string, number> = {};
const row: Record<string, number> = {};
let rows = 0;
function place(id: string, d: number) {
	depth[id] = d;
	row[id] = rows++;
	for (const kid of children[id] ?? []) place(kid, d + 1);
}
place(data.root, 0);

// Tree coordinates of a node's dot
const nodeX = (id: string) => MARGIN + depth[id] * INDENT;
const nodeY = (id: string) => HEADER + MARGIN + row[id] * ROW;

function label(n: Node) {
	return n.kind === "species" && n.common ? `${n.name} (${n.common})` : n.name;
}

// Size of the whole tree, measured once with the label font.
function treeSize(ctx: CanvasRenderingContext2D) {
	ctx.font = FONT;
	let width = 0;
	for (const n of nodes)
		width = Math.max(width, nodeX(n.id) + 12 + ctx.measureText(label(n)).width);
	return {
		width: width + MARGIN,
		height: nodeY(nodes[0].id) + rows * ROW + MARGIN,
	};
}

function draw(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	panX: number,
	panY: number,
) {
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, height);

	ctx.save();
	ctx.translate(-panX, -panY);

	// Main tree: elbow lines from parent down and across to each child.
	ctx.strokeStyle = INK;
	ctx.globalAlpha = 0.3;
	ctx.lineWidth = 1;
	for (const n of nodes) {
		const parent = mainParent[n.id];
		if (!parent) continue;
		ctx.beginPath();
		ctx.moveTo(nodeX(parent), nodeY(parent));
		ctx.lineTo(nodeX(parent), nodeY(n.id));
		ctx.lineTo(nodeX(n.id), nodeY(n.id));
		ctx.stroke();
	}

	// Second parents: coloured dashed curves, bowing out to the left of the tree.
	ctx.globalAlpha = 0.85;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([4, 3]);
	for (const e of edges) {
		if (mainParent[e.to] === e.from) continue;
		const x1 = nodeX(e.from);
		const y1 = nodeY(e.from);
		const x2 = nodeX(e.to);
		const y2 = nodeY(e.to);
		const bow = Math.min(x1, x2) - 20 - Math.abs(y2 - y1) * 0.08;
		ctx.strokeStyle = EDGE_COLOR[e.type] ?? INK;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.bezierCurveTo(bow, y1, bow, y2, x2, y2);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);

	// Dots and labels, one per row. A paper band behind each label keeps lines from crossing text.
	ctx.font = FONT;
	ctx.textBaseline = "middle";
	for (const n of nodes) {
		const x = nodeX(n.id);
		const y = nodeY(n.id);
		const text = label(n);
		ctx.fillStyle = PAPER;
		ctx.fillRect(x + 8, y - 8, ctx.measureText(text).width + 6, 16);
		ctx.fillStyle = KIND_COLOR[n.kind] ?? INK;
		ctx.beginPath();
		ctx.arc(x, y, n.kind === "vegetable" ? 4.5 : 3.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = n.kind === "clade" ? "rgba(29, 29, 27, 0.6)" : INK;
		ctx.fillText(text, x + 11, y);
	}
	ctx.restore();

	// Fixed header: title, legend and a hint, on paper so the tree slides underneath.
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, HEADER);
	ctx.fillStyle = INK;
	ctx.font = "14px ui-monospace, Menlo, monospace";
	ctx.textBaseline = "middle";
	ctx.fillText("Cruciferous vegetables: ancestry", MARGIN, 20);
	ctx.font = "11px ui-monospace, Menlo, monospace";
	const legend: [string, string, boolean][] = [
		["clade", KIND_COLOR.clade, false],
		["species", KIND_COLOR.species, false],
		["crop lineage", KIND_COLOR["crop-lineage"], false],
		["vegetable", KIND_COLOR.vegetable, false],
		["hybrid parent", EDGE_COLOR["hybrid-parent"], true],
		["cross parent", EDGE_COLOR.cross, true],
	];
	let lx = MARGIN;
	for (const [name, color, isLine] of legend) {
		ctx.fillStyle = color;
		ctx.strokeStyle = color;
		if (isLine) {
			ctx.setLineDash([4, 3]);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(lx, 44);
			ctx.lineTo(lx + 16, 44);
			ctx.stroke();
			ctx.setLineDash([]);
		} else {
			ctx.beginPath();
			ctx.arc(lx + 8, 44, 4, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = INK;
		ctx.fillText(name, lx + 22, 44);
		lx += 22 + ctx.measureText(name).width + 20;
	}
	ctx.fillStyle = "rgba(29, 29, 27, 0.5)";
	ctx.fillText("drag or scroll to move", lx + 10, 44);
}

export default function Brassicaceae() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;

		const tree = treeSize(ctx);
		let width = 0;
		let height = 0;
		let panX = 0;
		let panY = 0;

		// Keep the view inside the tree (no panning past its edges).
		function clamp() {
			panX = Math.max(0, Math.min(panX, tree.width - width));
			panY = Math.max(0, Math.min(panY, tree.height - height));
		}
		function redraw() {
			draw(ctx!, width, height, panX, panY);
		}
		function resize() {
			const dpr = window.devicePixelRatio || 1;
			width = window.innerWidth;
			height = window.innerHeight;
			canvas!.width = width * dpr;
			canvas!.height = height * dpr;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			clamp();
			redraw();
		}

		// Click and drag to move the view
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
			if (!dragging) return;
			panX -= event.clientX - lastX;
			panY -= event.clientY - lastY;
			lastX = event.clientX;
			lastY = event.clientY;
			clamp();
			redraw();
		}
		function onUp() {
			dragging = false;
		}
		// Scroll wheel or trackpad moves the view too
		function onWheel(event: WheelEvent) {
			event.preventDefault();
			panX += event.deltaX;
			panY += event.deltaY;
			clamp();
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
		</main>
	);
}
