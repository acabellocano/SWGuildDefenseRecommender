(function (root) {
  "use strict";

  function validateDataset(input) {
    if (!input || typeof input !== "object" || !Array.isArray(input.monsters) || !Array.isArray(input.teams)) {
      throw new Error("Expected JSON with monsters and teams arrays.");
    }
    const monsters = new Map();
    for (const monster of input.monsters) {
      if (!monster || typeof monster.id !== "string" || !monster.id.trim() ||
          typeof monster.name !== "string" || !monster.name.trim() ||
          !Number.isInteger(monster.naturalStars) || monster.naturalStars < 1 || monster.naturalStars > 5) {
        throw new Error("Each monster needs a non-empty id and name, and naturalStars from 1 to 5.");
      }
      if (monsters.has(monster.id)) throw new Error("Duplicate monster id: " + monster.id);
      monsters.set(monster.id, { id: monster.id, name: monster.name, naturalStars: monster.naturalStars });
    }
    const teams = [];
    const seen = new Set();
    for (const team of input.teams) {
      if (!team || typeof team.leader !== "string" || !Array.isArray(team.members) ||
          team.members.length !== 2 || team.members.some(id => typeof id !== "string")) {
        throw new Error("Each team needs a leader and exactly two member ids.");
      }
      const ids = [team.leader, ...team.members];
      if (new Set(ids).size !== 3) throw new Error("A team cannot use the same monster more than once.");
      for (const id of ids) if (!monsters.has(id)) throw new Error("Team refers to unknown monster id: " + id);
      const winRate = Number(team.winRate);
      const battles = Number(team.battles);
      if (!Number.isFinite(winRate) || winRate < 0 || winRate > 100 ||
          !Number.isInteger(battles) || battles < 1) {
        throw new Error("Each team needs a winRate from 0 to 100 and a positive integer battles count.");
      }
      const teamId = team.leader + "|" + team.members.slice().sort().join("|");
      if (seen.has(teamId)) throw new Error("Duplicate team observation: " + teamId);
      seen.add(teamId);
      teams.push({
        id: teamId,
        leader: team.leader,
        memberIds: team.members.slice(),
        winRateBps: Math.round(winRate * 100),
        battles
      });
    }
    if (!teams.length) throw new Error("The dataset must include at least one team.");
    return {
      title: typeof input.title === "string" ? input.title : "Imported candidate data",
      snapshot: typeof input.snapshot === "string" ? input.snapshot : "Snapshot not specified",
      monsters: Array.from(monsters.values()),
      teams
    };
  }

  function normalizeRoster(dataset, roster) {
    const source = roster || {};
    const normalized = new Map();
    for (const monster of dataset.monsters) {
      const row = source[monster.id] || {};
      const owned = Number(row.owned || 0);
      const maxAdditional = Number(row.maxAdditional || 0);
      if (!Number.isInteger(owned) || owned < 0 || owned > 99 ||
          !Number.isInteger(maxAdditional) || maxAdditional < 0 || maxAdditional > 99) {
        throw new Error("Roster counts must be whole numbers between 0 and 99 (" + monster.name + ").");
      }
      normalized.set(monster.id, {
        owned: monster.naturalStars === 5 ? Math.min(owned, 1) : owned,
        maxAdditional: monster.naturalStars === 5 ? 0 : maxAdditional
      });
    }
    return normalized;
  }

  function makeGroups(dataset, mode, requirements) {
    const allTeams = dataset.teams.map(team => {
      const stars = team.memberIds.concat(team.leader).map(id =>
        dataset.monsters.find(monster => monster.id === id).naturalStars);
      return { ...team, isNatFive: stars.some(value => value === 5), isFourStarOnly: stars.every(value => value <= 4) };
    });
    if (mode === "wgb") {
      return [{ key: "any", count: requirements && requirements.any !== undefined ? requirements.any : 5,
        teams: allTeams }];
    }
    if (mode !== "siege") throw new Error("Unknown battle type.");
    return [
      { key: "fourStar", count: requirements && requirements.fourStar !== undefined ? requirements.fourStar : 4,
        teams: allTeams.filter(team => team.isFourStarOnly) },
      { key: "natFive", count: requirements && requirements.natFive !== undefined ? requirements.natFive : 6,
        teams: allTeams.filter(team => team.isNatFive) }
    ];
  }

  function solve(datasetInput, rosterInput, mode, budget, options) {
    const dataset = validateDataset(datasetInput);
    if (!Number.isInteger(budget) || budget < 0) throw new Error("The extra-copy budget must be a non-negative whole number.");
    const opts = options || {};
    const roster = normalizeRoster(dataset, rosterInput);
    const groups = makeGroups(dataset, mode, opts.requirements);
    for (const group of groups) {
      if (!Number.isInteger(group.count) || group.count < 0) throw new Error("Team requirements must be non-negative whole numbers.");
      group.teams = group.teams.filter(team => team.memberIds.concat(team.leader).every(id => roster.get(id).owned > 0));
      group.teams.sort((a, b) => b.winRateBps - a.winRateBps || a.id.localeCompare(b.id));
      if (group.count && !group.teams.length) {
        return { status: "infeasible", reason: "No eligible teams for the " + group.key + " category.",
          teams: [], totalWinRateBps: 0, averageWinRate: 0, additionalCopies: {}, additionalCopyCount: 0, nodes: 0 };
      }
    }

    const usage = new Map();
    const selected = groups.map(() => []);
    let best = null;
    let nodes = 0;
    let timedOut = false;
    const start = Date.now();
    const deadline = start + (Number.isFinite(opts.timeLimitMs) ? opts.timeLimitMs : 1200);
    const nodeLimit = Number.isInteger(opts.nodeLimit) ? opts.nodeLimit : 1500000;

    function copyDelta(team, direction) {
      const ids = team.memberIds.concat(team.leader);
      if (direction > 0 && ids.some(id => (usage.get(id) || 0) + 1 >
          roster.get(id).owned + roster.get(id).maxAdditional)) return null;
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

    function scoreCeiling(groupIndex, startIndex, countAlready, score) {
      let ceiling = score;
      for (let i = groupIndex; i < groups.length; i++) {
        const group = groups[i];
        const remaining = group.count - (i === groupIndex ? countAlready : 0);
        if (!remaining) continue;
        const index = i === groupIndex ? startIndex : 0;
        if (index >= group.teams.length) return -Infinity;
        ceiling += remaining * group.teams[index].winRateBps;
      }
      return ceiling;
    }

    function visit(groupIndex, countAlready, startIndex, score, extraCopies) {
      nodes++;
      if ((nodes & 511) === 0 && (nodes >= nodeLimit || Date.now() >= deadline)) {
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
      if (best && scoreCeiling(groupIndex, startIndex, countAlready, score) < best.score) return;

      for (let i = startIndex; i < group.teams.length; i++) {
        if (timedOut) return;
        const team = group.teams[i];
        const added = copyDelta(team, 1);
        if (added === null || extraCopies + added > budget) {
          if (added !== null) copyDelta(team, -1);
          continue;
        }
        selected[groupIndex].push(team);
        visit(groupIndex, countAlready + 1, i, score + team.winRateBps, extraCopies + added);
        selected[groupIndex].pop();
        copyDelta(team, -1);
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

  const api = { validateDataset, solve };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GuildDefenseOptimizer = api;
})(typeof self !== "undefined" ? self : globalThis);
