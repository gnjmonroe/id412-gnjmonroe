# Brassicaceae

The ancestry of the cruciferous vegetables drawn as an outline tree: the mustard family at the top left, each node on its own row, indented by its steps of descent. Hybrid and cross parents are coloured dashed curves. Drag or scroll to move around.

- Route: /experiments/w1/brassicaceae (outline), /experiments/w1/brassicaceae/signature (radial, from signatures) and /experiments/w1/brassicaceae/cards (step through the lineage)
- Week: W1 · Tech: Canvas
- Inputs: drag or scroll to pan (redraws on resize)
- Parameters: row height, indent, colours per node kind and edge type (top of `page.tsx`)

## How it works

- `json/` holds the data: `species.json` (every accepted species, World Flora Online), `lineage.json` (family tree of the genera, Open Tree of Life) and `crucifers.json` (vegetables, species, clades and how they descend).
- `page.tsx` reads `crucifers.json`. Each node hangs under its main parent; walking the tree depth first gives every node its own row, so labels never overlap.
- The tree is bigger than the screen: pointer drag and wheel move a pan offset, clamped to the tree's edges. The title and legend stay fixed on top.
- Second parents (hybrid species like B. juncea, crosses like broccolini) are drawn as extra dashed curves.
- Dots are coloured by kind: clade, species, crop lineage, vegetable.
- Photos: `json/images.json` lists one Wikimedia Commons photo per vegetable (with author and licence); `fetch-images.mjs` downloads 120 px copies to `public/experiments/w1/brassicaceae/images/`. To change a photo, edit its `file` (or `wikipedia`) and run `node app/experiments/w1/brassicaceae/fetch-images.mjs`. Hover a vegetable to see its photo credit; click it to open the photo file at its real size (Esc or click to close).
- `/signature` rebuilds the same lineage from each entry's `genome.signature` only (`signature.ts`): every prefix of a signature is a node, so shared beginnings are shared ancestry and `[A] + [B]` joins two branches (a hybrid or cross). Drawn radially: the family root in the centre, one ring per genome change, every entry labelled on the outer ring. Hover traces a path; drag to move, scroll to zoom.
- `/cards` reads `json/graph.json` (the same lineage as one nested tree, Brassicaceae at the top). It starts with one card; clicking a card moves it up (above the cards clicked before it) and shows its immediate descendants vertically centred below it, joined to it by lines (an SVG drawn from the cards' measured positions). Scroll up to see the whole path. Leaves (the ends of a line) are shown large, with a button back to Brassicaceae below them.

## Run

pnpm dev → http://localhost:3000/experiments/w1/brassicaceae

## Status / next

Works without overlapping text. Next: hover a vegetable to highlight its full lineage.
