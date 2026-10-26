"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import data from "../json/graph.json";
import photos from "../json/images.json";
import styles from "./page.module.css";

// Walk the lineage one step at a time, starting from Brassicaceae (../json/graph.json).
// Click a card: it moves up, joining the cards clicked before it, and its immediate
// descendants appear centred below it, joined by lines. Leaves (the ends of a line)
// are shown large, with a button back to the start.

type Entry = {
	id: string;
	name: string;
	signature: string;
	image: string | null;
	alsoFrom?: string[];
	children?: Entry[];
};

const root: Entry = data.root;
// the size of each photo file on disk, so it is shown at its original size
const sizes: Record<string, { width: number; height: number }> = photos.images;

function Card({ entry, large }: { entry: Entry; large?: boolean }) {
	return (
		<>
			{entry.image && (
				<NextImage
					className={styles.photo}
					src={entry.image}
					alt={entry.name}
					width={sizes[entry.id].width}
					height={sizes[entry.id].height}
					unoptimized
				/>
			)}
			<h2>{entry.name}</h2>
			<p className={styles.signature}>{entry.signature}</p>
			{large && entry.alsoFrom && (
				<p className={styles.signature}>
					also from: {entry.alsoFrom.join(", ")}
				</p>
			)}
		</>
	);
}

export default function Page() {
	// The cards clicked so far, from Brassicaceae down. Empty: only the Brassicaceae card.
	const [path, setPath] = useState<Entry[]>([]);
	const layout = useRef<HTMLDivElement>(null);
	const lines = useRef<SVGPathElement>(null);
	const middle = useRef<HTMLDivElement>(null);

	const last = path[path.length - 1];
	const shown = last ? last.children! : [root];
	const hasLeaf = shown.some((entry) => !entry.children);

	// Lines join each clicked card to the one below it, and the last one to every centred card.
	// They are measured from where the cards really are, so redraw whenever any card changes size
	// (a photo loading, the window resizing, new cards).
	useEffect(() => {
		const box = layout.current!;
		function draw() {
			const origin = box.getBoundingClientRect();
			const rect = (el: Element) => {
				const r = el.getBoundingClientRect();
				return {
					x: r.left + r.width / 2 - origin.left,
					top: r.top - origin.top,
					bottom: r.bottom - origin.top,
				};
			};
			const past = [...box.querySelectorAll("[data-past]")].map(rect);
			const now = [...box.querySelectorAll("[data-now]")].map(rect);
			let d = "";
			for (let i = 1; i < past.length; i++)
				d += `M${past[i - 1].x},${past[i - 1].bottom}L${past[i].x},${past[i].top}`;
			const above = past[past.length - 1];
			if (above)
				for (const card of now)
					d += `M${above.x},${above.bottom}L${card.x},${card.top}`;
			lines.current!.setAttribute("d", d);
			// keep the current cards in the middle of the screen; scroll up to see the whole path
			middle.current!.scrollIntoView({ block: "center", inline: "nearest" });
		}
		const observer = new ResizeObserver(draw);
		observer.observe(box);
		for (const card of box.querySelectorAll("[data-past], [data-now]"))
			observer.observe(card);
		return () => observer.disconnect();
	}); // after every render: a click brings new cards to measure

	return (
		<main className={styles.container}>
			<Link className={styles.link} href="/experiments/w1/brassicaceae">
				outline view
			</Link>

			<div ref={layout} className={styles.layout}>
				<svg className={styles.lines}>
					<path ref={lines} />
				</svg>

				{/* top band: the cards clicked so far, the last one nearest the centre */}
				<div className={styles.past}>
					{path.map((entry) => (
						<div key={entry.id} data-past className={styles.card}>
							<Card entry={entry} />
						</div>
					))}
				</div>

				{/* middle band, vertically centred: the immediate descendants */}
				<div ref={middle} className={styles.cards}>
					{shown.map((entry) =>
						// a leaf (no descendants) is shown large and is not clickable
						entry.children ? (
							<button
								key={entry.id}
								data-now
								className={styles.card}
								onClick={() => setPath([...path, entry])}
							>
								<Card entry={entry} />
							</button>
						) : (
							<div
								key={entry.id}
								data-now
								className={`${styles.card} ${styles.large}`}
							>
								<Card entry={entry} large />
							</div>
						),
					)}
				</div>

				{/* bottom band */}
				<div className={styles.below}>
					{hasLeaf && (
						<button className={styles.back} onClick={() => setPath([])}>
							back to Brassicaceae
						</button>
					)}
				</div>
			</div>
		</main>
	);
}
