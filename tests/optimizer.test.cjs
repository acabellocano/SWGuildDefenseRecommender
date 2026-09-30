const test = require("node:test");
const assert = require("node:assert/strict");
const { solve, solveClosest, suggestFillTeams, validateDataset, parsePasteTable, datasetFromPastedTables } = require("../optimizer.js");

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

test("cleans pasted SWGT tables and subtracts four-star teams from Siege all-defences", () => {
  const fourStarText = [
    "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%",
    "ConradConrad\tKinkiKinki\tROBO-R40ROBO-R40\t1,048 / 0.2%\t19.7%",
    "FionaFiona\tEshirEshir\tTruffleTruffle\t1,791 / 0.4%\t19.6%"
  ].join("\n");
  const allText = [
    "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%",
    "LamiellaLamiella\tAshourAshour\tByungchulByungchul\t1,508 / 0.3%\t20.2%",
    "ConradConrad\tKinkiKinki\tROBO-R40ROBO-R40\t1,048 / 0.2%\t19.7%",
    "FionaFiona\tEshirEshir\tTruffleTruffle\t1,791 / 0.4%\t19.6%",
    "LamiellaLamiella\tMollyMolly\tShahatShahat\t2,456 / 0.5%\t19.2%"
  ].join("\n");
  const parsed = parsePasteTable(fourStarText, "test");
  assert.equal(parsed.teams[0].names[2], "ROBO-R40");
  assert.equal(parsed.teams[0].battles, 1048);
  assert.equal(parsed.teams[0].winRate, 19.7);
  const imported = datasetFromPastedTables({ mode: "siege", fourStarText, allText });
  assert.equal(imported.dataset.teams.length, 4);
  assert.equal(imported.fourStarCount, 2);
  assert.equal(imported.natFiveCount, 2);
  assert.equal(imported.dataset.teams.filter(team => team.siegeCategory === "fourStar").length, 2);
  assert.equal(imported.dataset.teams.filter(team => team.siegeCategory === "natFive").length, 2);
  assert.ok(imported.dataset.monsters.every(monster => monster.naturalStars === 0));
  assert.equal(imported.dataset.monsters.find(monster => monster.id === "Conrad").rosterGroup, "fourStar");
  assert.equal(imported.dataset.monsters.find(monster => monster.id === "Lamiella").rosterGroup, "unknown");
  const normalized = validateDataset(imported.dataset);
  assert.equal(normalized.monsters.find(monster => monster.id === "Conrad").rosterGroup, "fourStar");
});

test("uses the whole pasted list for WGB without a rarity category", () => {
  const text = [
    "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%",
    "MiraMira\t7R1X7R1X\tLiu MeiLiu Mei\t140 / 0.1%\t21.5%"
  ].join("\n");
  const imported = datasetFromPastedTables({ mode: "wgb", allText: text });
  assert.equal(imported.dataset.teams.length, 1);
  assert.equal(imported.dataset.teams[0].leader, "Mira");
  assert.equal(imported.dataset.teams[0].members[0], "7R1X");
  assert.equal(imported.dataset.teams[0].members[1], "Liu Mei");
  assert.equal(imported.dataset.teams[0].siegeCategory, undefined);
});

test("cleans a single Siege table without requiring the other inputs", () => {
  const text = "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%\nA\tB\tC\t100 / 0.1%\t20%";
  const fourOnly = datasetFromPastedTables({ mode: "siege", fourStarText: text, allText: "" });
  assert.equal(fourOnly.fourStarCount, 1);
  assert.equal(fourOnly.natFiveCount, 0);
  assert.equal(fourOnly.dataset.teams[0].siegeCategory, "fourStar");

  const allOnly = datasetFromPastedTables({ mode: "siege", fourStarText: "", allText: text });
  assert.equal(allOnly.fourStarCount, 0);
  assert.equal(allOnly.natFiveCount, 1);
  assert.equal(allOnly.dataset.teams[0].siegeCategory, "natFive");
});

