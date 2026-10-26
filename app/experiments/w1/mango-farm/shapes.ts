// Canopy outlines as SVG paths. The canvas draws them with Path2D and the legend with <svg>,
// so both look the same. `shape` picks the kind of outline, `lobes` how many points or bumps.

export const SHAPES = [
	"round",
	"soft lobes",
	"star",
	"polygon",
	"petals",
	"rounded square",
];

export function canopyPath(
	x: number,
	y: number,
	r: number,
	shape: number,
	lobes: number,
) {
	const n = Math.max(3, Math.round(lobes));
	const points: [number, number][] = [];

	if (SHAPES[shape] === "star") {
		// Sharp points: corners alternate between the full radius and half of it.
		for (let i = 0; i < n * 2; i++) {
			const angle = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
			points.push([angle, i % 2 === 0 ? r : r * 0.45]);
		}
	} else if (SHAPES[shape] === "polygon") {
		// Straight edges between `lobes` corners.
		for (let i = 0; i < n; i++)
			points.push([(i / n) * Math.PI * 2 - Math.PI / 2, r]);
	} else {
		// Smooth outlines: the radius changes with the angle.
		for (let i = 0; i < 90; i++) {
			const angle = (i / 90) * Math.PI * 2;
			let radius = r; // round
			if (SHAPES[shape] === "soft lobes")
				radius = r * (0.8 + 0.2 * Math.cos(angle * n));
			if (SHAPES[shape] === "petals")
				radius = r * (0.3 + 0.7 * Math.abs(Math.cos((angle * n) / 2)));
			if (SHAPES[shape] === "rounded square") {
				const c =
					Math.abs(Math.cos(angle)) ** 4 + Math.abs(Math.sin(angle)) ** 4;
				radius = (r * 0.9) / c ** 0.25;
			}
			points.push([angle, radius]);
		}
	}

	let path = "";
	points.forEach(([angle, radius], i) => {
		path += `${i === 0 ? "M" : "L"}${(x + Math.cos(angle) * radius).toFixed(2)} ${(y + Math.sin(angle) * radius).toFixed(2)}`;
	});
	return path + "Z";
}
