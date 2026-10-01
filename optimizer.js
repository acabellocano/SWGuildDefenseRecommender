(function (root) {
  "use strict";

  const RANKS = ["G1", "G2", "G3", "ALL"];

  function wilsonInterval(wins, battles) {
    const z = 1.959963984540054;
    const rate = wins / battles;
    const z2 = z * z;
    const denominator = 1 + z2 / battles;
    const center = rate + z2 / (2 * battles);
    const margin = z * Math.sqrt(rate * (1 - rate) / battles + z2 / (4 * battles * battles));
    return {
      lower: Math.max(0, (center - margin) / denominator),
      upper: Math.min(1, (center + margin) / denominator)
    };
  }

  function winsFromRoundedRate(sample) {
    const precision = Number.isInteger(sample.precision) ? sample.precision : 1;
    const halfStep = Math.pow(10, -precision) / 2;
    const lowerRate = Math.max(0, sample.winRate - halfStep) / 100;
    const upperRate = Math.min(100, sample.winRate + halfStep) / 100;
    return {
      minimum: Math.max(0, Math.ceil(lowerRate * sample.battles - 1e-10)),
      maximum: Math.min(sample.battles, Math.floor(upperRate * sample.battles + 1e-10))
    };
  }

  function confidenceTier(battles) {
    return battles >= 5000 ? "high" : battles >= 2000 ? "moderate" : "limited";
  }

  function evidenceForSample(sample, rank, status) {
    const wins = winsFromRoundedRate(sample);
    const representativeWins = Math.round(sample.winRate * sample.battles / 100);
    const interval = wilsonInterval(representativeWins, sample.battles);
    const conservative = wilsonInterval(wins.minimum, sample.battles).lower;
    return {
      rank,
      status,
      battles: sample.battles,
      winRate: sample.winRate,
      roundingRange: {
        lower: wins.minimum * 100 / sample.battles,
        upper: wins.maximum * 100 / sample.battles
      },
      wilson95: { lower: interval.lower * 100, upper: interval.upper * 100 },
      conservativeRate: conservative * 100,
      scoreBps: Math.floor(conservative * 10000),
      confidence: confidenceTier(sample.battles)
    };
  }

  function inferRankEvidence(rankData, target, rankTablesProvided) {
    const otherRanks = target === "G1" ? ["G2", "G3"] :
      target === "G2" ? ["G1", "G3"] : null;
    const requiredTables = ["G1", "G2", "G3", "ALL"];
    if (!otherRanks || !rankData.ALL || !rankData[otherRanks[0]] || !rankData[otherRanks[1]] ||
        !requiredTables.every(rank => rankTablesProvided.includes(rank))) return null;
    const [first, second] = otherRanks.map(rank => rankData[rank]);
    const battles = rankData.ALL.battles - first.battles - second.battles;
    if (battles <= 0) return null;
    const allWins = winsFromRoundedRate(rankData.ALL);
    const firstWins = winsFromRoundedRate(first);
    const secondWins = winsFromRoundedRate(second);
    const minimumWins = Math.max(0, allWins.minimum - firstWins.maximum - secondWins.maximum);
    const maximumWins = Math.min(battles, allWins.maximum - firstWins.minimum - secondWins.minimum);
    if (minimumWins > maximumWins) return null;
    const estimateWins = rankData.ALL.battles * rankData.ALL.winRate / 100 -
      first.battles * first.winRate / 100 - second.battles * second.winRate / 100;
    const estimate = Math.max(0, Math.min(battles, estimateWins)) * 100 / battles;
    const evidence = evidenceForSample({
      battles,
      winRate: estimate,
      precision: Math.min(rankData.ALL.precision, first.precision, second.precision)
    }, target, "inferred");
    evidence.roundingRange = {
      lower: minimumWins * 100 / battles,
      upper: maximumWins * 100 / battles
    };
    evidence.conservativeRate = wilsonInterval(minimumWins, battles).lower * 100;
    evidence.scoreBps = Math.floor(evidence.conservativeRate * 100);
    return evidence;
  }

  function makeG1Evidence(rankData, rankTablesProvided) {
    if (rankData.G1) return evidenceForSample(rankData.G1, "G1", "measured");
    return inferRankEvidence(rankData, "G1", rankTablesProvided) ||
      { rank: "G1", status: "unknown", reason: "G1 performance cannot be uniquely reconstructed from the imported rank tables." };
  }

  function makePortfolioEvidence(rankData, rankTablesProvided) {
    if (rankData.G1) return evidenceForSample(rankData.G1, "G1", "measured");
    const inferredG1 = inferRankEvidence(rankData, "G1", rankTablesProvided);
    if (inferredG1) return inferredG1;
    if (rankData.G2) return evidenceForSample(rankData.G2, "G2", "measured");
    const inferredG2 = inferRankEvidence(rankData, "G2", rankTablesProvided);
    if (inferredG2) return inferredG2;
    if (rankData.G3) return evidenceForSample(rankData.G3, "G3", "measured");
    return { rank: null, status: "unknown", reason: "No eligible G1, G2, or G3 evidence is available." };
  }

  function validateDataset(input) {
    if (!input || typeof input !== "object" || !Array.isArray(input.monsters) || !Array.isArray(input.teams)) {
      throw new Error("Expected JSON with monsters and teams arrays.");
    }
    if (input.rankAware === true && input.mode !== "siege" && input.mode !== "wgb") {
      throw new Error("Rank-aware datasets must declare Siege or World Guild Battle mode.");
    }
    if (input.rankAware === true && !Array.isArray(input.rankTablesProvided)) {
      throw new Error("Rank-aware datasets must identify which rank tables were imported.");
    }
    if (input.rankAware === true && (input.rankTablesProvided.some(rank => !RANKS.includes(rank)) ||
        new Set(input.rankTablesProvided).size !== input.rankTablesProvided.length)) {
      throw new Error("rankTablesProvided must contain unique G1, G2, G3, or ALL names.");
    }
    const monsters = new Map();
    for (const monster of input.monsters) {
      if (!monster || typeof monster.id !== "string" || !monster.id.trim() ||
          typeof monster.name !== "string" || !monster.name.trim() ||
          !Number.isInteger(monster.naturalStars) || monster.naturalStars < 0 || monster.naturalStars > 5) {
        throw new Error("Each monster needs a non-empty id and name, and naturalStars from 0 (unknown) to 5.");
      }
      if (monsters.has(monster.id)) throw new Error("Duplicate monster id: " + monster.id);
      monsters.set(monster.id, {
        id: monster.id,
        name: monster.name,
        naturalStars: monster.naturalStars,
        rosterGroup: monster.rosterGroup === "fourStar" ||
          (monster.naturalStars > 0 && monster.naturalStars < 5) ? "fourStar" : "unknown"
      });
    }
    const teams = [];
    const seen = new Set();
    for (const team of input.teams) {
      const members = team && (team.members || team.memberIds);
      if (!team || typeof team.leader !== "string" || !Array.isArray(members) ||
          members.length !== 2 || members.some(id => typeof id !== "string")) {
        throw new Error("Each team needs a leader and exactly two member ids.");
      }
      const ids = [team.leader, ...members];
      if (new Set(ids).size !== 3) throw new Error("A team cannot use the same monster more than once.");
      for (const id of ids) if (!monsters.has(id)) throw new Error("Team refers to unknown monster id: " + id);
      const winRate = Number(team.winRate ?? (team.winRateBps / 100));
      const battles = Number(team.battles);
      if (!Number.isFinite(winRate) || winRate < 0 || winRate > 100 ||
          !Number.isInteger(battles) || battles < 1) {
        throw new Error("Each team needs a winRate from 0 to 100 and a positive integer battles count.");
      }
      const teamId = team.leader + "|" + members.slice().sort().join("|");
      if (seen.has(teamId)) throw new Error("Duplicate team observation: " + teamId);
      seen.add(teamId);
      const normalizedTeam = {
        id: teamId,
        leader: team.leader,
        memberIds: members.slice(),
        winRateBps: Math.round(winRate * 100),
        battles
      };
      if (team.rankData !== undefined) {
        if (!team.rankData || typeof team.rankData !== "object" || Array.isArray(team.rankData)) {
          throw new Error("rankData must map G1, G2, G3, and ALL to battle samples.");
        }
        if (Object.keys(team.rankData).some(rank => !RANKS.includes(rank))) {
          throw new Error("rankData contains an unsupported rank key.");
        }
        normalizedTeam.rankData = {};
        for (const rank of RANKS) {
          const sample = team.rankData[rank];
          if (sample === undefined) continue;
          const rankRate = Number(sample && sample.winRate);
          const rankBattles = Number(sample && sample.battles);
          const precision = sample && (sample.precision ?? sample.winRatePrecision);
          if (!Number.isFinite(rankRate) || rankRate < 0 || rankRate > 100 ||
              !Number.isInteger(rankBattles) || rankBattles < 1 ||
              (precision !== undefined && (!Number.isInteger(precision) || precision < 0 || precision > 4))) {
            throw new Error("Each rank sample needs a valid winRate, positive integer battles, and up to four decimal places of precision.");
          }
          normalizedTeam.rankData[rank] = {
            winRate: rankRate,
            battles: rankBattles,
            precision: precision === undefined ? 1 : precision
          };
        }
        const teamRankTables = team.rankTablesProvided ?? input.rankTablesProvided;
        if (!Array.isArray(teamRankTables) || teamRankTables.some(rank => !RANKS.includes(rank)) ||
            new Set(teamRankTables).size !== teamRankTables.length) {
          throw new Error("Each rank-aware team must identify its unique supplied rank tables.");
        }
        if (Object.keys(normalizedTeam.rankData).some(rank => !teamRankTables.includes(rank))) {
          throw new Error("A rank sample cannot exist unless that rank table was supplied for the team.");
        }
        normalizedTeam.rankTablesProvided = teamRankTables.slice();
        normalizedTeam.g1Evidence = makeG1Evidence(normalizedTeam.rankData, teamRankTables);
        normalizedTeam.g2Evidence = normalizedTeam.rankData.G2
          ? evidenceForSample(normalizedTeam.rankData.G2, "G2", "measured")
          : inferRankEvidence(normalizedTeam.rankData, "G2", teamRankTables);
        normalizedTeam.portfolioEvidence = makePortfolioEvidence(normalizedTeam.rankData, teamRankTables);
      }
      if (input.rankAware === true && !normalizedTeam.g1Evidence) {
        normalizedTeam.rankData = {};
        normalizedTeam.rankTablesProvided = input.rankTablesProvided.slice();
        normalizedTeam.g1Evidence = makeG1Evidence(normalizedTeam.rankData, normalizedTeam.rankTablesProvided);
        normalizedTeam.g2Evidence = undefined;
        normalizedTeam.portfolioEvidence = makePortfolioEvidence(normalizedTeam.rankData, normalizedTeam.rankTablesProvided);
      }
      if (team.siegeCategory === "fourStar" || team.siegeCategory === "natFive") {
        normalizedTeam.siegeCategory = team.siegeCategory;
      }
      teams.push(normalizedTeam);
    }
    if (!teams.length) throw new Error("The dataset must include at least one team.");
    const fourStarRoster = new Set(teams.filter(team => team.siegeCategory === "fourStar")
      .flatMap(team => [team.leader, ...team.memberIds]));
    if (input.mode === "siege") {
      for (const id of fourStarRoster) monsters.get(id).rosterGroup = "fourStar";
    }
    const result = {
      title: typeof input.title === "string" ? input.title : "Imported candidate data",
      snapshot: typeof input.snapshot === "string" ? input.snapshot : "Snapshot not specified",
      mode: input.mode === "siege" || input.mode === "wgb" ? input.mode : null,
      rankAware: input.rankAware === true,
      rankTablesProvided: Array.isArray(input.rankTablesProvided)
        ? input.rankTablesProvided.filter(rank => RANKS.includes(rank)) : [],
      monsters: Array.from(monsters.values()),
      teams
    };
    if (input.sourceTables !== undefined || input.sourceTablesProvided !== undefined) {
      if (input.mode !== "siege" || !input.sourceTables || !input.sourceTablesProvided ||
          typeof input.sourceTables !== "object" || typeof input.sourceTablesProvided !== "object") {
        throw new Error("Complete source tables are supported only for Siege rank-aware datasets.");
      }
      const sourceTables = {};
      const sourceTablesProvided = {};
      for (const category of ["fourStar", "all"]) {
        if (!input.sourceTables[category] || !input.sourceTablesProvided[category] ||
            !Array.isArray(input.sourceTablesProvided[category]) ||
            input.sourceTablesProvided[category].some(rank => !RANKS.includes(rank)) ||
            new Set(input.sourceTablesProvided[category]).size !== input.sourceTablesProvided[category].length) {
          throw new Error("Complete Siege source tables must identify unique supplied ranks for each category.");
        }
        sourceTables[category] = {};
        sourceTablesProvided[category] = input.sourceTablesProvided[category].slice();
        for (const rank of RANKS) {
          const rows = input.sourceTables[category][rank];
          if (!Array.isArray(rows)) throw new Error("Complete Siege source tables need an array for each rank.");
          sourceTables[category][rank] = rows.map(row => {
            const names = row && row.names;
            const battles = Number(row && row.battles);
            const winRate = Number(row && row.winRate);
            const precision = row && row.precision;
            if (!Array.isArray(names) || names.length !== 3 ||
                names.some(name => typeof name !== "string" || !name.trim() || /[\t\r\n]/.test(name)) ||
                new Set(names.map(name => name.toLocaleLowerCase())).size !== 3 ||
                !Number.isSafeInteger(battles) || battles < 1 ||
                !Number.isFinite(winRate) || winRate < 0 || winRate > 100 ||
                !Number.isInteger(precision) || precision < 0 || precision > 4) {
              throw new Error("Each complete source-table row needs three names, valid battles, winRate, and precision.");
            }
            return { names: names.slice(), battles, winRate, precision };
          });
          if (sourceTables[category][rank].length &&
              !sourceTablesProvided[category].includes(rank)) {
            throw new Error("Source-table rows cannot exist for an undeclared input table.");
          }
        }
      }
      result.sourceTables = sourceTables;
      result.sourceTablesProvided = sourceTablesProvided;
    }
    return result;
  }

  function cleanMonsterLabel(value) {
    const label = value.trim().replace(/\s+/g, " ");
    if (label.length % 2 === 0) {
      const half = label.slice(0, label.length / 2);
      if (half.toLocaleLowerCase() === label.slice(label.length / 2).toLocaleLowerCase()) {
        return { name: half, cleaned: true };
      }
    }
    return { name: label, cleaned: false };
  }

  function parsePasteTable(text, sourceLabel) {
    const lines = String(text || "").split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error(sourceLabel + ": paste the header and at least one data row.");
    const headers = lines[0].split("\t").map(value => value.trim().toLowerCase().replace(/[^a-z0-9%]/g, ""));
    const columns = {
      leader: headers.findIndex(value => value === "monsterleader" || value === "leader"),
      monster2: headers.findIndex(value => value === "monster2"),
      monster3: headers.findIndex(value => value === "monster3"),
      battles: headers.findIndex(value => value === "battles"),
      winRate: headers.findIndex(value => value === "wr%" || value === "winrate" || value === "winrate%")
    };
    if (Object.values(columns).some(index => index < 0)) {
      throw new Error(sourceLabel + ": expected Monster Leader, Monster 2, Monster 3, Battles, and WR% columns.");
    }
    const teams = [];
    let cleanedLabels = 0;
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const cells = lines[lineIndex].split("\t");
      const rowNumber = lineIndex + 1;
      if (cells.length <= Math.max(...Object.values(columns))) {
        throw new Error(sourceLabel + ", row " + rowNumber + ": expected five tab-separated columns.");
      }
      const labels = [columns.leader, columns.monster2, columns.monster3].map(index => cleanMonsterLabel(cells[index]));
      cleanedLabels += labels.filter(label => label.cleaned).length;
      if (labels.some(label => !label.name)) throw new Error(sourceLabel + ", row " + rowNumber + ": monster names cannot be empty.");
      const battleCell = cells[columns.battles].trim();
      const battleMatch = battleCell.match(/^([\d,]+)(?:\s*\/\s*.*)?$/);
      const winRateMatch = cells[columns.winRate].trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
      if (!battleMatch || !winRateMatch) {
        throw new Error(sourceLabel + ", row " + rowNumber + ": could not parse Battles or WR%.");
      }
      const battles = Number(battleMatch[1].replace(/,/g, ""));
      const winRate = Number(winRateMatch[1]);
      if (!Number.isSafeInteger(battles) || battles < 1 || winRate < 0 || winRate > 100) {
        throw new Error(sourceLabel + ", row " + rowNumber + ": Battles must be positive and WR% must be 0–100.");
      }
      const names = labels.map(label => label.name);
      if (new Set(names.map(name => name.toLocaleLowerCase())).size !== 3) {
        throw new Error(sourceLabel + ", row " + rowNumber + ": a team must contain three distinct monsters.");
      }
      const rateText = cells[columns.winRate].trim().replace(/\s*%$/, "").trim();
      const precision = rateText.includes(".") ? rateText.length - rateText.indexOf(".") - 1 : 0;
      teams.push({ names, battles, winRate, precision, rowNumber });
    }
    return { teams, cleanedLabels };
  }

  function datasetFromPastedTables(options) {
    const mode = options && options.mode;
    if (mode === "wgb") {
      const parsed = parsePasteTable(options.allText, "World Guild Battle");
      return {
        dataset: makePasteDataset(parsed.teams, "World Guild Battle paste", "Pasted WGB data", "wgb"),
        cleanedLabels: parsed.cleanedLabels,
        fourStarCount: 0,
        natFiveCount: parsed.teams.length
      };
    }
    if (mode !== "siege") throw new Error("Choose Siege or World Guild Battle before pasting.");
    if (!String(options.fourStarText || "").trim() && !String(options.allText || "").trim()) {
      throw new Error("Paste at least one Siege table.");
    }
    const fourStar = String(options.fourStarText || "").trim()
      ? parsePasteTable(options.fourStarText, "Siege 4-star table") : { teams: [], cleanedLabels: 0 };
    const all = String(options.allText || "").trim()
      ? parsePasteTable(options.allText, "Siege all-defences table") : { teams: [], cleanedLabels: 0 };
    const fourKeys = new Set(fourStar.teams.map(team => pasteTeamKey(team.names)));
    const fourSeen = new Set();
    for (const team of fourStar.teams) {
      const key = pasteTeamKey(team.names);
      if (fourSeen.has(key)) throw new Error("Siege 4-star table contains the same team more than once: " + team.names.join(" / "));
      fourSeen.add(key);
      team.siegeCategory = "fourStar";
    }
    const remaining = [];
    const allSeen = new Set();
    for (const team of all.teams) {
      const key = pasteTeamKey(team.names);
      if (allSeen.has(key)) throw new Error("Siege all-defences table contains the same team more than once: " + team.names.join(" / "));
      allSeen.add(key);
      if (!fourKeys.has(key)) {
        team.siegeCategory = "natFive";
        remaining.push(team);
      }
    }
    const union = fourStar.teams.concat(remaining);
    const fourStarMonsters = new Set(fourStar.teams.flatMap(team => team.names.map(name => name.toLocaleLowerCase())));
    return {
      dataset: makePasteDataset(union, "Siege pasted tables", "Siege pasted data · categories from table comparison", "siege", fourStarMonsters),
      cleanedLabels: fourStar.cleanedLabels + all.cleanedLabels,
      fourStarCount: fourStar.teams.length,
      natFiveCount: remaining.length
    };
  }

  function datasetFromRankPastedTables(options) {
    options = options || {};
    const mode = options && options.mode || "siege";
    if (mode !== "siege" && mode !== "wgb") throw new Error("Choose Siege or World Guild Battle.");
    const readTables = (tables, label) => {
      const teamsByKey = new Map();
      const counts = {};
      const rankTablesProvided = [];
      const sourceTables = {};
      let cleanedLabels = 0;
      for (const rank of RANKS) {
        const text = String(tables && tables[rank] || "").trim();
        sourceTables[rank] = [];
        if (!text) continue;
        const parsed = parsePasteTable(text, label + " " + rank + " table");
        rankTablesProvided.push(rank);
        counts[rank] = parsed.teams.length;
        cleanedLabels += parsed.cleanedLabels;
        const seen = new Set();
        for (const team of parsed.teams) {
          sourceTables[rank].push({
            names: team.names.slice(),
            battles: team.battles,
            winRate: team.winRate,
            precision: team.precision
          });
          const key = pasteTeamKey(team.names);
          if (seen.has(key)) {
            throw new Error(label + " " + rank + " table contains the same team more than once: " + team.names.join(" / "));
          }
          seen.add(key);
          let entry = teamsByKey.get(key);
          if (!entry) {
            entry = { names: team.names, rankData: {}, rankTablesProvided };
            teamsByKey.set(key, entry);
          }
          entry.rankData[rank] = {
            battles: team.battles,
            winRate: team.winRate,
            precision: team.precision
          };
        }
      }
      return { teamsByKey, counts, rankTablesProvided, sourceTables, cleanedLabels };
    };
    const snapshot = String(options.snapshot || "").trim() || "Rank-scoped " +
      (mode === "siege" ? "Siege" : "World Guild Battle") + " paste";

    if (mode === "wgb") {
      const imported = readTables(options.tables, "WGB");
      if (!imported.teamsByKey.size) throw new Error("Paste at least one rank-scoped WGB table.");
      const dataset = makeRankAwareDataset(Array.from(imported.teamsByKey.values()), {
        mode, snapshot, rankTablesProvided: imported.rankTablesProvided
      });
      return { dataset, counts: imported.counts, cleanedLabels: imported.cleanedLabels };
    }

    const fourStar = readTables(options.fourStarTables || options.tables, "Siege 4-star");
    const all = readTables(options.allTables, "Siege all-defences");
    if (!fourStar.teamsByKey.size && !all.teamsByKey.size) {
      throw new Error("Paste at least one 4-star or all-defences Siege rank table.");
    }
    const fourStarKeys = new Set(fourStar.teamsByKey.keys());
    const fourStarRows = Array.from(fourStar.teamsByKey.values(), entry => ({
      ...entry, siegeCategory: "fourStar"
    }));
    const remainderRows = Array.from(all.teamsByKey.entries())
      .filter(([key]) => !fourStarKeys.has(key))
      .map(([, entry]) => ({ ...entry, siegeCategory: "natFive" }));
    const dataset = makeRankAwareDataset(fourStarRows.concat(remainderRows), {
      mode,
      snapshot,
      rankTablesProvided: Array.from(new Set([
        ...fourStar.rankTablesProvided,
        ...all.rankTablesProvided
      ])),
      sourceTables: { fourStar: fourStar.sourceTables, all: all.sourceTables },
      sourceTablesProvided: {
        fourStar: fourStar.rankTablesProvided,
        all: all.rankTablesProvided
      }
    });
    return {
      dataset,
      counts: { fourStar: fourStar.counts, all: all.counts },
      fourStarCount: fourStarRows.length,
      natFiveCount: remainderRows.length,
      cleanedLabels: fourStar.cleanedLabels + all.cleanedLabels
    };
  }

  function makeRankAwareDataset(entries, options) {
    const monsters = new Map();
    const teams = entries.map(entry => {
      for (const name of entry.names) {
        if (!monsters.has(name)) monsters.set(name, {
          id: name,
          name,
          naturalStars: 0,
          rosterGroup: entry.siegeCategory === "fourStar" ? "fourStar" : "unknown"
        });
      }
      const displaySample = entry.rankData.ALL || entry.rankData.G1 ||
        entry.rankData.G2 || entry.rankData.G3;
      const team = {
        leader: entry.names[0],
        members: entry.names.slice(1),
        battles: displaySample.battles,
        winRate: displaySample.winRate,
        rankData: entry.rankData,
        rankTablesProvided: entry.rankTablesProvided
      };
      if (entry.siegeCategory) team.siegeCategory = entry.siegeCategory;
      return team;
    });
    return validateDataset({
      title: "Rank-scoped " + (options.mode === "siege" ? "Siege" : "World Guild Battle") + " data",
      snapshot: options.snapshot,
      mode: options.mode,
      rankAware: true,
      rankTablesProvided: options.rankTablesProvided,
      monsters: Array.from(monsters.values()),
      teams,
      sourceTables: options.sourceTables,
      sourceTablesProvided: options.sourceTablesProvided
    });
  }

  function datasetFromCompleteJson(input) {
    if (!input || input.format !== "guild-defense-complete-siege-v1" || input.mode !== "siege" ||
        !input.fourStarTables || !input.allTables) {
      throw new Error("Expected a complete Siege JSON file with fourStarTables and allTables.");
    }
    const toPasteTables = (tables, label) => {
      if (!tables || typeof tables !== "object" || Array.isArray(tables) ||
          Object.keys(tables).some(rank => !RANKS.includes(rank))) {
        throw new Error(label + " must contain G1, G2, G3, and ALL arrays.");
      }
      return Object.fromEntries(RANKS.map(rank => {
        const rows = tables[rank] ?? [];
        if (!Array.isArray(rows)) throw new Error(label + " " + rank + " must be an array.");
        if (!rows.length) return [rank, ""];
        const records = rows.map((row, index) => {
          const names = row && row.names;
          const battles = Number(row && row.battles);
          const winRate = Number(row && row.winRate);
          const precision = row && row.precision;
          if (!Array.isArray(names) || names.length !== 3 ||
              names.some(name => typeof name !== "string" || !name.trim() || /[\t\r\n]/.test(name)) ||
              !Number.isSafeInteger(battles) || battles < 1 ||
              !Number.isFinite(winRate) || winRate < 0 || winRate > 100 ||
              !Number.isInteger(precision) || precision < 0 || precision > 4) {
            throw new Error(label + " " + rank + ", row " + (index + 1) + " is invalid.");
          }
          return [...names, String(battles), winRate.toFixed(precision)].join("\t");
        });
        return [rank, [
          "Monster Leader\tMonster 2\tMonster 3\tBattles\tWR%",
          ...records
        ].join("\n")];
      }));
    };
    return datasetFromRankPastedTables({
      mode: "siege",
      snapshot: input.snapshot,
      fourStarTables: toPasteTables(input.fourStarTables, "4-star tables"),
      allTables: toPasteTables(input.allTables, "All-defenses tables")
    });
  }

  function completeSiegeJson(datasetInput) {
    const dataset = validateDataset(datasetInput);
    if (dataset.mode !== "siege" || !dataset.rankAware) {
      throw new Error("Complete JSON export requires imported rank-aware Siege data.");
    }
    const sourceTables = dataset.sourceTables || { fourStar: {}, all: {} };
    const outputTables = category => Object.fromEntries(RANKS.map(rank => {
      const rows = sourceTables[category] && sourceTables[category][rank];
      if (rows) return [rank, rows.map(row => ({ ...row, names: row.names.slice() }))];
      const derived = [];
      for (const team of dataset.teams) {
        if ((category === "fourStar" && team.siegeCategory !== "fourStar") ||
            (category === "all" && team.siegeCategory !== "natFive")) continue;
        const sample = team.rankData && team.rankData[rank];
        if (sample) derived.push({
          names: [team.leader, ...team.memberIds],
          battles: sample.battles,
          winRate: sample.winRate,
          precision: sample.precision
        });
      }
      return [rank, derived];
    }));
    return {
      format: "guild-defense-complete-siege-v1",
      mode: "siege",
      snapshot: dataset.snapshot,
      fourStarTables: outputTables("fourStar"),
      allTables: outputTables("all")
    };
  }

  function pasteTeamKey(names) {
    return names[0].toLocaleLowerCase() + "|" + names.slice(1).map(name => name.toLocaleLowerCase()).sort().join("|");
  }

  function makePasteDataset(rows, title, snapshot, mode, fourStarMonsters) {
    const monsters = new Map();
    const teams = rows.map(team => {
      for (const name of team.names) {
        if (!monsters.has(name)) monsters.set(name, {
          id: name,
          name,
          naturalStars: 0,
          rosterGroup: fourStarMonsters && fourStarMonsters.has(name.toLocaleLowerCase()) ? "fourStar" : "unknown"
        });
      }
      const result = {
        leader: team.names[0],
        members: team.names.slice(1),
        battles: team.battles,
        winRate: team.winRate
      };
      if (mode === "siege") result.siegeCategory = team.siegeCategory;
      return result;
    });
    return {
      title,
      snapshot,
      mode,
      monsters: Array.from(monsters.values()),
      teams: validateDataset({ title, snapshot, monsters: Array.from(monsters.values()), teams })
        .teams.map(team => ({ leader: team.leader, members: team.memberIds, battles: team.battles,
          winRate: team.winRateBps / 100, siegeCategory: team.siegeCategory }))
    };
  }

  function normalizeRoster(dataset, roster) {
    const source = roster || {};
    const normalized = new Map();
    for (const monster of dataset.monsters) {
      const row = source[monster.id] || {};
      const owned = Number(row.owned || 0);
      const maxAdditional = Number(row.maxAdditional || 0);
      const maxCopies = row.maxCopies === undefined ? Infinity : Number(row.maxCopies);
      if (!Number.isInteger(owned) || owned < 0 || owned > 99 ||
          !Number.isInteger(maxAdditional) || maxAdditional < 0 || maxAdditional > 99 ||
          (maxCopies !== Infinity && (!Number.isInteger(maxCopies) || maxCopies < 0 || maxCopies > 99))) {
        throw new Error("Roster counts must be whole numbers between 0 and 99 (" + monster.name + ").");
      }
      normalized.set(monster.id, {
        owned,
        maxAdditional: monster.rosterGroup === "fourStar" ||
          (monster.naturalStars > 0 && monster.naturalStars < 5) ? maxAdditional : 0,
        maxCopies
      });
    }
    return normalized;
  }

  function makeGroups(dataset, mode, requirements) {
    const allTeams = dataset.teams.map(team => {
      const stars = team.memberIds.concat(team.leader).map(id =>
        dataset.monsters.find(monster => monster.id === id).naturalStars);
      return { ...team, isNatFive: stars.some(value => value === 5), isFourStarOnly: stars.every(value => value > 0 && value <= 4) };
    });
    if (mode === "wgb") {
      return [{ key: "any", count: requirements && requirements.any !== undefined ? requirements.any : 5,
        teams: allTeams }];
    }
    if (mode !== "siege") throw new Error("Unknown battle type.");
    return [
      { key: "fourStar", count: requirements && requirements.fourStar !== undefined ? requirements.fourStar : 4,
        teams: allTeams.filter(team => team.siegeCategory ? team.siegeCategory === "fourStar" : team.isFourStarOnly) },
      { key: "natFive", count: requirements && requirements.natFive !== undefined ? requirements.natFive : 6,
        teams: allTeams.filter(team => team.siegeCategory ? team.siegeCategory === "natFive" : team.isNatFive) }
    ];
  }

  function objectiveBps(dataset, team) {
    return dataset.rankAware ? team.portfolioEvidence && team.portfolioEvidence.scoreBps : team.winRateBps;
  }

  function solve(datasetInput, rosterInput, mode, budget, options) {
    const dataset = validateDataset(datasetInput);
    if (!Number.isInteger(budget) || budget < 0) throw new Error("The extra-copy budget must be a non-negative whole number.");
    const opts = options || {};
    const roster = normalizeRoster(dataset, rosterInput);
    const groups = makeGroups(dataset, mode, opts.requirements);
    for (const group of groups) {
      if (!Number.isInteger(group.count) || group.count < 0) throw new Error("Team requirements must be non-negative whole numbers.");
      group.teams = group.teams.filter(team =>
        team.memberIds.concat(team.leader).every(id => roster.get(id).owned > 0) &&
        (!dataset.rankAware || Number.isInteger(objectiveBps(dataset, team))));
      group.teams.sort((a, b) =>
        objectiveBps(dataset, b) - objectiveBps(dataset, a) || a.id.localeCompare(b.id));
      if (group.count && !group.teams.length) {
        return { status: "infeasible", reason: "No eligible teams for the " + group.key + " category.",
          teams: [], totalWinRateBps: 0, averageWinRate: 0, additionalCopies: {}, additionalCopyCount: 0, nodes: 0 };
      }
    }

    const usage = new Map();
    const selected = groups.map(() => []);
    const allowDuplicateTeams = opts.allowDuplicateTeams === true;
    let best = null;
    let nodes = 0;
    let timedOut = false;
    const start = Date.now();
    const deadline = start + (Number.isFinite(opts.timeLimitMs) ? opts.timeLimitMs : 1200);
    const nodeLimit = Number.isInteger(opts.nodeLimit) ? opts.nodeLimit : 1500000;

    function copyDelta(team, direction) {
      const ids = team.memberIds.concat(team.leader);
      if (direction > 0 && ids.some(id => (usage.get(id) || 0) + 1 >
          Math.min(roster.get(id).owned + roster.get(id).maxAdditional, roster.get(id).maxCopies))) return null;
      const added = ids.reduce((sum, id) => {
        const previous = usage.get(id) || 0;
        return sum + (direction > 0
          ? ((previous + 1 > roster.get(id).owned) ? 1 : 0)
          : (previous > roster.get(id).owned ? -1 : 0));
      }, 0);
      for (const id of ids) {
        const next = (usage.get(id) || 0) + direction;
        if (next === 0) usage.delete(id);
        else usage.set(id, next);
      }
      return added;
    }

    function maxTeamUses(team) {
      let uses = allowDuplicateTeams ? Infinity : 1;
      for (const id of team.memberIds.concat(team.leader)) {
        const stock = roster.get(id);
        const capacity = Math.min(stock.owned + stock.maxAdditional, stock.maxCopies);
        uses = Math.min(uses, capacity - (usage.get(id) || 0));
      }
      return Math.max(0, uses);
    }

    function scoreCeiling(groupIndex, startIndex, countAlready, score) {
      let ceiling = score;
      for (let i = groupIndex; i < groups.length; i++) {
        const group = groups[i];
        const remaining = group.count - (i === groupIndex ? countAlready : 0);
        if (!remaining) continue;
        const index = i === groupIndex ? startIndex : 0;
        const candidateScores = [];
        for (let teamIndex = index; teamIndex < group.teams.length; teamIndex++) {
          const team = group.teams[teamIndex];
          const uses = Math.min(remaining, maxTeamUses(team));
          for (let use = 0; use < uses; use++) candidateScores.push(objectiveBps(dataset, team));
        }
        candidateScores.sort((a, b) => b - a);
        if (candidateScores.length < remaining) return -Infinity;
        for (let rank = 0; rank < remaining; rank++) ceiling += candidateScores[rank];
      }
      return ceiling;
    }

    function visit(groupIndex, countAlready, startIndex, score, extraCopies) {
      nodes++;
      if ((nodes & 127) === 0 && (nodes >= nodeLimit || Date.now() >= deadline)) {
        timedOut = true;
        return;
      }
      if (groupIndex === groups.length) {
        const choice = selected.flat();
        const key = choice.map(team => team.id).join(";");
        if (!best || score > best.score ||
            (score === best.score && extraCopies < best.extraCopies) ||
            (score === best.score && extraCopies === best.extraCopies && key < best.key)) {
          best = { score, extraCopies, key, choice: selected.map(group => group.slice()) };
        }
        return;
      }
      const group = groups[groupIndex];
      if (countAlready === group.count) {
        visit(groupIndex + 1, 0, 0, score, extraCopies);
        return;
      }
      const upperBound = scoreCeiling(groupIndex, startIndex, countAlready, score);
      if (upperBound === -Infinity || (best && upperBound < best.score)) return;

      for (let i = startIndex; i < group.teams.length; i++) {
        if (timedOut) return;
        const team = group.teams[i];
        const repeatLimit = Math.min(group.count - countAlready, maxTeamUses(team));
        for (let repeat = 0; repeat < repeatLimit; repeat++) {
          if (timedOut) return;
          const added = copyDelta(team, 1);
          if (added === null || extraCopies + added > budget) {
            if (added !== null) copyDelta(team, -1);
            break;
          }
          selected[groupIndex].push(team);
          const nextIndex = allowDuplicateTeams ? i : i + 1;
          visit(groupIndex, countAlready + 1, nextIndex,
            score + objectiveBps(dataset, team), extraCopies + added);
          selected[groupIndex].pop();
          copyDelta(team, -1);
        }
      }
    }

    visit(0, 0, 0, 0, 0);
    if (!best) {
      return { status: timedOut ? "timed_out" : "infeasible",
        reason: timedOut ? "Search limit reached before a feasible portfolio was found." : "No portfolio satisfies the roster and copy budget.",
        teams: [], totalWinRateBps: 0, averageWinRate: 0, additionalCopies: {}, additionalCopyCount: 0, nodes };
    }

    const finalUsage = new Map();
    for (const team of best.choice.flat()) {
      for (const id of team.memberIds.concat(team.leader)) finalUsage.set(id, (finalUsage.get(id) || 0) + 1);
    }
    const copies = {};
    for (const [id, count] of finalUsage) {
      const stock = roster.get(id);
      if (count > stock.owned) copies[id] = count - stock.owned;
    }
    const teamCount = best.choice.reduce((sum, group) => sum + group.length, 0);
    return {
      status: timedOut ? "timed_out" : "optimal",
      reason: timedOut ? "Best portfolio found before the search limit; optimality is not proven." : "",
      groups: groups.map((group, index) => ({ key: group.key, teams: best.choice[index] })),
      teams: best.choice.flat(),
      totalWinRateBps: best.score,
      averageWinRate: teamCount ? best.score / (teamCount * 100) : 0,
      additionalCopies: copies,
      additionalCopyCount: Object.values(copies).reduce((sum, count) => sum + count, 0),
      nodes
    };
  }

  function solveClosest(datasetInput, rosterInput, mode, budget, options) {
    if (mode !== "siege") return solve(datasetInput, rosterInput, mode, budget, options);
    const opts = options || {};
    const dataset = validateDataset(datasetInput);
    const requested = opts.requirements || {};
    const wantedFour = requested.fourStar === undefined ? 4 : requested.fourStar;
    const wantedNatFive = requested.natFive === undefined ? 6 : requested.natFive;
    if (!Number.isInteger(wantedFour) || wantedFour < 0 ||
        !Number.isInteger(wantedNatFive) || wantedNatFive < 0 ||
        wantedFour + wantedNatFive > 10) {
      throw new Error("Requested Siege defenses must be non-negative whole numbers with a combined maximum of 10.");
    }
    if (dataset.rankAware && !dataset.teams.some(team =>
      Number.isInteger(objectiveBps(dataset, team)))) {
      return {
        status: "infeasible",
        reason: "No defense has eligible G1, G2, or G3 evidence.",
        teams: [],
        groups: [],
        totalWinRateBps: 0,
        averageWinRate: 0,
        additionalCopies: {},
        additionalCopyCount: 0,
        nodes: 0,
        requested: { fourStar: wantedFour, natFive: wantedNatFive }
      };
    }

    let timedOut = false;
    const started = Date.now();
    const maxTime = Number.isFinite(opts.timeLimitMs) ? opts.timeLimitMs : 5000;
    for (let total = wantedFour + wantedNatFive; total >= 0; total--) {
      const allocations = [];
      const minFour = Math.max(0, total - wantedNatFive);
      const maxFour = Math.min(wantedFour, total);
      for (let four = minFour; four <= maxFour; four++) {
        allocations.push({ four, natFive: total - four });
      }
      allocations.sort((a, b) =>
        Math.abs(a.four - wantedFour) - Math.abs(b.four - wantedFour) ||
        Math.abs(a.natFive - wantedNatFive) - Math.abs(b.natFive - wantedNatFive) ||
        b.four - a.four);

      let best = null;
      for (const allocation of allocations) {
        const remaining = maxTime - (Date.now() - started);
        if (remaining <= 0) {
          timedOut = true;
          break;
        }
        const result = solve(datasetInput, rosterInput, mode, budget, {
          ...opts,
          timeLimitMs: Math.max(1, Math.min(remaining, opts.perAllocationTimeMs || 750)),
          requirements: { fourStar: allocation.four, natFive: allocation.natFive }
        });
        if (result.status === "timed_out") timedOut = true;
        const distance = Math.abs(allocation.four - wantedFour) + Math.abs(allocation.natFive - wantedNatFive);
        if (result.teams.length && (!best || distance < best.distance ||
            (distance === best.distance && result.totalWinRateBps > best.totalWinRateBps) ||
            (distance === best.distance && result.totalWinRateBps === best.totalWinRateBps &&
              result.additionalCopyCount < best.additionalCopyCount))) {
          best = { ...result, distance, requested: { fourStar: wantedFour, natFive: wantedNatFive } };
        }
      }
      if (best) {
        best.status = timedOut ? "timed_out" : "optimal";
        best.reason = timedOut ? "Closest portfolio found before the search limit; optimality is not proven." : "";
        return best;
      }
    }
    if (timedOut) {
      return { status: "timed_out", reason: "Search limit reached before a portfolio was found.",
        teams: [], groups: [], totalWinRateBps: 0, averageWinRate: 0, additionalCopies: {},
        additionalCopyCount: 0, nodes: 0, requested: { fourStar: wantedFour, natFive: wantedNatFive } };
    }
    return { status: "infeasible", reason: "No teams fit the available monsters and copy limits.",
      teams: [], groups: [], totalWinRateBps: 0, averageWinRate: 0, additionalCopies: {},
      additionalCopyCount: 0, nodes: 0, requested: { fourStar: wantedFour, natFive: wantedNatFive } };
  }

  function suggestFillTeams(datasetInput, result, rosterInput, targetCount, budget, options) {
    const dataset = validateDataset(datasetInput);
    const roster = normalizeRoster(dataset, rosterInput);
    const opts = options || {};
    const usage = new Map();
    for (const team of result.teams) {
      for (const id of [team.leader, ...team.memberIds]) usage.set(id, (usage.get(id) || 0) + 1);
    }
    const selectedIds = new Set(result.teams.map(team => team.id));
    let extraBuilds = result.additionalCopyCount || 0;
    const suggestions = [];
    const candidates = dataset.teams.filter(team =>
      !dataset.rankAware || Number.isInteger(objectiveBps(dataset, team))).sort((a, b) =>
      objectiveBps(dataset, b) - objectiveBps(dataset, a) || a.id.localeCompare(b.id));
    while (result.teams.length + suggestions.length < targetCount) {
      const next = candidates.find(team => {
        if (dataset.mode === "siege" && !team.siegeCategory) return false;
        if (dataset.rankAware && !Number.isInteger(objectiveBps(dataset, team))) return false;
        if (opts.allowDuplicateTeams !== true && selectedIds.has(team.id)) return false;
        let neededBuilds = 0;
        for (const id of [team.leader, ...team.memberIds]) {
          const stock = roster.get(id);
          const nextUsage = (usage.get(id) || 0) + 1;
          if (nextUsage > stock.owned + stock.maxAdditional ||
              (stock.maxCopies !== Infinity && nextUsage > stock.maxCopies)) return false;
          if (nextUsage > stock.owned) neededBuilds++;
        }
        return extraBuilds + neededBuilds <= budget;
      });
      if (!next) break;
      for (const id of [next.leader, ...next.memberIds]) {
        const nextUsage = (usage.get(id) || 0) + 1;
        usage.set(id, nextUsage);
        if (nextUsage > roster.get(id).owned) extraBuilds++;
      }
      selectedIds.add(next.id);
      suggestions.push(next);
    }
    return suggestions;
  }

  const api = {
    validateDataset,
    parsePasteTable,
    datasetFromPastedTables,
    datasetFromRankPastedTables,
    datasetFromCompleteJson,
    completeSiegeJson,
    wilsonInterval,
    makeG1Evidence,
    solve,
    solveClosest,
    suggestFillTeams
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GuildDefenseOptimizer = api;
})(typeof self !== "undefined" ? self : globalThis);
