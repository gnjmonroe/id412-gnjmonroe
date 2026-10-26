// Rebuilds the lineage of the crucifers from genome signatures alone.
//
// A signature is a path of tags: "At-α › PCK › WGT › … › CC › leafy › inflorescence".
// A hybrid starts with its two parents' paths: "[path A] + [path B] › AACC › oilseed".
// Every prefix of a signature is a node, so signatures that share a beginning share ancestry,
// and a "[A] + [B]" start joins two branches into one.

export type SigNode = {
	key: string; // the full prefix: unique, so repeated tags like "seed" never collide
	tag: string; // the last tag of the prefix
	parents: string[]; // one parent, or two at a join
	depth: number; // number of tags from the root (the longer parent counts at a join)
	names: string[]; // entries whose signature is exactly this prefix
};

const STEP = " › ";

// Split at a separator, but only outside [ ] brackets.
function splitTop(text: string, separator: string) {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "[") depth++;
		if (text[i] === "]") depth--;
		if (depth === 0 && text.startsWith(separator, i)) {
			parts.push(text.slice(start, i));
			start = i + separator.length;
			i += separator.length - 1;
		}
	}
	parts.push(text.slice(start));
	return parts;
}

// "[A] + [B] › x › y" → { join: ["A", "B"], tags: ["x", "y"] };  "a › b" → { join: [], tags: ["a", "b"] }
export function parseSignature(signature: string) {
	const steps = splitTop(signature, STEP);
	if (!steps[0].startsWith("[")) return { join: [] as string[], tags: steps };
	const join = splitTop(steps[0], " + ").map((part) => part.slice(1, -1));
	return { join, tags: steps.slice(1) };
}

export function buildGraph(entries: { name: string; signature: string }[]) {
	const nodes = new Map<string, SigNode>();

	// Add every node along one signature; returns the key of its last node.
	function addPath(signature: string): string {
		const { join, tags } = parseSignature(signature);
		let parents = join.map(addPath);
		let prefix = join.length ? join.map((part) => `[${part}]`).join(" + ") : "";
		for (const tag of tags) {
			const key = prefix ? prefix + STEP + tag : tag;
			let node = nodes.get(key);
			if (!node) {
				const depth = Math.max(
					0,
					...parents.map((p) => nodes.get(p)!.depth + 1),
				);
				node = { key, tag, parents, depth, names: [] };
				nodes.set(key, node);
			}
			parents = [key];
			prefix = key;
		}
		return prefix;
	}

	for (const entry of entries)
		nodes.get(addPath(entry.signature))!.names.push(entry.name);
	return nodes;
}
