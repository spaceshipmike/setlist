#!/usr/bin/env node
// One-shot: backfill goals (and two descriptions) on three active projects
// that were missing them.
//   node packages/core/scripts/backfill-missing-goals.mjs            # dry-run
//   node packages/core/scripts/backfill-missing-goals.mjs --apply    # write

import { Registry } from '@setlist/core';

const apply = process.argv.includes('--apply');

const updates = [
  {
    name: 'fam-austin-gp-trip',
    goals: [
      'Secure race tickets, flights, and lodging for the Austin GP weekend',
      "Plan Oliver's birthday celebration around the trip",
      'Build an itinerary that works for all three of us (race days + off-day activities)',
    ],
  },
  {
    name: 'fam-colorado-trip',
    description: 'Planning a trip for me, Stacie, and Oliver to Boulder & Denver over Memorial Day weekend to see family.',
    goals: [
      'Coordinate the three-person trip logistics (flights, lodging, ground transport)',
      'Schedule time with Colorado family members across both cities',
      'Plan activities mixing family visits, Boulder, and Denver proper',
    ],
  },
  {
    name: 'bss-speaker-series',
    description: "Curating Big Spaceship's internal speaker series — sourcing speakers, scheduling talks, coordinating logistics.",
    goals: [
      "Maintain a steady pipeline of speakers relevant to BSS's work and culture",
      'Keep a reliable cadence of talks on the company calendar',
      'Coordinate end-to-end logistics per talk — outreach, scheduling, AV, intros, follow-up',
    ],
  },
];

const registry = new Registry();

for (const u of updates) {
  console.log(`${u.name}`);
  if (u.description) console.log(`  description: ${u.description}`);
  console.log(`  goals (${u.goals.length}):`);
  for (const g of u.goals) console.log(`    - ${g}`);
  if (apply) {
    registry.updateCore(u.name, {
      ...(u.description ? { description: u.description } : {}),
      goals: u.goals,
    });
    console.log('  ✓ written');
  }
  console.log();
}

console.log(apply ? 'Applied.' : 'Dry-run complete. Re-run with --apply to write.');
