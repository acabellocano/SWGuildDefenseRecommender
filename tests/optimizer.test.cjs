const test = require("node:test");
const assert = require("node:assert/strict");
const { solve, validateDataset } = require("../optimizer.js");

const data = {
  title: "test",
  monsters: [
    { id: "a", name: "A", naturalStars: 4 }, { id: "b", name: "B", naturalStars: 4 },
    { id: "c", name: "C", naturalStars: 4 }, { id: "d", name: "D", naturalStars: 4 },
    { id: "x", name: "X", naturalStars: 5 }, { id: "y", name: "Y", naturalStars: 5 }
  ],
  teams: [
    { leader: "a", members: ["b", "c"], winRate: 20, battles: 1000 },
    { leader: "a", members: ["c", "d"], winRate: 19, battles: 1200 },
    { leader: "x", members: ["a", "b"], winRate: 18, battles: 1100 },
    { leader: "y", members: ["c", "d"], winRate: 17, battles: 1300 }
  ]
};

test("validates team identities, sample counts, and natural rarity", () => {
  assert.equal(validateDataset(data).teams.length, 4);
  assert.throws(() => validateDataset({ ...data, teams: [{ leader: "a", members: ["b", "missing"], winRate: 10, battles: 1 }] }),
    /unknown monster/);
  assert.throws(() => validateDataset({ ...data, monsters: [{ ...data.monsters[0], naturalStars: 6 }] }),
    /naturalStars/);
});

test("optimizes shared siege resources and counts additional copies", () => {
  const roster = Object.fromEntries(data.monsters.map(monster => [monster.id, { owned: 1, maxAdditional: 5 }]));
  const result = solve(data, roster, "siege", 1, {
    requirements: { fourStar: 1, natFive: 1 }, timeLimitMs: 5000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.averageWinRate, 18.5);
  assert.equal(result.additionalCopyCount, 1);
  assert.equal(result.groups[0].teams.length, 1);
  assert.equal(result.groups[1].teams.length, 1);
  assert.ok(result.groups[1].teams[0].isNatFive);
});

test("never duplicates nat-five monsters, even with an available build budget", () => {
  const roster = Object.fromEntries(data.monsters.map(monster => [monster.id, { owned: 2, maxAdditional: 10 }]));
  const result = solve(data, roster, "wgb", 10, { requirements: { any: 2 }, timeLimitMs: 5000 });
  assert.equal(result.status, "optimal");
  const fiveStarUsage = new Map();
  for (const team of result.teams) {
    for (const id of [team.leader, ...team.memberIds]) {
      if (data.monsters.find(monster => monster.id === id).naturalStars === 5) {
        fiveStarUsage.set(id, (fiveStarUsage.get(id) || 0) + 1);
      }
    }
  }
  for (const count of fiveStarUsage.values()) assert.equal(count, 1);
});

test("reports infeasible portfolios instead of returning partial teams", () => {
  const roster = Object.fromEntries(data.monsters.map(monster => [monster.id, { owned: 1, maxAdditional: 0 }]));
  const result = solve(data, roster, "siege", 0, { requirements: { fourStar: 4, natFive: 6 } });
  assert.equal(result.status, "infeasible");
  assert.equal(result.teams.length, 0);
});
