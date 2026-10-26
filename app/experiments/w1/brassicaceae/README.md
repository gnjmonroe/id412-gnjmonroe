# Brassicaceae

The ancestry of the cruciferous vegetables drawn as an outline tree: the mustard family at the top left, each node on its own row, indented by its steps of descent. Hybrid and cross parents are coloured dashed curves. Drag or scroll to move around.

- Route: /experiments/w1/brassicaceae
- Week: W1 · Tech: Canvas
- Inputs: drag or scroll to pan (redraws on resize)
- Parameters: row height, indent, colours per node kind and edge type (top of `page.tsx`)

## How it works

- `json/` holds the data: `species.json` (every accepted species, World Flora Online), `lineage.json` (family tree of the genera, Open Tree of Life) and `crucifers.json` (vegetables, species, clades and how they descend).
- `page.tsx` reads `crucifers.json`. Each node hangs under its main parent; walking the tree depth first gives every node its own row, so labels never overlap.
- The tree is bigger than the screen: pointer drag and wheel move a pan offset, clamped to the tree's edges. The title and legend stay fixed on top.
- Second parents (hybrid species like B. juncea, crosses like broccolini) are drawn as extra dashed curves.
- Dots are coloured by kind: clade, species, crop lineage, vegetable.

## Run

pnpm dev → http://localhost:3000/experiments/w1/brassicaceae

## Status / next

Works without overlapping text. Next: hover a vegetable to highlight its full lineage.
