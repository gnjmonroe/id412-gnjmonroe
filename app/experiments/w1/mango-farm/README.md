# Mango Farm

A top-down mango farm that runs by itself: seeds sprout, trees grow, flower, fruit, get harvested and die, and new trees start from fallen seeds or from grafts you make.

- Route: /experiments/w1/mango-farm
- Week: W1 · Tech: Canvas
- Inputs: time, farmers, fruit bats, mouse clicks (plant, graft), play/pause and speed buttons, admin panel (A key)
- Parameters: stage lengths, fruit per tree, harvest share, seed chance, spacing (all in `settings.ts`, editable live in the admin panel)

## How it works

- `farm.ts` is the data: a `Farm` holds `Tree`s at free x, y positions; each tree has a stage (`seed → seedling → sapling → mature → fruiting → senescent`) and a list of `Fruit`s (`flower → green → ripe → fallen`).
- `step(farm, days)` ages every tree and fruit. Ripe fruit is mostly harvested (counted), the rest falls and may grow a new seed nearby.
- Five varieties (Keitt, Kent, Alphonso, Ataulfo, Carabao) in `settings.varieties`, each with its own fruit count, growth speed, ripening time, alternate bearing and seed type. True-seed (polyembryonic) varieties mostly breed true. Any other seed grows a new one-off "seedling #id" variety with its mother's traits nudged by chance (usually a bit worse) and its own colours; grafting copies it exactly. Click a grown tree to see its traits. Each is told apart by canopy shape (`shapes.ts`: round, soft lobes, star, polygon, petals, rounded square) and fill colour only. Fruit hang in an even ring (Keitt, Alphonso, Carabao) or in jittered bunches (Kent, Ataulfo), set by the `clusters` trait (printing-ink colours on paper after Karel Martens, drawn with a multiply blend so overlaps mix like overprinted ink); the legend shows counts.
- Propagation: by seed (random vigor, starts as a seed) or by graft (exact copy, starts as a sapling). Dashed line = graft, solid = seed.
- Farmers (hat seen from above) keep all five varieties going: they share their time equally between the varieties (all promising seedlings count as one), each trip going to the variety with the fewest trips so far; a farmer picks a grown tree of it, walks over, takes a cutting, walks to free ground nearby and grafts a sapling, then rests. Every seventh day is their day off. Without farmers Keitt, Kent and Alphonso die out, since their seeds don't breed true. They also graft promising seedling varieties (fruit ≥ `promisingFruit`), the way real growers find new cultivars. On screen: feet step while walking, a dotted trail shows where they are headed, a green wedge fills while cutting, a sprig is carried to the spot, a pale disc pulses where a graft lands, and resting farmers fade with a "z".
- Fruit bats (one per farmer, muted teal, wings beating) roost off the farm, fly in to a tree with ripe fruit, eat one and fly off. Sometimes they carry the seed away and drop it on free ground, planting a new seedling far from its parent: pest and seed spreader at once.
- `AdminPanel.tsx` (press A or the admin button) has sliders for the rules and stage days and pickers for every colour. Changes apply at once; start trees and random seed apply on restart. Reset values restores `settings.ts`.
- `page.tsx` only draws the farm and handles clicks. The random generator is seeded, so every run is the same.

## Run

pnpm dev → http://localhost:3000/experiments/w1/mango-farm

## Status / next

Works. Next: seasons that decide when trees flower, or weather that changes the harvest.
