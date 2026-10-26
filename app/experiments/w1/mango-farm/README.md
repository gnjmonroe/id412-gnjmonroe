# Mango Farm

A top-down mango farm that runs by itself: seeds sprout, trees grow, flower, fruit, get harvested and die, and new trees start from fallen seeds or from grafts you make.

- Route: /experiments/w1/mango-farm
- Week: W1 · Tech: Canvas
- Inputs: time, mouse clicks (plant, graft), play/pause and speed buttons
- Parameters: stage lengths, fruit per tree, harvest share, seed chance, spacing (all in `settings.ts`)

## How it works

- `farm.ts` is the data: a `Farm` holds `Tree`s at free x, y positions; each tree has a stage (`seed → seedling → sapling → mature → fruiting → senescent`) and a list of `Fruit`s (`flower → green → ripe → fallen`).
- `step(farm, days)` ages every tree and fruit. Ripe fruit is mostly harvested (counted), the rest falls and may grow a new seed nearby.
- Propagation: by seed (random vigor, starts as a seed) or by graft (exact copy, starts as a sapling). Dashed line = graft, solid = seed.
- `page.tsx` only draws the farm and handles clicks. The random generator is seeded, so every run is the same.

## Run

pnpm dev → http://localhost:3000/experiments/w1/mango-farm

## Status / next

Works. Next: seasons that decide when trees flower, or weather that changes the harvest.
