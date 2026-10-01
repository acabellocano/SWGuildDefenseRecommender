(function () {
  "use strict";

  const STORAGE_KEY = "guild-defense-optimizer-v2";

  const $ = selector => document.querySelector(selector);
  const notice = $("#notice");
  let state;

  function showNotice(message, isError) {
    notice.textContent = message;
    notice.className = "notice " + (isError ? "error" : "success");
  }

  function initializeTheme() {
    const select = $("#theme-select");
    let theme = "system";
    try {
      const saved = localStorage.getItem("guild-defense-optimizer-theme");
      if (["system", "light", "dark"].includes(saved)) theme = saved;
    } catch (error) {
      showNotice("Could not load your appearance preference: " + error.message, true);
    }
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = value => {
      document.documentElement.dataset.theme = value;
      document.documentElement.dataset.colorScheme =
        value === "system" ? (systemTheme.matches ? "dark" : "light") : value;
    };
    applyTheme(theme);
    select.value = theme;
    systemTheme.addEventListener("change", () => {
      if (select.value === "system") applyTheme("system");
    });
    select.addEventListener("change", () => {
      applyTheme(select.value);
      try {
        localStorage.setItem("guild-defense-optimizer-theme", select.value);
      } catch (error) {
        showNotice("Could not save your appearance preference: " + error.message, true);
      }
    });
  }

  function makeSolverRoster(copyCap) {
    return Object.fromEntries(state.dataset.monsters.map(monster => {
      const copies = state.copies[monster.id] ?? 1;
      if (state.mode === "wgb") {
        const owned = copies > 0 ? 1 : 0;
        return [monster.id, { owned, maxAdditional: 0, maxCopies: owned }];
      }
      if (monster.rosterGroup === "fourStar" && copies > 0) {
        return [monster.id, {
          owned: copies,
          maxAdditional: Math.max(0, copyCap - copies),
          maxCopies: copyCap
        }];
      }
      return [monster.id, { owned: copies, maxAdditional: 0, maxCopies: copies }];
    }));
  }

  function save() {
    try {
      state.copiesByMode[state.mode] = state.copies;
      if (state.dataset) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      showNotice("Could not save in this browser: " + error.message, true);
    }
  }

  function renderInfeasibility(result, diagnostic) {
    const section = document.createElement("div");
    section.className = "infeasibility";
    if (diagnostic) {
      section.append(makeCell("h3", "Copies needed for options to appear"));
      section.append(makeCell("p", "This portfolio becomes feasible at " + diagnostic.cap +
        " copies per available 4★/lower monster. Additional copies to build: " +
        formatCopies(diagnostic.result.additionalCopies) + ".", "result-summary"));
      section.append(makeCell("p", "Select the " + diagnostic.cap + "-copy tab to see that portfolio.", "hint"));
      return section;
    }
    const missing = mostBlockingUnavailableMonsters();
    section.append(makeCell("h3", "What is blocking a complete portfolio?"));
    if (result.status === "timed_out") {
      section.append(makeCell("p", "The optimizer hit its search limit before it found a complete portfolio. Try a higher copy tab or adjust availability, then optimize again.", "result-summary"));
      return section;
    }
    if (state.dataset.rankAware && !state.dataset.teams.some(team =>
      Number.isInteger(team.g1Evidence && team.g1Evidence.scoreBps))) {
      section.append(makeCell("p", "No defense has measured or uniquely reconstructible G1 evidence. Import the matching G1, G2, G3, and ALL tables, or add direct G1 samples. Candidates with unknown G1 performance are not assigned an ALL-rank substitute.", "result-summary"));
      return section;
    }
    if (missing.length) {
      section.append(makeCell("p", "These unavailable monsters block the most candidate teams: " +
        missing.map(item => item.name + " (" + item.teams + ")").join(", ") + ".", "result-summary"));
    }
    if (state.mode === "siege" && state.copyCap < 5) {
      section.append(makeCell("p", "No complete portfolio was found through the 5-copy limit. Check missing monsters or enter more usable copies.", "hint"));
    } else {
      section.append(makeCell("p", "No complete portfolio fits the available monsters and copy counts. Restore a missing monster or increase its copy count if you own duplicates.", "hint"));
    }
    return section;
  }

  function mostBlockingUnavailableMonsters() {
    const totals = new Map();
    for (const team of state.dataset.teams) {
      if (state.mode === "siege" && !team.siegeCategory) continue;
      for (const id of new Set([team.leader, ...team.memberIds])) {
        if ((state.copies[id] ?? 1) === 0) totals.set(id, (totals.get(id) || 0) + 1);
      }
    }
    return Array.from(totals, ([id, teams]) => ({
      id,
      teams,
      name: state.dataset.monsters.find(monster => monster.id === id).name
    })).sort((a, b) => b.teams - a.teams || a.name.localeCompare(b.name)).slice(0, 8);
  }

  function formatCopies(copies) {
    const entries = Object.entries(copies);
    if (!entries.length) return "none";
    return entries.map(([id, count]) =>
      state.dataset.monsters.find(monster => monster.id === id).name + " +" + count).join(", ");
  }

  function initializeCopies(dataset, copies) {
    const initialized = copies || {};
    if (!dataset) return initialized;
    for (const monster of dataset.monsters) {
      if (initialized[monster.id] === undefined) initialized[monster.id] = 1;
    }
    return initialized;
  }

  function selectMode(mode) {
    state.mode = mode;
    state.dataset = state.datasets[mode];
    state.copies = initializeCopies(state.dataset, state.copiesByMode[mode]);
    state.copiesByMode[mode] = state.copies;
  }

  function confidenceText(value) {
    return value.toFixed(2) + "%";
  }

  function rankEvidenceText(team) {
    const evidence = team.g1Evidence;
    if (!evidence) return "—";
    const parts = evidence.status === "unknown"
      ? ["G1 unknown"]
      : ["G1 " + confidenceText(evidence.winRate) + " / " +
        evidence.battles.toLocaleString() + " (" + evidence.status + ")"];
    if (evidence.status === "measured" && evidence.wilson95) {
      parts.push("95% Wilson " + confidenceText(evidence.wilson95.lower) +
        "–" + confidenceText(evidence.wilson95.upper));
      parts.push("conservative score " + confidenceText(evidence.conservativeRate));
    } else if (evidence.status === "inferred") {
      parts.push("rounding range " + confidenceText(evidence.roundingRange.lower) +
        "–" + confidenceText(evidence.roundingRange.upper));
      parts.push("conservative score " + confidenceText(evidence.conservativeRate));
    }
    if (evidence.confidence) parts.push("sample support " + evidence.confidence);
    for (const rank of ["G2", "G3", "ALL"]) {
      const sample = team.rankData && team.rankData[rank];
      if (sample) parts.push(rank + " " + confidenceText(sample.winRate) +
        " / " + sample.battles.toLocaleString());
    }
    const g2 = team.rankData && team.rankData.G2;
    const g3 = team.rankData && team.rankData.G3;
    if (evidence.status !== "unknown" && g2) {
      parts.push("G1→G2 " + (g2.winRate - evidence.winRate).toFixed(2) + " pp (descriptive)");
    }
    if (evidence.status !== "unknown" && g3) {
      parts.push("G1→G3 " + (g3.winRate - evidence.winRate).toFixed(2) + " pp (descriptive)");
    }
    if (g2 && g3) parts.push("G2→G3 " + (g3.winRate - g2.winRate).toFixed(2) + " pp (descriptive)");
    return parts.join(" · ");
  }

  function initialize() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && (saved.datasets || saved.dataset)) {
        const datasets = { siege: null, wgb: null };
        if (saved.datasets) {
          for (const mode of ["siege", "wgb"]) {
            if (saved.datasets[mode]) datasets[mode] = GuildDefenseOptimizer.validateDataset(saved.datasets[mode]);
          }
        } else {
          const mode = saved.dataset.mode || saved.mode || "siege";
          datasets[mode] = GuildDefenseOptimizer.validateDataset(saved.dataset);
        }
        const mode = saved.mode === "wgb" && datasets.wgb ? "wgb" : datasets.siege ? "siege" : "wgb";
        const copiesByMode = saved.copiesByMode && typeof saved.copiesByMode === "object" &&
          !Array.isArray(saved.copiesByMode) ? saved.copiesByMode : {};
        if (!saved.copiesByMode && saved.copies) copiesByMode[mode] = saved.copies;
        copiesByMode.siege = copiesByMode.siege || {};
        copiesByMode.wgb = copiesByMode.wgb || {};
        const copies = initializeCopies(datasets[mode], copiesByMode[mode]);
        copiesByMode[mode] = copies;
        state = { datasets, dataset: datasets[mode], copies, copiesByMode, cleanedLabels: saved.cleanedLabels || 0,
          copyCap: [1, 2, 3, 4, 5].includes(saved.copyCap) ? saved.copyCap : 1,
          allowDuplicateTeams: saved.allowDuplicateTeams === true,
          requestedFour: saved.requestedFour ?? 4, requestedNatFive: saved.requestedNatFive ?? 6,
          activeStep: ["intro", "import", "data", "optimize"].includes(saved.activeStep) ? saved.activeStep : "intro", mode };
      } else state = { datasets: { siege: null, wgb: null }, dataset: null, copies: {}, copiesByMode: { siege: {}, wgb: {} }, cleanedLabels: 0, copyCap: 1,
        allowDuplicateTeams: false, requestedFour: 4, requestedNatFive: 6, activeStep: "intro", mode: "siege" };
    } catch (error) {
      state = { datasets: { siege: null, wgb: null }, dataset: null, copies: {}, copiesByMode: { siege: {}, wgb: {} }, cleanedLabels: 0, copyCap: 1,
        allowDuplicateTeams: false, requestedFour: 4, requestedNatFive: 6, activeStep: "intro", mode: "siege" };
      showNotice("Saved data could not be loaded. Paste the tables again. " + error.message, true);
    }
    render();
  }

  function renderRoster() {
    const body = $("#roster");
    body.replaceChildren();
    if (!state.dataset) return;
    const appearances = new Map(state.dataset.monsters.map(monster =>
      [monster.id, { count: 0, winRateTotal: 0, ratedCount: 0 }]));
    for (const team of state.dataset.teams) {
      for (const id of [team.leader, ...team.memberIds]) {
        const stats = appearances.get(id);
        stats.count++;
        const rate = state.dataset.rankAware
          ? team.g1Evidence && team.g1Evidence.winRate
          : team.winRateBps / 100;
        if (Number.isFinite(rate)) {
          stats.winRateTotal += rate;
          stats.ratedCount++;
        }
      }
    }
    const monsters = state.dataset.monsters.map(monster => ({
      ...monster,
      stats: appearances.get(monster.id)
    })).sort((a, b) =>
      (state.mode === "siege" ? (a.rosterGroup === "fourStar" ? 1 : 0) -
        (b.rosterGroup === "fourStar" ? 1 : 0) : 0) ||
      b.stats.count - a.stats.count ||
      (b.stats.winRateTotal / (b.stats.ratedCount || 1)) -
        (a.stats.winRateTotal / (a.stats.ratedCount || 1)) ||
      a.name.localeCompare(b.name));
    let renderedGroup = "";
    for (const monster of monsters) {
      const group = state.mode === "wgb" ? "all" :
        monster.rosterGroup === "fourStar" ? "fourStar" : "unknown";
      if (group !== renderedGroup) {
        renderedGroup = group;
        const heading = document.createElement("tr");
        heading.className = "group-row";
        heading.append(makeCell("th", group === "all" ? "World Guild Battle monsters" :
          group === "unknown" ? "5★ / unknown rarity" : "4★-or-lower monsters", null));
        const remainder = document.createElement("th");
        remainder.colSpan = state.mode === "siege" ? 4 : 3;
        heading.append(remainder);
        body.append(heading);
      }
      const tr = document.createElement("tr");
      const available = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = (state.copies[monster.id] ?? 1) > 0;
      checkbox.setAttribute("aria-label", "I have " + monster.name);
      checkbox.addEventListener("change", () => {
        state.copies[monster.id] = checkbox.checked ? 1 : 0;
        copies.value = String(state.copies[monster.id]);
        $("#results").replaceChildren();
        showNotice("Copy counts changed. Optimize again to refresh the portfolio.", false);
        save();
        updateAvailabilityCount();
        renderCandidateTables();
      });
      available.append(checkbox);
      const copiesCell = document.createElement("td");
      copiesCell.className = "copies-column";
      const copies = document.createElement("input");
      copies.type = "number";
      copies.min = "0";
      copies.max = "99";
      copies.step = "1";
      copies.value = String(state.copies[monster.id] ?? 1);
      copies.setAttribute("aria-label", "Available copies of " + monster.name);
      copies.addEventListener("change", () => {
        const count = Number(copies.value);
        if (!Number.isInteger(count) || count < 0 || count > 99) {
          showNotice("Copy counts must be whole numbers from 0 to 99.", true);
          copies.value = String(state.copies[monster.id] ?? 1);
          return;
        }
        state.copies[monster.id] = count;
        checkbox.checked = count > 0;
        $("#results").replaceChildren();
        showNotice("Copy counts changed. Optimize again to refresh the portfolio.", false);
        save();
        updateAvailabilityCount();
        renderCandidateTables();
      });
      copiesCell.append(copies);
      const name = document.createElement("td");
      name.textContent = monster.name;
      const count = monster.stats.count;
      const average = monster.stats.ratedCount
        ? monster.stats.winRateTotal / monster.stats.ratedCount : 0;
      name.dataset.monsterName = "true";
      tr.append(available);
      if (state.mode === "siege") tr.append(copiesCell);
      tr.append(name,
        makeCell("td", String(count)),
        makeCell("td", monster.stats.ratedCount ? average.toFixed(2) + "%" : "—"));
      body.append(tr);
    }
    $("#roster thead").replaceChildren();
    const header = document.createElement("tr");
    for (const label of ["Available", ...(state.mode === "siege" ? ["Copies"] : []),
      "Monster", "Defences", state.dataset.rankAware ? "Avg. G1 WR" : "Avg. WR"])
      header.append(makeCell("th", label));
    $("#roster").closest("table").querySelector("thead").replaceChildren(header);
    filterMonsterList();
    updateAvailabilityCount();
  }

  function render() {
    state.dataset = state.datasets[state.mode];
    for (const step of ["intro", "import", "data", "optimize"]) {
      const active = state.activeStep === step;
      $("#step-" + step).hidden = !active;
      $("#step-tab-" + step).setAttribute("aria-selected", String(active));
    }
    $("#choose-siege").setAttribute("aria-pressed", String(state.mode === "siege"));
    $("#choose-wgb").setAttribute("aria-pressed", String(state.mode === "wgb"));
    $("#import-mode-title").textContent = state.mode === "siege" ? "Siege" : "World Guild Battle";
    $("#siege-rank-import").hidden = state.mode !== "siege";
    $("#wgb-rank-import").hidden = state.mode !== "wgb";
    $("#legacy-siege-import").hidden = state.mode !== "siege";
    $("#legacy-wgb-import").hidden = state.mode !== "wgb";
    $("#optimize").disabled = !state.dataset;
    $("#mode-description").textContent = state.dataset && state.dataset.rankAware
      ? "Rank-aware mode selects only defenses with measured or uniquely reconstructed G1 evidence, using a conservative Wilson-based score. Unrecoverable G1 evidence remains visible for discovery but is excluded from the portfolio."
      : state.mode === "siege"
        ? "Choose up to ten defenses across the 4-star and all-defenses remainder categories."
        : "Builds five defenses from the World Guild Battle list, without a rarity split.";
    $("#settings-description").textContent = state.mode === "siege"
      ? "Siege defenses are separated into 4-star and all-defenses remainder categories."
      : "World Guild Battle uses one defense list, without a monster-rarity split.";
    $("#roster-description").textContent = state.mode === "siege"
      ? "5★/unknown monsters appear first, then 4★-or-lower monsters. Within each group, most-used monsters appear first."
      : "World Guild Battle uses one copy per monster; the list is ordered by defense appearances.";
    $("#siege-counts").hidden = state.mode !== "siege";
    $("#remainder-label").textContent = state.dataset && state.dataset.rankAware
      ? "All-defenses remainder" : "5★ / all-defenses remainder";
    $("#requested-four-star").value = String(state.requestedFour);
    $("#requested-nat-five").value = String(state.requestedNatFive);
    document.querySelectorAll("[data-copy-cap]").forEach(button => {
      button.hidden = !state.dataset || state.mode !== "siege";
      button.setAttribute("aria-pressed", String(Number(button.dataset.copyCap) === (state.copyCap || 1)));
      button.classList.toggle("selected", Number(button.dataset.copyCap) === (state.copyCap || 1));
    });
    $("#copy-tabs").hidden = !state.dataset || state.mode !== "siege";
    $("#duplicate-team-option").hidden = !state.dataset || state.mode !== "siege";
    $("#allow-duplicate-teams").checked = state.allowDuplicateTeams;
    $("#availability-panel").hidden = !state.dataset;
    $("#roster-copy-hint").hidden = state.mode !== "siege";
    renderCandidateTables();
    renderRoster();
    save();
  }

  function renderCandidateTables() {
    const siege = state.mode === "siege" ? state.datasets.siege : null;
    const wgb = state.mode === "wgb" ? state.datasets.wgb : null;
    const fourStar = siege ? siege.teams.filter(team => team.siegeCategory === "fourStar") : [];
    const natFive = siege ? siege.teams.filter(team => team.siegeCategory === "natFive") : [];
    const wgbTeams = wgb ? wgb.teams : [];
    $("#candidate-summary").textContent =
      (siege ? fourStar.length + " Siege 4-star + " + natFive.length + " all-defenses remainder" :
        wgb ? wgbTeams.length + " World Guild Battle defenses" : state.mode + " data not imported") +
      (siege && siege.rankAware ? " · G1-evaluable: " +
        siege.teams.filter(team => team.g1Evidence && team.g1Evidence.scoreBps !== undefined).length +
        " · inferred: " + siege.teams.filter(team => team.g1Evidence && team.g1Evidence.status === "inferred").length +
        " · unknown G1 excluded from ranked portfolios" : "") +
      (state.cleanedLabels ? " · " + state.cleanedLabels + " doubled labels cleaned." : ".");
    $("#four-star-table-section").hidden = state.mode !== "siege";
    $("#nat-five-table-section").hidden = state.mode !== "siege";
    $("#wgb-table-section").hidden = state.mode !== "wgb";
    $("#four-star-table-section").classList.toggle("empty-table", !siege);
    $("#nat-five-table-section").classList.toggle("empty-table", !siege);
    $("#wgb-table-section").classList.toggle("empty-table", !wgb);
    renderDefenseTable("#four-star-teams", fourStar, siege);
    renderDefenseTable("#nat-five-teams", natFive, siege);
    renderDefenseTable("#wgb-teams", wgbTeams, wgb);
  }

  function renderDefenseTable(selector, teams, dataset) {
    const body = $(selector);
    body.replaceChildren();
    const table = body.closest("table");
    if (!dataset) {
      table.querySelector("thead tr").replaceChildren(
        ...["Leader", "Monster 2", "Monster 3", "Battles", "WR%"].map(label => makeCell("th", label))
      );
      const row = document.createElement("tr");
      const emptyCell = makeCell("td", "No data imported yet.", "empty-table-message");
      emptyCell.colSpan = 5;
      row.append(emptyCell);
      body.append(row);
      return;
    }
    const header = table.querySelector("thead tr");
    const labels = ["Leader", "Monster 2", "Monster 3",
      dataset.rankAware ? "Source sample" : "Battles",
      dataset.rankAware ? "Source WR" : "WR%"];
    if (dataset.rankAware) labels.push("Rank evidence");
    header.replaceChildren(...labels.map(label => {
      const heading = makeCell("th", label);
      if (label === "Rank evidence") heading.className = "rank-evidence-column";
      return heading;
    }));
    const rankHeader = table.querySelector(".rank-evidence-column");
    if (rankHeader) rankHeader.hidden = !dataset.rankAware;
    if (!teams.length) {
      const row = document.createElement("tr");
      const emptyCell = makeCell("td", dataset.rankAware
        ? "No rank-scoped defenses in this category."
        : "No defenses in this category.", "empty-table-message");
      emptyCell.colSpan = labels.length;
      row.append(emptyCell);
      body.append(row);
      return;
    }
    const sortedTeams = teams.slice().sort((a, b) =>
      (dataset.rankAware ? (b.g1Evidence?.scoreBps ?? -1) - (a.g1Evidence?.scoreBps ?? -1) :
        b.winRateBps - a.winRateBps) ||
      b.battles - a.battles || a.id.localeCompare(b.id));
    for (const team of sortedTeams) {
      const row = document.createElement("tr");
      const names = [team.leader, ...team.memberIds].map(id =>
        dataset.monsters.find(monster => monster.id === id).name);
      for (const name of names) row.append(makeCell("td", name));
      const sourceRank = dataset.rankAware
        ? ["ALL", "G1", "G2", "G3"].find(rank => team.rankData && team.rankData[rank])
        : null;
      row.append(makeCell("td", dataset.rankAware
        ? (sourceRank || "—") + " · " + team.battles.toLocaleString()
        : team.battles.toLocaleString()));
      row.append(makeCell("td", (team.winRateBps / 100).toFixed(2) + "%"));
      if (dataset.rankAware) row.append(makeCell("td", rankEvidenceText(team), "rank-evidence-cell"));
      body.append(row);
    }
  }

  function filterMonsterList() {
    const term = $("#monster-search").value.trim().toLocaleLowerCase();
    for (const row of $("#roster").rows) {
      if (!row.classList.contains("group-row")) {
        row.hidden = !row.querySelector("[data-monster-name]").textContent.toLocaleLowerCase().includes(term);
      }
    }
  }

  function updateAvailabilityCount() {
    if (!state.dataset) return;
    const available = state.dataset.monsters.filter(monster => (state.copies[monster.id] ?? 1) > 0).length;
    $("#availability-count").textContent = available + " of " + state.dataset.monsters.length + " monsters available";
  }

  function makeCell(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderResult(result, diagnostic, suggestions) {
    const card = document.createElement("article");
    card.className = "result-card";
    const requestedTotal = result.requested ? result.requested.fourStar + result.requested.natFive : null;
    const partial = requestedTotal !== null && result.teams.length < requestedTotal;
    const statusText = partial ? "Closest match" : result.status === "optimal" ? "Optimal" : result.status === "timed_out"
      ? result.teams.length ? "Best found · not proven" : "Search limit reached" : "Infeasible";
    card.append(makeCell("h2", "Optimized defence options"));
    card.append(makeCell("p", state.dataset.snapshot + " · " + result.reason, "result-summary"));
    card.append(makeCell("span", statusText, "status-pill" +
      (result.status !== "optimal" || partial ? " warning" : "")));
    if (!result.teams.length) {
      card.append(renderInfeasibility(result, diagnostic));
      return card;
    }

    const stats = document.createElement("div");
    stats.className = "result-stats";
    stats.append(stat(state.dataset.rankAware ? "Average conservative G1 score" : "Average win rate",
      result.averageWinRate.toFixed(2) + "%"));
    stats.append(stat("Defences selected", String(result.teams.length)));
    stats.append(stat("Monsters excluded", String(state.dataset.monsters.length -
      state.dataset.monsters.filter(monster => (state.copies[monster.id] ?? 1) > 0).length)));
    card.append(stats);
    if (result.requested) {
      const foundFour = result.groups.find(group => group.key === "fourStar").teams.length;
      const foundNatFive = result.groups.find(group => group.key === "natFive").teams.length;
      const missingFour = Math.max(0, result.requested.fourStar - foundFour);
      const missingNatFive = Math.max(0, result.requested.natFive - foundNatFive);
      const remainderName = state.dataset.rankAware
        ? " all-defenses remainder" : " 5★ / all-defenses remainder";
      card.append(makeCell("p", "Requested " + result.requested.fourStar + " 4★ + " +
        result.requested.natFive + remainderName + "; found " + foundFour + " + " + foundNatFive +
        (missingFour || missingNatFive ? ". Missing " + missingFour + " 4★ and " + missingNatFive + " 5★." : "."),
        "result-summary"));
    }
    if (result.additionalCopyCount) {
      card.append(makeCell("p", "Additional copies to build: " + formatCopies(result.additionalCopies) + ".",
        "builds"));
    }

    const list = document.createElement("div");
    list.className = "team-list";
    const teams = result.groups ? result.groups.flatMap(group => group.teams.map(team => ({ ...team, category: group.key }))) :
      result.teams.map(team => ({ ...team, category: "any" }));
    teams.forEach((team, index) => {
      const tile = document.createElement("div");
      tile.className = "team";
      const names = [team.leader, ...team.memberIds].map(id =>
        state.dataset.monsters.find(monster => monster.id === id).name);
      tile.append(makeCell("div", (index + 1) + ". " + names.join(" / "), "team-name"));
      tile.append(makeCell("div", state.dataset.rankAware
        ? rankEvidenceText(team)
        : (team.category === "fourStar" ? "4-star list" : team.category === "natFive" ? "All-defences remainder" : "WGB") +
          " · " + (team.winRateBps / 100).toFixed(2) + "% · " + team.battles.toLocaleString() + " battles",
        "team-meta"));
      list.append(tile);
    });
    card.append(list);
    const remaining = result.requested
      ? Math.max(0, result.requested.fourStar + result.requested.natFive - result.teams.length)
      : 0;
    if (remaining) {
      const extra = document.createElement("section");
      extra.className = "infeasibility";
      const availableSuggestions = suggestions || [];
      extra.append(makeCell("h3", availableSuggestions.length
        ? "Suggested defenses to fill the remaining " + remaining + " slot(s)"
        : "No eligible defenses found for the remaining " + remaining + " slot(s)"));
      if (availableSuggestions.length) {
        const fillList = document.createElement("div");
        fillList.className = "team-list";
        availableSuggestions.forEach((team, index) => {
          const tile = document.createElement("div");
          tile.className = "team suggested-team";
          const names = [team.leader, ...team.memberIds].map(id =>
            state.dataset.monsters.find(monster => monster.id === id).name);
          tile.append(makeCell("div", "Suggestion " + (index + 1) + ". " + names.join(" / "), "team-name"));
          tile.append(makeCell("div", state.dataset.rankAware
            ? rankEvidenceText(team)
            : (team.siegeCategory === "fourStar" ? "4-star list" : "All-defences remainder") +
              " · " + (team.winRateBps / 100).toFixed(2) + "% · " + team.battles.toLocaleString() + " battles",
            "team-meta"));
          fillList.append(tile);
        });
        extra.append(fillList);
      }
      if (availableSuggestions.length < remaining) {
        extra.append(makeCell("p", (remaining - availableSuggestions.length) +
          " slot(s) still cannot be filled with the current roster and copy limits.", "hint"));
      }
      card.append(extra);
    }
    return card;
  }

  function stat(label, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "stat";
    wrapper.append(makeCell("strong", value), makeCell("span", label));
    return wrapper;
  }

  async function optimize() {
    if (!state.dataset || state.dataset.mode !== state.mode) {
      showNotice("Paste and import candidate data for the selected battle type first.", true);
      return;
    }
    if (state.mode === "siege" && (!Number.isInteger(state.requestedFour) ||
        !Number.isInteger(state.requestedNatFive) || state.requestedFour < 0 ||
        state.requestedNatFive < 0 || state.requestedFour + state.requestedNatFive > 10)) {
      showNotice("Requested Siege defenses must be whole numbers totaling no more than 10.", true);
      return;
    }
    const roster = makeSolverRoster(state.copyCap);
    $("#optimize").disabled = true;
    $("#results").replaceChildren(makeCell("p", "Searching eligible portfolios…", "empty"));
    showNotice("Searching defence combinations…", false);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const solveOptions = {
        timeLimitMs: 5000,
        allowDuplicateTeams: state.mode === "siege" && state.allowDuplicateTeams
      };
      const result = state.mode === "siege"
        ? GuildDefenseOptimizer.solveClosest(state.dataset, roster, state.mode, 30, {
          ...solveOptions, requirements: { fourStar: state.requestedFour, natFive: state.requestedNatFive }
        })
        : GuildDefenseOptimizer.solve(state.dataset, roster, state.mode, 30, solveOptions);
      const suggestions = state.mode === "siege" && result.teams.length
        ? GuildDefenseOptimizer.suggestFillTeams(state.dataset, result, roster,
          state.requestedFour + state.requestedNatFive, 30, solveOptions) : [];
      $("#results").replaceChildren(renderResult(result, null, suggestions));
      const partial = result.requested &&
        result.teams.length < result.requested.fourStar + result.requested.natFive;
      showNotice(result.status === "infeasible" ? state.dataset.rankAware &&
        !state.dataset.teams.some(team => Number.isInteger(team.g1Evidence && team.g1Evidence.scoreBps))
        ? "No candidate has eligible G1 evidence. Check the imported rank tables and snapshot."
        : "No defense can be built with the current copy counts." :
        result.status === "timed_out" ? "A feasible portfolio was found, but optimality was not proven." :
          partial ? "Closest available defense mix found. See the missing categories and fill suggestions below." :
            "Defence options optimized for the selected copy limit.", result.status !== "optimal" || partial);
    } catch (error) {
      showNotice("Optimization failed: " + error.message, true);
      $("#results").replaceChildren();
    } finally {
      $("#optimize").disabled = !state.dataset || state.dataset.mode !== state.mode;
    }
  }

  $("#data-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const dataset = GuildDefenseOptimizer.validateDataset(parsed);
      const mode = dataset.mode || state.mode;
      dataset.mode = mode;
      state.datasets[mode] = dataset;
      selectMode(mode);
      state.cleanedLabels = 0;
      if (dataset.rankAware && mode === "siege") {
        state.requestedFour = 10;
        state.requestedNatFive = 0;
      }
      $("#results").replaceChildren();
      state.activeStep = "data";
      render();
      showNotice("Imported " + dataset.teams.length + " defences. All listed monsters start marked available.", false);
    } catch (error) {
      showNotice("Import failed: " + error.message, true);
    } finally {
      event.target.value = "";
    }
  });
  $("#import-paste").addEventListener("click", () => {
    try {
      let imported;
      if (state.mode === "siege") {
        const fourStarText = $("#four-star-paste").value;
        const siegeAllText = $("#siege-all-paste").value;
        imported = GuildDefenseOptimizer.datasetFromPastedTables({
          mode: "siege", fourStarText, allText: siegeAllText
        });
      } else {
        imported = GuildDefenseOptimizer.datasetFromPastedTables({
          mode: "wgb", allText: $("#wgb-paste").value
        });
      }
      state.datasets[state.mode] = GuildDefenseOptimizer.validateDataset(imported.dataset);
      selectMode(state.mode);
      state.cleanedLabels = imported.cleanedLabels;
      state.activeStep = "data";
      $("#results").replaceChildren();
      render();
      const summary = state.mode === "siege"
        ? imported.fourStarCount + " four-star + " + imported.natFiveCount + " all-defenses remainder"
        : imported.natFiveCount + " WGB defenses";
      $("#paste-result").textContent = "Imported " + summary + ".";
      showNotice("Legacy table data imported. Review the selected mode's data before optimizing.", false);
    } catch (error) {
      showNotice("Paste import failed: " + error.message, true);
      $("#paste-result").textContent = error.message;
    }
  });
  $("#import-ranked-paste").addEventListener("click", () => {
    try {
      const imported = GuildDefenseOptimizer.datasetFromRankPastedTables({
        mode: "siege",
        snapshot: $("#rank-snapshot").value,
        fourStarTables: {
          G1: $("#siege-four-g1").value,
          G2: $("#siege-four-g2").value,
          G3: $("#siege-four-g3").value,
          ALL: $("#siege-four-all").value
        },
        allTables: {
          G1: $("#siege-all-g1").value,
          G2: $("#siege-all-g2").value,
          G3: $("#siege-all-g3").value,
          ALL: $("#siege-all-all").value
        }
      });
      state.datasets.siege = imported.dataset;
      selectMode("siege");
      state.cleanedLabels = imported.cleanedLabels;
      state.activeStep = "data";
      $("#results").replaceChildren();
      render();
      const missingTables = ["G1", "G2", "G3", "ALL"].flatMap(rank => [
        imported.counts.fourStar[rank] === undefined ? "4-star " + rank : null,
        imported.counts.all[rank] === undefined ? "all-defenses " + rank : null
      ]).filter(Boolean);
      $("#rank-paste-result").textContent = "Imported " + imported.fourStarCount +
        " known 4-star teams and " + imported.natFiveCount +
        " all-defenses remainder teams. Teams appearing in any 4-star rank list were removed from the remainder." +
        (missingTables.length ? " Missing input tables: " + missingTables.join(", ") +
          "; those rank estimates remain unavailable." : "");
      showNotice("Siege rank tables imported. Confirm the supplied tables share matching snapshots and filters.", false);
    } catch (error) {
      $("#rank-paste-result").textContent = error.message;
      showNotice("Siege rank import failed: " + error.message, true);
    }
  });
  $("#import-wgb-ranked").addEventListener("click", () => {
    try {
      const imported = GuildDefenseOptimizer.datasetFromRankPastedTables({
        mode: "wgb",
        snapshot: $("#rank-snapshot").value,
        tables: {
          G1: $("#wgb-g1").value,
          G2: $("#wgb-g2").value,
          G3: $("#wgb-g3").value,
          ALL: $("#wgb-all").value
        }
      });
      state.datasets.wgb = imported.dataset;
      selectMode("wgb");
      state.cleanedLabels = imported.cleanedLabels;
      state.activeStep = "data";
      $("#results").replaceChildren();
      render();
      const missingTables = ["G1", "G2", "G3", "ALL"]
        .filter(rank => imported.counts[rank] === undefined);
      $("#wgb-rank-paste-result").textContent = "Imported WGB rank tables (" +
        ["G1", "G2", "G3", "ALL"].filter(rank => imported.counts[rank] !== undefined)
          .map(rank => rank + ": " + imported.counts[rank]).join(" · ") +
        "). No rarity categories are applied." +
        (missingTables.length ? " Missing input tables: " + missingTables.join(", ") +
          "; those rank estimates remain unavailable." : "");
      showNotice("WGB rank tables imported. Confirm the supplied tables share matching snapshots and filters.", false);
    } catch (error) {
      $("#wgb-rank-paste-result").textContent = error.message;
      showNotice("WGB rank import failed: " + error.message, true);
    }
  });
  $("#replace-data").addEventListener("click", () => {
    setStep("import");
  });
  $("#clear-data").addEventListener("click", () => {
    state.datasets = { siege: null, wgb: null };
    state.dataset = null;
    state.copies = {};
    state.copiesByMode = { siege: {}, wgb: {} };
    state.cleanedLabels = 0;
    for (const selector of ["#four-star-paste", "#siege-all-paste", "#wgb-paste", "#rank-snapshot",
      "#siege-four-g1", "#siege-four-g2", "#siege-four-g3", "#siege-four-all",
      "#siege-all-g1", "#siege-all-g2", "#siege-all-g3", "#siege-all-all",
      "#wgb-g1", "#wgb-g2", "#wgb-g3", "#wgb-all"])
      $(selector).value = "";
    $("#paste-result").textContent = "";
    $("#rank-paste-result").textContent = "";
    $("#wgb-rank-paste-result").textContent = "";
    $("#results").replaceChildren();
    state.mode = "siege";
    state.activeStep = "intro";
    render();
    showNotice("Imported data cleared.", false);
  });
  $("#optimize").addEventListener("click", optimize);
  $("#allow-duplicate-teams").addEventListener("change", () => {
    state.allowDuplicateTeams = $("#allow-duplicate-teams").checked;
    $("#results").replaceChildren();
    save();
    optimize();
  });
  document.querySelectorAll("[data-copy-cap]").forEach(button => button.addEventListener("click", () => {
    state.copyCap = Number(button.dataset.copyCap);
    document.querySelectorAll("[data-copy-cap]").forEach(option => {
      const selected = option === button;
      option.setAttribute("aria-pressed", String(selected));
      option.classList.toggle("selected", selected);
    });
    $("#results").replaceChildren();
    save();
    optimize();
  }));
  for (const [selector, mode] of [["#choose-siege", "siege"], ["#choose-wgb", "wgb"]]) {
    $(selector).addEventListener("click", () => {
      selectMode(mode);
      state.activeStep = "import";
      render();
    });
  }
  document.querySelectorAll(".workflow-tabs [role='tab'], [data-step]").forEach(button =>
    button.addEventListener("click", () => setStep(button.dataset.step || button.id.replace("step-tab-", ""))));
  for (const [selector, key] of [
    ["#requested-four-star", "requestedFour"],
    ["#requested-nat-five", "requestedNatFive"]
  ]) {
    $(selector).addEventListener("change", event => {
      const raw = event.target.value.trim();
      const value = Number(raw);
      const proposed = { requestedFour: state.requestedFour, requestedNatFive: state.requestedNatFive };
      proposed[key] = value;
      if (!raw || !Number.isInteger(value) || value < 0 ||
          proposed.requestedFour + proposed.requestedNatFive > 10) {
        event.target.value = String(state[key]);
        showNotice("Requested Siege defenses must be whole numbers totaling no more than 10.", true);
        return;
      }
      state[key] = value;
      $("#results").replaceChildren();
      renderCandidateTables();
      save();
      showNotice("Requested defense counts updated. Optimize to refresh the portfolio.", false);
    });
  }
  $("#monster-search").addEventListener("input", filterMonsterList);
  $("#select-all").addEventListener("click", () => {
    state.copies = Object.fromEntries(state.dataset.monsters.map(monster => [monster.id, 1]));
    renderRoster();
    renderCandidateTables();
    $("#results").replaceChildren();
    save();
  });
  $("#select-none").addEventListener("click", () => {
    state.copies = Object.fromEntries(state.dataset.monsters.map(monster => [monster.id, 0]));
    renderRoster();
    renderCandidateTables();
    $("#results").replaceChildren();
    save();
  });
  $("#exclude-listed").addEventListener("click", () => {
    const names = $("#exclude-list").value.split(/[\n,;]+/).map(name => name.trim()).filter(Boolean);
    const byName = new Map(state.dataset.monsters.map(monster => [monster.name.toLocaleLowerCase(), monster]));
    const missing = [];
    for (const name of names) {
      const monster = byName.get(name.toLocaleLowerCase());
      if (monster) state.copies[monster.id] = 0;
      else missing.push(name);
    }
    renderRoster();
    renderCandidateTables();
    $("#results").replaceChildren();
    save();
    showNotice((names.length - missing.length) + " monster(s) excluded." +
      (missing.length ? " Not found in this dataset: " + missing.join(", ") : ""), missing.length > 0);
  });
  initializeTheme();
  initialize();

  function setStep(step) {
    if (!["intro", "import", "data", "optimize"].includes(step)) return;
    state.activeStep = step;
    render();
  }
})();
