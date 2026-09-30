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

  function makeSolverRoster(copyCap) {
    return Object.fromEntries(state.dataset.monsters.map(monster => {
      const copies = state.copies[monster.id] ?? 1;
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

  function initialize() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.dataset) {
        const dataset = GuildDefenseOptimizer.validateDataset(saved.dataset);
        const copies = saved.copies || Object.fromEntries(dataset.monsters.map(monster => [
          monster.id, saved.excluded && saved.excluded[monster.id] ? 0 : 1
        ]));
        state = { dataset, copies, cleanedLabels: saved.cleanedLabels || 0,
          copyCap: [1, 2, 3, 4, 5].includes(saved.copyCap) ? saved.copyCap : 1,
          allowDuplicateTeams: saved.allowDuplicateTeams === true,
          requestedFour: saved.requestedFour ?? 4, requestedNatFive: saved.requestedNatFive ?? 6,
          mode: saved.mode === "wgb" ? "wgb" : "siege" };
      } else state = { dataset: null, copies: {}, cleanedLabels: 0, copyCap: 1,
        allowDuplicateTeams: false, requestedFour: 4, requestedNatFive: 6, mode: "siege" };
    } catch (error) {
      state = { dataset: null, copies: {}, cleanedLabels: 0, copyCap: 1,
        allowDuplicateTeams: false, requestedFour: 4, requestedNatFive: 6, mode: "siege" };
      showNotice("Saved data could not be loaded. Paste the tables again. " + error.message, true);
    }
    render();
  }

  function renderRoster() {
    const body = $("#roster");
    body.replaceChildren();
    if (!state.dataset) return;
    const appearances = new Map(state.dataset.monsters.map(monster => [monster.id, { count: 0, winRateTotal: 0 }]));
    for (const team of state.dataset.teams) {
      for (const id of [team.leader, ...team.memberIds]) {
        const stats = appearances.get(id);
        stats.count++;
        stats.winRateTotal += team.winRateBps / 100;
      }
    }
    const monsters = state.dataset.monsters.map(monster => ({
      ...monster,
      stats: appearances.get(monster.id)
    })).sort((a, b) =>
      (a.rosterGroup === "fourStar" ? 1 : 0) - (b.rosterGroup === "fourStar" ? 1 : 0) ||
      b.stats.count - a.stats.count ||
      (b.stats.winRateTotal / b.stats.count) - (a.stats.winRateTotal / a.stats.count) ||
      a.name.localeCompare(b.name));
    let renderedGroup = "";
    for (const monster of monsters) {
      const group = monster.rosterGroup === "fourStar" ? "fourStar" : "unknown";
      if (group !== renderedGroup) {
        renderedGroup = group;
        const heading = document.createElement("tr");
        heading.className = "group-row";
        heading.append(makeCell("th", group === "unknown" ? "5★ / unknown rarity" : "4★-or-lower monsters", null));
        const remainder = document.createElement("th");
        remainder.colSpan = 4;
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
      const average = count ? monster.stats.winRateTotal / count : 0;
      tr.append(available, copiesCell, name,
        makeCell("td", String(count)),
        makeCell("td", count ? average.toFixed(2) + "%" : "—"));
      body.append(tr);
    }
    $("#roster thead").replaceChildren();
    const header = document.createElement("tr");
    for (const label of ["Available", "Copies", "Monster", "Defences", "Avg. WR"]) header.append(makeCell("th", label));
    $("#roster").closest("table").querySelector("thead").replaceChildren(header);
    filterMonsterList();
    updateAvailabilityCount();
  }

  function render() {
    const hasData = Boolean(state.dataset);
    $("#paste-fields").hidden = hasData;
    $("#paste-panel").hidden = hasData;
    $("#candidate-tables").hidden = !hasData;
    $("#availability-panel").hidden = !hasData;
    $("#optimize").disabled = !hasData;
    document.querySelector('input[name="mode"][value="' + state.mode + '"]').checked = true;
    $("#mode-description").textContent = state.mode === "siege"
      ? "Requests up to ten total defenses from the two pasted lists. If the requested mix is unavailable, the closest match is shown with options to fill any remaining slots."
      : "Builds five teams from the pasted list without a rarity split.";
    $("#siege-counts").hidden = state.mode !== "siege";
    $("#requested-four-star").value = String(state.requestedFour);
    $("#requested-nat-five").value = String(state.requestedNatFive);
    $("#siege-paste-fields").hidden = state.mode !== "siege";
    $("#wgb-paste-fields").hidden = state.mode !== "wgb";
    document.querySelectorAll('input[name="mode"]').forEach(input => { input.disabled = hasData; });
    document.querySelectorAll("[data-copy-cap]").forEach(button => {
      button.hidden = !hasData || state.mode !== "siege" || state.dataset.mode !== "siege";
      button.setAttribute("aria-pressed", String(Number(button.dataset.copyCap) === (state.copyCap || 1)));
      button.classList.toggle("selected", Number(button.dataset.copyCap) === (state.copyCap || 1));
    });
    $("#copy-tabs").hidden = !hasData || state.mode !== "siege" || state.dataset.mode !== "siege";
    $("#duplicate-team-option").hidden = !hasData;
    $("#allow-duplicate-teams").checked = state.allowDuplicateTeams;
    $("#four-star-table-section").hidden = !hasData || state.dataset.mode !== "siege";
    $("#nat-five-table-section").hidden = !hasData || state.dataset.mode !== "siege";
    $("#wgb-table-section").hidden = !hasData || state.dataset.mode !== "wgb";
    if (hasData) {
      renderCandidateTables();
      renderRoster();
    }
    $("#results").replaceChildren();
    save();
  }

  function renderCandidateTables() {
    if (!state.dataset) return;
    const available = team => [team.leader, ...team.memberIds].every(id => (state.copies[id] ?? 1) > 0);
    const allFourStar = state.dataset.teams.filter(team => team.siegeCategory === "fourStar");
    const allNatFive = state.dataset.teams.filter(team => team.siegeCategory === "natFive");
    const fourStar = allFourStar.filter(available);
    const natFive = allNatFive.filter(available);
    const wgb = state.dataset.teams.filter(available);
    $("#candidate-summary").textContent = state.dataset.mode === "siege"
      ? fourStar.length + "/" + allFourStar.length + " four-star teams; " +
        natFive.length + "/" + allNatFive.length + " remaining all-defences teams available; " +
        "requested " + state.requestedFour + " 4★ + " + state.requestedNatFive + " 5★."
      : wgb.length + "/" + state.dataset.teams.length + " World Guild Battle teams available.";
    if (state.cleanedLabels) $("#candidate-summary").textContent += " " + state.cleanedLabels + " doubled labels cleaned.";
    renderDefenseTable("#four-star-teams", fourStar);
    renderDefenseTable("#nat-five-teams", natFive);
    renderDefenseTable("#wgb-teams", wgb);
  }

  function renderDefenseTable(selector, teams) {
    const body = $(selector);
    body.replaceChildren();
    const sortedTeams = teams.slice().sort((a, b) =>
      b.winRateBps - a.winRateBps || b.battles - a.battles || a.id.localeCompare(b.id));
    for (const team of sortedTeams) {
      const row = document.createElement("tr");
      const names = [team.leader, ...team.memberIds].map(id =>
        state.dataset.monsters.find(monster => monster.id === id).name);
      for (const name of names) row.append(makeCell("td", name));
      row.append(makeCell("td", team.battles.toLocaleString()));
      row.append(makeCell("td", (team.winRateBps / 100).toFixed(2) + "%"));
      body.append(row);
    }
  }

  function filterMonsterList() {
    const term = $("#monster-search").value.trim().toLocaleLowerCase();
    for (const row of $("#roster").rows) {
      if (!row.classList.contains("group-row")) {
        row.hidden = !row.cells[2].textContent.toLocaleLowerCase().includes(term);
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
    stats.append(stat("Average win rate", result.averageWinRate.toFixed(2) + "%"));
    stats.append(stat("Defences selected", String(result.teams.length)));
    stats.append(stat("Monsters excluded", String(state.dataset.monsters.length -
      state.dataset.monsters.filter(monster => (state.copies[monster.id] ?? 1) > 0).length)));
    card.append(stats);
    if (result.requested) {
      const foundFour = result.groups.find(group => group.key === "fourStar").teams.length;
      const foundNatFive = result.groups.find(group => group.key === "natFive").teams.length;
      const missingFour = Math.max(0, result.requested.fourStar - foundFour);
      const missingNatFive = Math.max(0, result.requested.natFive - foundNatFive);
      card.append(makeCell("p", "Requested " + result.requested.fourStar + " 4★ + " +
        result.requested.natFive + " 5★; found " + foundFour + " + " + foundNatFive +
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
      tile.append(makeCell("div",
        (team.category === "fourStar" ? "4-star list" : team.category === "natFive" ? "All-defences remainder" : "WGB") +
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
          tile.append(makeCell("div",
            (team.siegeCategory === "fourStar" ? "4-star list" : "All-defences remainder") +
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
      const solveOptions = { timeLimitMs: 5000, allowDuplicateTeams: state.allowDuplicateTeams };
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
      showNotice(result.status === "infeasible" ? "No defense can be built with the current copy counts." :
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
      if (!dataset.mode) dataset.mode = state.mode;
      state.dataset = dataset;
      state.copies = Object.fromEntries(dataset.monsters.map(monster => [monster.id, 1]));
      state.cleanedLabels = 0;
      $("#results").replaceChildren();
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
      const imported = GuildDefenseOptimizer.datasetFromPastedTables(state.mode === "siege"
        ? { mode: state.mode, fourStarText: $("#four-star-paste").value, allText: $("#siege-all-paste").value }
        : { mode: state.mode, allText: $("#wgb-paste").value });
      state.dataset = GuildDefenseOptimizer.validateDataset(imported.dataset);
      state.copies = Object.fromEntries(imported.dataset.monsters.map(monster => [monster.id, 1]));
      state.cleanedLabels = imported.cleanedLabels;
      $("#results").replaceChildren();
      render();
      const counts = state.mode === "siege"
        ? imported.fourStarCount + " four-star teams + " + imported.natFiveCount + " remaining all-defences teams"
        : imported.natFiveCount + " WGB teams";
      $("#paste-result").textContent = "Imported " + counts + ". All " +
        imported.dataset.monsters.length + " unique monsters start available.";
      showNotice("Paste cleaned and imported. Exclude the monsters you don't have, then optimize.", false);
    } catch (error) {
      showNotice("Paste import failed: " + error.message, true);
      $("#paste-result").textContent = error.message;
    }
  });
  $("#replace-data").addEventListener("click", () => {
    state.dataset = null;
    state.copies = {};
    state.cleanedLabels = 0;
    $("#results").replaceChildren();
    $("#paste-result").textContent = "";
    render();
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
  document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener("change", () => {
    state.mode = input.value;
    save();
    render();
  }));
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
  initialize();
})();
