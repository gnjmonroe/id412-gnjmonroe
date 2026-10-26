// Downloads a small photo for every vegetable in json/crucifers.json and records its credit.
//
//   node app/experiments/w1/brassicaceae/fetch-images.mjs
//
// json/images.json is the one place to maintain images. For each vegetable id it keeps:
//   wikipedia  the English Wikipedia article whose lead image is used (edit to pick another article)
//   file       the Wikimedia Commons file (edit to pick a specific photo; it wins over `wikipedia`)
//   src, author, license, licenseUrl, source   filled in by this script
// Run the script again after editing; it only re-downloads what changed (or everything with --all).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../..");
const SIZE = 128; // thumbnail box in pixels (the canvas draws them smaller, sharp on retina screens)
const PUBLIC_DIR = "experiments/w1/brassicaceae/images";
const HEADERS = { "user-agent": "id412-web-workshop/1.0 (student project)" };
const all = process.argv.includes("--all");

const crucifers = JSON.parse(readFileSync(join(here, "json/crucifers.json"), "utf8"));
const imagesPath = join(here, "json/images.json");
const saved = existsSync(imagesPath) ? JSON.parse(readFileSync(imagesPath, "utf8")) : { images: {} };
mkdirSync(join(root, "public", PUBLIC_DIR), { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// Wikimedia limits how fast you may ask. On "429 Too Many Requests", wait and try again.
async function politeFetch(url) {
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, { headers: HEADERS });
		if (res.status !== 429 || attempt === 6) {
			if (!res.ok) throw new Error(`${res.status} ${url}`);
			return res;
		}
		const seconds = Number(res.headers.get("retry-after")) || attempt * 5;
		console.log(`      rate limited, waiting ${seconds}s`);
		await wait(seconds * 1000);
	}
}

async function getJson(url) {
	return (await politeFetch(url)).json();
}

// The lead image of a Wikipedia article, as a Commons file name.
async function leadImage(title) {
	const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(title)}`;
	const page = Object.values((await getJson(url)).query.pages)[0];
	return page.pageimage ?? null;
}

// Thumbnail URL and credit for a Commons file.
async function fileInfo(file) {
	const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${SIZE}&iiurlheight=${SIZE}&titles=File:${encodeURIComponent(file)}`;
	const page = Object.values((await getJson(url)).query.pages)[0];
	const info = page.imageinfo?.[0];
	if (!info) return null;
	const meta = info.extmetadata ?? {};
	const plain = (html) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
	return {
		thumb: info.thumburl,
		author: plain(meta.Artist?.value) || "unknown",
		license: plain(meta.LicenseShortName?.value) || "see source",
		licenseUrl: meta.LicenseUrl?.value ?? null,
		source: info.descriptionurl,
	};
}

const images = {};
for (const veg of crucifers.nodes.filter((n) => n.kind === "vegetable")) {
	const entry = { wikipedia: veg.name, ...saved.images[veg.id] };
	try {
		const file = entry.file ?? (await leadImage(entry.wikipedia));
		if (!file) throw new Error(`no lead image on "${entry.wikipedia}"`);
		const changed = file !== saved.images[veg.id]?.file || !entry.src;
		if (changed || all) {
			const info = await fileInfo(file);
			if (!info) throw new Error(`no Commons file "${file}"`);
			const ext = info.thumb.split("?")[0].split(".").pop().toLowerCase();
			const name = `${veg.id}.${ext}`;
			const res = await politeFetch(info.thumb);
			writeFileSync(join(root, "public", PUBLIC_DIR, name), Buffer.from(await res.arrayBuffer()));
			Object.assign(entry, { file, src: `/${PUBLIC_DIR}/${name}`, author: info.author, license: info.license, licenseUrl: info.licenseUrl, source: info.source });
			delete entry.thumb;
			console.log(`ok    ${veg.id.padEnd(16)} ${file}  (${info.license})`);
		} else {
			console.log(`kept  ${veg.id.padEnd(16)} ${file}`);
		}
	} catch (error) {
		console.log(`MISS  ${veg.id.padEnd(16)} ${error.message}`);
	}
	images[veg.id] = entry;
	await wait(1500); // be gentle with Wikimedia between vegetables
}

const out = {
	description: "One small photo per vegetable in crucifers.json, keyed by vegetable id. Edit `wikipedia` or `file` to change a photo, then run fetch-images.mjs. `src` is the local copy in public/; author, license and source are the credit the licence asks for.",
	source: "Wikimedia Commons, via the lead images of English Wikipedia articles",
	images,
};
writeFileSync(imagesPath, JSON.stringify(out, null, "\t") + "\n");