test("revalidates normalized pasted data and optimizes using the supplied copy counts", () => {
  const imported = datasetFromPastedTables({ mode: "siege",
    fourStarText: "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%\nA\tB\tC\t100 / 0.1%\t20%",
    allText: "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%\nX\tY\tZ\t100 / 0.1%\t19%" });
  const copies = Object.fromEntries(imported.dataset.monsters.map(monster => [monster.id, { owned: 2, maxAdditional: 0 }]));
  const result = solve(imported.dataset, copies, "siege", 0, {
    requirements: { fourStar: 2, natFive: 0 }, allowDuplicateTeams: true, timeLimitMs: 5000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.teams.length, 2);
  assert.equal(result.teams[0].leader, "A");
  assert.equal(result.teams[1].leader, "A");
});

test("uses the selected per-monster copy cap and reports additional builds", () => {
  const imported = datasetFromPastedTables({ mode: "siege",
    fourStarText: "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%\nAA\tBB\tCC\t100 / 0.1%\t20%",
    allText: "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%\nXX\tYY\tZZ\t100 / 0.1%\t19%" });
  const dataset = validateDataset(imported.dataset);
  const roster = Object.fromEntries(dataset.monsters.map(monster => [monster.id, {
    owned: 1,
    maxAdditional: monster.rosterGroup === "fourStar" ? 2 : 0,
    maxCopies: monster.rosterGroup === "fourStar" ? 3 : undefined
  }]));
  const result = solve(dataset, roster, "siege", 30, {
    requirements: { fourStar: 3, natFive: 0 }, allowDuplicateTeams: true, timeLimitMs: 5000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.teams.length, 3);
  assert.equal(result.additionalCopyCount, 6);
  assert.deepEqual(result.additionalCopies, { A: 2, B: 2, C: 2 });

  for (const monster of dataset.monsters) {
    if (monster.rosterGroup === "fourStar") roster[monster.id].maxCopies = 2;
  }
  assert.equal(solve(dataset, roster, "siege", 30, {
    requirements: { fourStar: 3, natFive: 0 }, allowDuplicateTeams: true, timeLimitMs: 5000
  }).status, "infeasible");
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

test("respects entered copy counts, including multiple copies of nat-five monsters", () => {
  const oneTeam = { ...data, teams: [data.teams[2]] };
  const roster = Object.fromEntries(data.monsters.map(monster => [monster.id, { owned: 2, maxAdditional: 0 }]));
  const defaultResult = solve(oneTeam, roster, "wgb", 0, { requirements: { any: 2 }, timeLimitMs: 5000 });
  assert.equal(defaultResult.status, "infeasible");
  const result = solve(oneTeam, roster, "wgb", 0, {
    requirements: { any: 2 }, allowDuplicateTeams: true, timeLimitMs: 5000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.teams.length, 2);
  assert.deepEqual(result.teams.map(team => team.id), [result.teams[0].id, result.teams[0].id]);
});

test("finds full portfolios with larger lower-rarity copy caps without hitting the search limit", () => {
  const monsters = [];
  const teams = [];
  for (let i = 0; i < 18; i++) monsters.push({ id: "l" + i, name: "Lower " + i, naturalStars: 4 });
  for (let i = 0; i < 18; i++) monsters.push({ id: "h" + i, name: "High " + i, naturalStars: 5 });
  for (let i = 0; i < 32; i++) teams.push({
    leader: "l" + (i % 18),
    members: ["l" + ((i + 1) % 18), "l" + ((i + 4 + Math.floor(i / 18)) % 18)],
    winRate: 20 - i / 10,
    battles: 1000 + i,
    siegeCategory: "fourStar"
  });
  for (let i = 0; i < 37; i++) teams.push({
    leader: "h" + (i % 18),
    members: ["l" + ((i + 3) % 18), "l" + ((i + 6 + Math.floor(i / 18)) % 18)],
    winRate: 18 - i / 10,
    battles: 1000 + i,
    siegeCategory: "natFive"
  });
  const fixture = validateDataset({ mode: "siege", monsters, teams });
  const roster = Object.fromEntries(fixture.monsters.map(monster => [monster.id, {
    owned: 1,
    maxAdditional: monster.rosterGroup === "fourStar" ? 2 : 0,
    maxCopies: monster.rosterGroup === "fourStar" ? 3 : 1
  }]));
  const result = solve(fixture, roster, "siege", 30, {
    timeLimitMs: 5000,
    nodeLimit: 1500000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.teams.length, 10);
  assert.ok(result.nodes < 1500000);
  assert.equal(new Set(result.teams.map(team => team.id)).size, 10);
});

test("reports infeasible portfolios instead of returning partial teams", () => {
  const roster = Object.fromEntries(data.monsters.map(monster => [monster.id, { owned: 1, maxAdditional: 0 }]));
  const result = solve(data, roster, "siege", 0, { requirements: { fourStar: 4, natFive: 6 } });
  assert.equal(result.status, "infeasible");
  assert.equal(result.teams.length, 0);
});

test("finds the closest Siege category mix and suggests a 4-star filler", () => {
  const monsters = [];
  const teams = [];
  function addTeam(prefix, index, category, winRate) {
    const ids = [prefix + index + "a", prefix + index + "b", prefix + index + "c"];
    for (const id of ids) monsters.push({ id, name: id, naturalStars: category === "fourStar" ? 4 : 5 });
    teams.push({ leader: ids[0], members: ids.slice(1), winRate, battles: 1000, siegeCategory: category });
  }
  for (let index = 0; index < 5; index++) addTeam("f", index, "fourStar", 20 - index);
  for (let index = 0; index < 5; index++) addTeam("n", index, "natFive", 19 - index);
  const fixture = validateDataset({ mode: "siege", monsters, teams });
  const roster = Object.fromEntries(fixture.monsters.map(monster => [monster.id, {
    owned: 1,
    maxAdditional: 0,
    maxCopies: monster.rosterGroup === "fourStar" ? 1 : 1
  }]));

  const result = solveClosest(fixture, roster, "siege", 30, {
    requirements: { fourStar: 4, natFive: 6 },
    timeLimitMs: 5000,
    perAllocationTimeMs: 1000
  });
  assert.equal(result.status, "optimal");
  assert.equal(result.groups.find(group => group.key === "fourStar").teams.length, 4);
  assert.equal(result.groups.find(group => group.key === "natFive").teams.length, 5);

  const suggestions = suggestFillTeams(fixture, result, roster, 10, 30);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].siegeCategory, "fourStar");
  assert.equal(new Set([...result.teams, ...suggestions].map(team => team.id)).size, 10);
});

test("does not suggest filler teams that exceed available copies or the build budget", () => {
  const fixture = validateDataset({
    mode: "siege",
    monsters: [
      { id: "a", name: "A", naturalStars: 4 }, { id: "b", name: "B", naturalStars: 4 },
      { id: "c", name: "C", naturalStars: 4 }
    ],
    teams: [{ leader: "a", members: ["b", "c"], winRate: 20, battles: 100, siegeCategory: "fourStar" }]
  });
  const roster = Object.fromEntries(fixture.monsters.map(monster => [monster.id, {
    owned: 1, maxAdditional: 0, maxCopies: 1
  }]));
  const result = solve(fixture, roster, "siege", 0, {
    requirements: { fourStar: 1, natFive: 0 }, timeLimitMs: 5000
  });
  assert.deepEqual(suggestFillTeams(fixture, result, roster, 2, 0), []);
});
