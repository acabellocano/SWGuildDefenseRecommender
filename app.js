(function () {
  "use strict";

  const STORAGE_KEY = "guild-defense-optimizer-v1";
  const example = {
    title: "Synthetic demonstration data",
    snapshot: "Synthetic example · no live SWGT data",
    monsters: [
      { id: "amber", name: "Amber", naturalStars: 4 }, { id: "brio", name: "Brio", naturalStars: 4 },
      { id: "cinder", name: "Cinder", naturalStars: 4 }, { id: "dune", name: "Dune", naturalStars: 4 },
      { id: "ember", name: "Ember", naturalStars: 4 }, { id: "fable", name: "Fable", naturalStars: 4 },
      { id: "gale", name: "Gale", naturalStars: 4 }, { id: "hollis", name: "Hollis", naturalStars: 4 },
      { id: "indigo", name: "Indigo", naturalStars: 4 }, { id: "juno", name: "Juno", naturalStars: 4 },
      { id: "kestrel", name: "Kestrel", naturalStars: 4 }, { id: "lumen", name: "Lumen", naturalStars: 4 },
      { id: "moss", name: "Moss", naturalStars: 4 }, { id: "nix", name: "Nix", naturalStars: 4 },
      { id: "opal", name: "Opal", naturalStars: 4 }, { id: "pax", name: "Pax", naturalStars: 4 },
      { id: "reed", name: "Reed", naturalStars: 4 }, { id: "sage", name: "Sage", naturalStars: 4 },
      { id: "teal", name: "Teal", naturalStars: 4 }, { id: "ursa", name: "Ursa", naturalStars: 4 },
      { id: "mira", name: "Mira", naturalStars: 5 }, { id: "nova", name: "Nova", naturalStars: 5 },
      { id: "orion", name: "Orion", naturalStars: 5 }, { id: "pyra", name: "Pyra", naturalStars: 5 },
      { id: "quill", name: "Quill", naturalStars: 5 }, { id: "rune", name: "Rune", naturalStars: 5 },
      { id: "sol", name: "Sol", naturalStars: 5 }, { id: "talia", name: "Talia", naturalStars: 5 }
    ],
    teams: [
      { leader: "amber", members: ["brio", "cinder"], winRate: 20.4, battles: 1021 },
      { leader: "amber", members: ["dune", "ember"], winRate: 18.7, battles: 1260 },
      { leader: "fable", members: ["gale", "hollis"], winRate: 17.8, battles: 1412 },
      { leader: "indigo", members: ["juno", "kestrel"], winRate: 16.9, battles: 1184 },
      { leader: "lumen", members: ["amber", "brio"], winRate: 16.2, battles: 1330 },
      { leader: "cinder", members: ["dune", "fable"], winRate: 15.4, battles: 1099 },
      { leader: "gale", members: ["indigo", "lumen"], winRate: 14.8, battles: 1510 },
      { leader: "hollis", members: ["juno", "ember"], winRate: 14.1, battles: 1220 },
      { leader: "mira", members: ["amber", "brio"], winRate: 19.2, battles: 1600 },
      { leader: "nova", members: ["cinder", "dune"], winRate: 18.4, battles: 1482 },
      { leader: "orion", members: ["ember", "fable"], winRate: 17.5, battles: 1307 },
      { leader: "pyra", members: ["gale", "hollis"], winRate: 16.8, battles: 1870 },
      { leader: "quill", members: ["indigo", "juno"], winRate: 15.9, battles: 1321 },
      { leader: "rune", members: ["kestrel", "lumen"], winRate: 15.1, battles: 1710 },
      { leader: "sol", members: ["amber", "dune"], winRate: 14.7, battles: 1111 },
      { leader: "talia", members: ["brio", "ember"], winRate: 13.9, battles: 1090 },
      { leader: "moss", members: ["nix", "opal"], winRate: 18.1, battles: 1201 },
      { leader: "pax", members: ["reed", "sage"], winRate: 17.2, battles: 1190 },
      { leader: "teal", members: ["ursa", "amber"], winRate: 16.4, battles: 1077 },
      { leader: "juno", members: ["kestrel", "lumen"], winRate: 15.8, battles: 1225 },
      { leader: "mira", members: ["moss", "nix"], winRate: 19.4, battles: 1120 },
      { leader: "nova", members: ["opal", "pax"], winRate: 18.6, battles: 1184 },
      { leader: "orion", members: ["reed", "sage"], winRate: 17.7, battles: 1310 },
      { leader: "pyra", members: ["teal", "ursa"], winRate: 16.9, battles: 1420 },
      { leader: "quill", members: ["amber", "brio"], winRate: 15.5, battles: 1095 },
      { leader: "rune", members: ["cinder", "dune"], winRate: 14.8, battles: 1150 }
    ]
  };

  const $ = selector => document.querySelector(selector);
  const notice = $("#notice");
  let state;

  function showNotice(message, isError) {
    notice.textContent = message;
    notice.className = "notice " + (isError ? "error" : "success");
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showNotice("Could not save in this browser: " + error.message, true);
    }
  }

  function freshExample() {
    const dataset = GuildDefenseOptimizer.validateDataset(example);
    const roster = {};
    for (const monster of dataset.monsters) roster[monster.id] = { owned: 1, maxAdditional: monster.naturalStars === 5 ? 0 : 5 };
    return { dataset, roster, mode: "siege", budget: 5 };
  }

  function initialize() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.dataset) {
        state = { dataset: GuildDefenseOptimizer.validateDataset(saved.dataset), roster: saved.roster || {},
          mode: saved.mode === "wgb" ? "wgb" : "siege", budget: Number(saved.budget) || 5 };
      } else state = freshExample();
    } catch (error) {
      state = freshExample();
      showNotice("Saved data could not be loaded; the synthetic example was restored. " + error.message, true);
    }
    render();
  }

  function renderRoster() {
    const body = $("#roster");
    body.replaceChildren();
    const monsters = state.dataset.monsters.slice().sort((a, b) =>
      b.naturalStars - a.naturalStars || a.name.localeCompare(b.name));
    for (const monster of monsters) {
      const row = state.roster[monster.id] || { owned: 0, maxAdditional: 0 };
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = monster.name;
      const rarity = document.createElement("td");
      const stars = document.createElement("select");
      stars.className = "rarity-select";
      stars.setAttribute("aria-label", "Natural rarity of " + monster.name);
      for (const [value, label] of [[0, "Unknown"], [1, "1★"], [2, "2★"], [3, "3★"], [4, "4★"], [5, "5★"]]) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = label;
        stars.append(option);
      }
      stars.value = String(monster.naturalStars);
      stars.addEventListener("change", () => {
        monster.naturalStars = Number(stars.value);
        if (monster.naturalStars === 0 || monster.naturalStars === 5) row.maxAdditional = 0;
        state.roster[monster.id] = row;
        save();
        renderRoster();
      });
      rarity.append(stars);
      const owned = makeNumberInput(row.owned, "Usable copies of " + monster.name, value => {
        row.owned = value;
        state.roster[monster.id] = row;
        if (monster.naturalStars === 5) row.maxAdditional = 0;
        save();
        renderRoster();
      });
      const additional = makeNumberInput(row.maxAdditional, "Maximum extra copies of " + monster.name,
        value => { row.maxAdditional = value; state.roster[monster.id] = row; save(); });
      if (monster.naturalStars === 0 || monster.naturalStars === 5) {
        additional.value = "0";
        additional.disabled = true;
      }
      const ownedCell = document.createElement("td");
      const additionalCell = document.createElement("td");
      ownedCell.append(owned);
      additionalCell.append(additional);
      tr.append(name, rarity, ownedCell, additionalCell);
      body.append(tr);
    }
  }

  function makeNumberInput(value, label, update) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "99";
    input.step = "1";
    input.value = String(value);
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      const count = Number(input.value);
      if (!Number.isInteger(count) || count < 0 || count > 99) {
        showNotice("Copy counts must be whole numbers from 0 to 99.", true);
        input.value = String(value);
        return;
      }
      update(count);
    });
    return input;
  }

  function render() {
    renderRoster();
    document.querySelector('input[name="mode"][value="' + state.mode + '"]').checked = true;
    $("#budget").value = String(state.budget);
    $("#mode-description").textContent = state.mode === "siege"
      ? "Siege selects four teams from the pasted 4-star table and six from all-defences after removing those exact teams."
      : "World Guild Battle selects five teams from the pasted list, with no rarity quota.";
    if (state.dataset.mode && state.dataset.mode !== state.mode) {
      $("#paste-result").textContent = "The currently loaded " + state.dataset.mode.toUpperCase() +
        " data does not match the selected mode. Paste and import data for this mode before optimizing.";
    }
    $("#siege-paste-fields").hidden = state.mode !== "siege";
    $("#wgb-paste-fields").hidden = state.mode !== "wgb";
    $("#results").replaceChildren();
    save();
  }

  function makeCell(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderResult(result, budget, baseline) {
    const card = document.createElement("article");
    card.className = "result-card";
    const statusText = result.status === "optimal" ? "Optimal" : result.status === "timed_out" ? "Best found · not proven" : "Infeasible";
    card.append(makeCell("h2", "Up to " + budget + " extra " + (budget === 1 ? "copy" : "copies")));
    card.append(makeCell("p", result.status === "infeasible" ? result.reason :
      state.dataset.snapshot + " · " + result.reason, "result-summary"));
    const status = makeCell("span", statusText, "status-pill" + (result.status !== "optimal" ? " warning" : ""));
    card.append(status);
    if (result.status === "infeasible") return card;

    const stats = document.createElement("div");
    stats.className = "result-stats";
    stats.append(stat("Average win rate", result.averageWinRate.toFixed(2) + "%"));
    stats.append(stat("Gain vs. zero", baseline ? signed((result.averageWinRate - baseline.averageWinRate)) + " pp" : "—"));
    stats.append(stat("Extra copies used", String(result.additionalCopyCount)));
    stats.append(stat("Search", result.nodes.toLocaleString() + " nodes"));
    card.append(stats);

    const builds = document.createElement("p");
    builds.className = "builds";
    const entries = Object.entries(result.additionalCopies).map(([id, count]) => {
      const monster = state.dataset.monsters.find(item => item.id === id);
      return monster.name + " +" + count;
    });
    builds.textContent = "Builds: " + (entries.length ? entries.join(", ") : "none");
    card.append(builds);
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
        (team.category === "fourStar" ? "4★-only" : team.category === "natFive" ? "Contains nat-five" : "WGB") +
        " · " + (team.winRateBps / 100).toFixed(2) + "% · " + team.battles.toLocaleString() + " battles",
        "team-meta"));
      list.append(tile);
    });
    card.append(list);
    return card;
  }

  function stat(label, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "stat";
    wrapper.append(makeCell("strong", value), makeCell("span", label));
    return wrapper;
  }

  function signed(value) {
    return (value >= 0 ? "+" : "") + value.toFixed(2);
  }

  async function optimize() {
    if (state.dataset.mode && state.dataset.mode !== state.mode) {
      showNotice("Paste and import candidate data for the selected battle type first.", true);
      return;
    }
    const budget = Number($("#budget").value);
    if (!Number.isInteger(budget) || budget < 0 || budget > 20) {
      showNotice("The comparison budget must be a whole number from 0 to 20.", true);
      return;
    }
    state.mode = document.querySelector('input[name="mode"]:checked').value;
    state.budget = budget;
    save();
    $("#optimize").disabled = true;
    $("#results").replaceChildren(makeCell("p", "Searching eligible portfolios…", "empty"));
    try {
      const results = [];
      const maxMs = 1200;
      for (let limit = 0; limit <= budget; limit++) {
        const result = GuildDefenseOptimizer.solve(state.dataset, state.roster, state.mode, limit, { timeLimitMs: maxMs });
        results.push(result);
        const baseline = results[0].status !== "infeasible" ? results[0] : null;
        $("#results").replaceChildren(...results.map((item, index) =>
          renderResult(item, index, baseline)));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const last = results[results.length - 1];
      showNotice(last.status === "infeasible" ? "No feasible portfolio found for the selected budget." :
        "Comparison complete. Results are independent optima for each up-to budget.", last.status === "infeasible");
    } catch (error) {
      showNotice("Optimization failed: " + error.message, true);
      $("#results").replaceChildren();
    } finally {
      $("#optimize").disabled = false;
    }
  }

  $("#data-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const dataset = GuildDefenseOptimizer.validateDataset(parsed);
      const roster = {};
      for (const monster of dataset.monsters) {
        roster[monster.id] = state.roster[monster.id] || { owned: 0, maxAdditional: 0 };
      }
      state.dataset = dataset;
      state.roster = roster;
      $("#results").replaceChildren();
      render();
      showNotice("Imported " + dataset.teams.length + " teams. Set usable copies for this roster before optimizing.", false);
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
      const roster = {};
      for (const monster of imported.dataset.monsters) {
        roster[monster.id] = state.roster[monster.id] || { owned: 0, maxAdditional: 0 };
      }
      state.dataset = GuildDefenseOptimizer.validateDataset(imported.dataset);
      state.roster = roster;
      $("#results").replaceChildren();
      render();
      const cleanup = imported.cleanedLabels + " doubled labels cleaned";
      const counts = state.mode === "siege"
        ? imported.fourStarCount + " four-star teams + " + imported.natFiveCount + " remaining all-defences teams"
        : imported.natFiveCount + " WGB teams";
      $("#paste-result").textContent = "Imported " + counts + "; " + cleanup + ". Set usable copies and confirm natural rarity below.";
      showNotice("Paste cleaned and imported. New monster copies default to zero.", false);
    } catch (error) {
      showNotice("Paste import failed: " + error.message, true);
      $("#paste-result").textContent = error.message;
    }
  });
  $("#load-example").addEventListener("click", () => {
    state = freshExample();
    render();
    showNotice("Synthetic demo data loaded. Replace it and enter your own roster before using recommendations.", false);
  });
  $("#optimize").addEventListener("click", optimize);
  document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener("change", () => {
    state.mode = input.value;
    save();
    render();
  }));
  $("#budget").addEventListener("change", () => {
    const value = Number($("#budget").value);
    if (Number.isInteger(value) && value >= 0 && value <= 20) {
      state.budget = value;
      save();
    }
  });
  initialize();
})();
