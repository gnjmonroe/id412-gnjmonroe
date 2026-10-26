"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { resetSettings, settings, VARIETIES } from "./settings";

// Toggleable panel that edits `settings` while the farm runs. Rules and colours apply at once;
// "start trees" and "random seed" apply when you press restart.

type Numbers = Record<string, number>;
type Slider = {
	label: string;
	group: Numbers;
	key: string;
	min: number;
	max: number;
	step: number;
};

const { rules, stageDays, colors, varieties } = settings;

// Slider range for each number a variety has.
const VARIETY_RANGES: Record<string, [number, number, number]> = {
	fruit: [0, 20, 1],
	growth: [0.3, 2, 0.05],
	ripenDays: [10, 200, 1],
	alternate: [0, 1, 1],
	trueSeed: [0, 1, 1],
	lobes: [0, 12, 1],
};

const SLIDERS: { title: string; items: Slider[] }[] = [
	{
		title: "Time",
		items: [
			{
				label: "days per second",
				group: rules,
				key: "daysPerSecond",
				min: 1,
				max: 200,
				step: 1,
			},
		],
	},
	{
		title: "Farmers",
		items: [
			{
				label: "walk speed",
				group: rules,
				key: "farmerSpeed",
				min: 5,
				max: 300,
				step: 5,
			},
			{
				label: "graft days",
				group: rules,
				key: "graftDays",
				min: 1,
				max: 60,
				step: 1,
			},
			{
				label: "farmer rest days",
				group: rules,
				key: "farmerRestDays",
				min: 0,
				max: 200,
				step: 5,
			},
		],
	},
	{
		title: "Fruit and propagation",
		items: [
			{
				label: "rest days",
				group: rules,
				key: "restDays",
				min: 0,
				max: 400,
				step: 5,
			},
			{
				label: "flower days",
				group: rules,
				key: "flowerDays",
				min: 1,
				max: 60,
				step: 1,
			},
			{
				label: "ripe days",
				group: rules,
				key: "ripeDays",
				min: 1,
				max: 60,
				step: 1,
			},
			{
				label: "harvest share",
				group: rules,
				key: "harvestShare",
				min: 0,
				max: 1,
				step: 0.05,
			},
			{
				label: "seed chance",
				group: rules,
				key: "seedChance",
				min: 0,
				max: 1,
				step: 0.05,
			},
			{
				label: "seed distance",
				group: rules,
				key: "seedDistance",
				min: 0,
				max: 300,
				step: 5,
			},
			{
				label: "vigor jitter",
				group: rules,
				key: "vigorJitter",
				min: 0,
				max: 0.5,
				step: 0.05,
			},
			{
				label: "min spacing",
				group: rules,
				key: "minSpacing",
				min: 20,
				max: 150,
				step: 2,
			},
		],
	},
	{
		title: "Days in each stage",
		items: Object.keys(stageDays).map((key) => ({
			label: key,
			group: stageDays,
			key,
			min: 1,
			max: 1500,
			step: 1,
		})),
	},
	{
		title: "On restart",
		items: [
			{
				label: "farmers",
				group: rules,
				key: "farmers",
				min: 0,
				max: 10,
				step: 1,
			},
			{
				label: "start trees",
				group: rules,
				key: "startTrees",
				min: 0,
				max: 30,
				step: 1,
			},
			{
				label: "random seed",
				group: rules,
				key: "seed",
				min: 0,
				max: 9999,
				step: 1,
			},
		],
	},
];

export function AdminPanel({ onRestart }: { onRestart: () => void }) {
	const [, redraw] = useState(0); // settings is a plain object, so ask React to redraw after editing

	return (
		<aside
			className={styles.admin}
			onClick={(event) => event.stopPropagation()}
		>
			<h2>Admin</h2>
			<div className={styles.adminButtons}>
				<button onClick={onRestart}>restart farm</button>
				<button
					onClick={() => {
						resetSettings();
						redraw((n) => n + 1);
					}}
				>
					reset values
				</button>
			</div>

			{SLIDERS.map((section) => (
				<section key={section.title}>
					<h3>{section.title}</h3>
					{section.items.map(({ label, group, key, min, max, step }) => (
						<label key={`${section.title}-${key}`} className={styles.row}>
							<span>{label}</span>
							<input
								type="range"
								min={min}
								max={max}
								step={step}
								value={group[key]}
								onChange={(event) => {
									group[key] = Number(event.target.value);
									redraw((n) => n + 1);
								}}
							/>
							<output>{group[key]}</output>
						</label>
					))}
				</section>
			))}

			{VARIETIES.map((name) => {
				const variety = varieties[name] as Record<string, number | string>;
				return (
					<section key={name}>
						<h3>{name}</h3>
						{Object.entries(variety).map(([key, value]) => (
							<label key={key} className={styles.row}>
								<span>{key}</span>
								{typeof value === "number" ? (
									<input
										type="range"
										min={VARIETY_RANGES[key][0]}
										max={VARIETY_RANGES[key][1]}
										step={VARIETY_RANGES[key][2]}
										value={value}
										onChange={(event) => {
											variety[key] = Number(event.target.value);
											redraw((n) => n + 1);
										}}
									/>
								) : (
									<input
										type="color"
										value={value}
										onChange={(event) => {
											variety[key] = event.target.value;
											redraw((n) => n + 1);
										}}
									/>
								)}
								<output>{value}</output>
							</label>
						))}
					</section>
				);
			})}

			<section>
				<h3>Colours</h3>
				{Object.keys(colors).map((key) => (
					<label key={key} className={styles.row}>
						<span>{key}</span>
						<input
							type="color"
							value={colors[key as keyof typeof colors]}
							onChange={(event) => {
								colors[key as keyof typeof colors] = event.target.value;
								redraw((n) => n + 1);
							}}
						/>
						<output>{colors[key as keyof typeof colors]}</output>
					</label>
				))}
			</section>
		</aside>
	);
}
