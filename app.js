const categories = {
  color: ["Czerwony", "Zielony", "Biały", "Żółty", "Niebieski"],
  nationality: ["Norweg", "Anglik", "Duńczyk", "Niemiec", "Szwed"],
  drink: ["Herbata", "Mleko", "Woda", "Piwo", "Kawa"],
  smoke: ["Rothmans", "Dunhill", "Marlboro", "Pall Mall", "Philip Morris"],
  pet: ["Koty", "Ptaki", "Psy", "Konie", "Rybki"],
};

const rowOrder = ["color", "nationality", "drink", "smoke", "pet"];
const rowLabels = {
  color: "Kolor domu",
  nationality: "Narodowość",
  drink: "Napój",
  smoke: "Papierosy",
  pet: "Zwierzę",
};

const houses = [1, 2, 3, 4, 5];
const STORAGE_KEY = "einstein-puzzle-session-state-v1";
const STORAGE_SCHEMA_VERSION = 2;
const state = {
  assignments: {},
  groups: {},
  sandbox: {
    positions: {},
    links: [],
    nextLinkId: 1,
    selectedLinkId: null,
  },
  deduction: {
    manualCells: {},
  },
  selected: new Set(),
  nextGroupId: 1,
};

for (const category of rowOrder) {
  state.assignments[category] = { 1: null, 2: null, 3: null, 4: null, 5: null };
}

const boardEl = document.getElementById("board");
const tokensEl = document.getElementById("tokens");
const sandboxGroupsEl = document.getElementById("sandbox-groups");
const freeSandboxStageEl = document.getElementById("free-sandbox-stage");
const freeSandboxItemsEl = document.getElementById("free-sandbox-items");
const sandboxLinksSvgEl = document.getElementById("sandbox-links-svg");
const sandboxLinksListEl = document.getElementById("sandbox-links-list");
const deductionBoardEl = document.getElementById("deduction-board");
const glueBtn = document.getElementById("glue-btn");
const unglueBtn = document.getElementById("unglue-btn");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");
const restoreBtn = document.getElementById("restore-btn");
const clearSessionBtn = document.getElementById("clear-session-btn");
const clearDeductionBtn = document.getElementById("clear-deduction-btn");
const linkSameBtn = document.getElementById("link-same");
const linkLeftBtn = document.getElementById("link-left");
const linkNextBtn = document.getElementById("link-next");
const resetSelectedLinkBtn = document.getElementById("reset-selected-link");
const statusEl = document.getElementById("status");

function tokenId(category, value) {
  return `${category}:${value}`;
}

function parseToken(id) {
  const [category, value] = id.split(":");
  return { category, value };
}

function getAllTokenIds() {
  const all = [];
  for (const category of rowOrder) {
    for (const value of categories[category]) {
      all.push(tokenId(category, value));
    }
  }
  return all;
}

function ensureSandboxPositions() {
  const allIds = getAllTokenIds();
  const existing = state.sandbox.positions;
  const categoryIndex = Object.fromEntries(rowOrder.map((category, idx) => [category, idx]));
  const perCategoryCursor = Object.fromEntries(rowOrder.map((category) => [category, 0]));

  for (const id of allIds) {
    if (existing[id]) continue;
    const { category } = parseToken(id);
    const row = categoryIndex[category];
    const col = perCategoryCursor[category]++;
    existing[id] = {
      x: 16 + col * 110,
      y: 16 + row * 68,
    };
  }
}

function getDeductionPairs() {
  const pairs = [];
  for (let i = 0; i < rowOrder.length; i += 1) {
    for (let j = i + 1; j < rowOrder.length; j += 1) {
      pairs.push([rowOrder[i], rowOrder[j]]);
    }
  }
  return pairs;
}

function cellKey(leftCategory, rightCategory, leftValue, rightValue) {
  return `${leftCategory}|${rightCategory}|${leftValue}|${rightValue}`;
}

function setAutoCell(autoMap, leftCategory, rightCategory, leftValue, rightValue, stateValue) {
  const key = cellKey(leftCategory, rightCategory, leftValue, rightValue);
  const previous = autoMap[key];
  if (previous === "yes") return;
  if (stateValue === "yes" || !previous) {
    autoMap[key] = stateValue;
  }
}

function createAutoCellsFromYes(autoMap) {
  for (const [leftCategory, rightCategory] of getDeductionPairs()) {
    const leftValues = categories[leftCategory];
    const rightValues = categories[rightCategory];

    for (const leftValue of leftValues) {
      const yesRight = rightValues.filter(
        (rightValue) => autoMap[cellKey(leftCategory, rightCategory, leftValue, rightValue)] === "yes",
      );
      if (yesRight.length === 1) {
        for (const rightValue of rightValues) {
          if (rightValue !== yesRight[0]) {
            setAutoCell(autoMap, leftCategory, rightCategory, leftValue, rightValue, "no");
          }
        }
      }
    }

    for (const rightValue of rightValues) {
      const yesLeft = leftValues.filter(
        (leftValue) => autoMap[cellKey(leftCategory, rightCategory, leftValue, rightValue)] === "yes",
      );
      if (yesLeft.length === 1) {
        for (const leftValue of leftValues) {
          if (leftValue !== yesLeft[0]) {
            setAutoCell(autoMap, leftCategory, rightCategory, leftValue, rightValue, "no");
          }
        }
      }
    }
  }
}

function gatherSameHousePairs() {
  const pairs = [];
  const grouped = {};
  for (const [id, groupId] of Object.entries(state.groups)) {
    if (!grouped[groupId]) grouped[groupId] = [];
    grouped[groupId].push(id);
  }

  for (const members of Object.values(grouped)) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        pairs.push([members[i], members[j]]);
      }
    }
  }

  for (const link of state.sandbox.links) {
    if (link.type === "same_house") {
      pairs.push([link.a, link.b]);
    }
  }

  for (const house of houses) {
    const assigned = [];
    for (const category of rowOrder) {
      const value = state.assignments[category][house];
      if (value) {
        assigned.push(tokenId(category, value));
      }
    }
    for (let i = 0; i < assigned.length; i += 1) {
      for (let j = i + 1; j < assigned.length; j += 1) {
        pairs.push([assigned[i], assigned[j]]);
      }
    }
  }
  return pairs;
}

function computeAutoDeductionCells() {
  const autoMap = {};
  for (const [aId, bId] of gatherSameHousePairs()) {
    const a = parseToken(aId);
    const b = parseToken(bId);
    if (a.category === b.category) continue;

    const pairOrder = rowOrder.indexOf(a.category) < rowOrder.indexOf(b.category) ? [a, b] : [b, a];
    setAutoCell(autoMap, pairOrder[0].category, pairOrder[1].category, pairOrder[0].value, pairOrder[1].value, "yes");
  }
  createAutoCellsFromYes(autoMap);
  return autoMap;
}

function findTokenHouse(token) {
  for (const house of houses) {
    if (state.assignments[token.category][house] === token.value) {
      return house;
    }
  }
  return null;
}

function unassignToken(token) {
  const house = findTokenHouse(token);
  if (house !== null) {
    state.assignments[token.category][house] = null;
  }
}

function assignToken(token, house) {
  unassignToken(token);
  if (state.assignments[token.category][house] !== null) {
    return false;
  }
  state.assignments[token.category][house] = token.value;
  return true;
}

function tokensInGroup(tokenIdValue) {
  const groupId = state.groups[tokenIdValue];
  if (!groupId) {
    return [tokenIdValue];
  }
  return Object.entries(state.groups)
    .filter(([, gid]) => gid === groupId)
    .map(([id]) => id);
}

function tryAssignWithGroup(primaryId, targetHouse) {
  const grouped = tokensInGroup(primaryId).map(parseToken);
  const targetSnapshot = JSON.parse(JSON.stringify(state.assignments));

  for (const token of grouped) {
    for (const house of houses) {
      if (targetSnapshot[token.category][house] === token.value) {
        targetSnapshot[token.category][house] = null;
      }
    }

    if (targetSnapshot[token.category][targetHouse] !== null) {
      return false;
    }
    targetSnapshot[token.category][targetHouse] = token.value;
  }

  state.assignments = targetSnapshot;
  return true;
}

function renderBoard() {
  const grid = document.createElement("div");
  grid.className = "board-grid";

  grid.appendChild(makeCell("Category", "row-label cell"));
  for (const house of houses) {
    grid.appendChild(makeCell(`House ${house}`, "house-label cell"));
  }

  for (const category of rowOrder) {
    grid.appendChild(makeCell(rowLabels[category], "row-label cell"));

    for (const house of houses) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const zone = document.createElement("div");
      zone.className = "drop-zone";
      zone.dataset.category = category;
      zone.dataset.house = String(house);

      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        const token = parseToken(id);

        if (token.category !== category) {
          setStatus("Drop into the matching row/category.");
          return;
        }

        const ok = tryAssignWithGroup(id, house);
        if (!ok) {
          setStatus("Cannot place: another linked item is blocking that house.");
          return;
        }

        setStatus(`Placed ${token.value} into House ${house}.`);
        render();
      });

      const value = state.assignments[category][house];
      if (value) {
        zone.appendChild(createTokenElement(tokenId(category, value), true));
      }

      cell.appendChild(zone);
      grid.appendChild(cell);
    }
  }

  boardEl.innerHTML = "";
  boardEl.appendChild(grid);
}

function makeCell(text, className) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

function createTokenElement(id, onBoard = false) {
  const { value } = parseToken(id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "token";
  btn.draggable = true;
  btn.dataset.id = id;
  btn.textContent = value;

  const groupId = state.groups[id];
  if (groupId) {
    btn.dataset.group = String(groupId);
    const badge = document.createElement("span");
    badge.className = "group-badge";
    badge.textContent = `G${groupId}`;
    btn.appendChild(badge);
  }

  if (state.selected.has(id)) {
    btn.classList.add("selected");
  }

  btn.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", id);
  });

  btn.addEventListener("click", () => {
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    render();
  });

  if (onBoard) {
    btn.addEventListener("dblclick", () => {
      unassignToken(parseToken(id));
      setStatus(`Removed ${value} from board.`);
      render();
    });
  }

  return btn;
}

function renderTokenPools() {
  const wrapper = document.createElement("div");
  wrapper.className = "token-groups";

  for (const category of rowOrder) {
    const group = document.createElement("div");
    group.className = "token-group";

    const title = document.createElement("h3");
    title.textContent = rowLabels[category];

    const list = document.createElement("div");
    list.className = "token-list";

    for (const value of categories[category]) {
      const id = tokenId(category, value);
      list.appendChild(createTokenElement(id));
    }

    group.appendChild(title);
    group.appendChild(list);
    wrapper.appendChild(group);
  }

  const help = document.createElement("p");
  help.textContent =
    "Tip: double-click any token placed on the board to send it back to the pool.";

  tokensEl.innerHTML = "";
  tokensEl.appendChild(wrapper);
  tokensEl.appendChild(help);
}

function getGroupMembers(groupId) {
  return Object.entries(state.groups)
    .filter(([, gid]) => gid === groupId)
    .map(([id]) => id);
}

function validateCategories(ids) {
  const categoriesSeen = new Set();
  for (const id of ids) {
    const { category } = parseToken(id);
    if (categoriesSeen.has(category)) {
      return "One group can only have one value per category.";
    }
    categoriesSeen.add(category);
  }
  return null;
}

function glueSelected() {
  const selection = [...state.selected];
  if (selection.length < 2) {
    setStatus("Select at least 2 items to create/extend a relation.");
    return;
  }

  const existingGroupIds = [...new Set(selection.map((id) => state.groups[id]).filter(Boolean))];
  const candidateIds = new Set(selection);

  for (const gid of existingGroupIds) {
    for (const memberId of getGroupMembers(gid)) {
      candidateIds.add(memberId);
    }
  }

  const categoryProblem = validateCategories([...candidateIds]);
  if (categoryProblem) {
    setStatus(categoryProblem);
    return;
  }

  let targetGroupId;
  if (existingGroupIds.length === 0) {
    targetGroupId = state.nextGroupId++;
  } else {
    targetGroupId = existingGroupIds[0];
  }

  for (const id of candidateIds) {
    state.groups[id] = targetGroupId;
  }

  for (const oldGroupId of existingGroupIds.slice(1)) {
    for (const memberId of getGroupMembers(oldGroupId)) {
      state.groups[memberId] = targetGroupId;
    }
  }

  state.selected.clear();
  setStatus(`Updated relation group G${targetGroupId}.`);
  render();
}

function unglueSelected() {
  const selection = [...state.selected];
  if (selection.length === 0) {
    setStatus("Select at least one item to unglue.");
    return;
  }

  let removed = 0;
  for (const id of selection) {
    const gid = state.groups[id];
    if (!gid) continue;

    const members = getGroupMembers(gid);

    for (const memberId of members) {
      delete state.groups[memberId];
      removed += 1;
    }
  }

  state.selected.clear();
  setStatus(removed > 0 ? "Unglued selected groups." : "No glue links found for selection.");
  render();
}

function resetBoard() {
  for (const category of rowOrder) {
    for (const house of houses) {
      state.assignments[category][house] = null;
    }
  }

  state.groups = {};
  state.sandbox.links = [];
  state.sandbox.selectedLinkId = null;
  state.selected.clear();
  state.nextGroupId = 1;
  setStatus("Board reset.");
  render();
}

function clearManualDeductionMarks() {
  state.deduction.manualCells = {};
  setStatus("Manual deduction marks cleared.");
  renderDeductionBoard();
  scheduleSave();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function toggleManualDeductionCell(key) {
  const current = state.deduction.manualCells[key] || "unknown";
  if (current === "unknown") {
    state.deduction.manualCells[key] = "yes";
  } else if (current === "yes") {
    state.deduction.manualCells[key] = "no";
  } else {
    delete state.deduction.manualCells[key];
  }
  renderDeductionBoard();
  scheduleSave();
}

function renderDeductionBoard() {
  const autoMap = computeAutoDeductionCells();
  deductionBoardEl.innerHTML = "";

  for (const [leftCategory, rightCategory] of getDeductionPairs()) {
    const wrapper = document.createElement("div");
    wrapper.className = "deduction-pair";

    const title = document.createElement("h3");
    title.textContent = `${rowLabels[leftCategory]} × ${rowLabels[rightCategory]}`;

    const table = document.createElement("table");
    table.className = "deduction-table";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    const blank = document.createElement("th");
    blank.textContent = rowLabels[leftCategory];
    trHead.appendChild(blank);
    for (const rightValue of categories[rightCategory]) {
      const th = document.createElement("th");
      th.textContent = rightValue;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const leftValue of categories[leftCategory]) {
      const tr = document.createElement("tr");
      const label = document.createElement("th");
      label.textContent = leftValue;
      tr.appendChild(label);

      for (const rightValue of categories[rightCategory]) {
        const key = cellKey(leftCategory, rightCategory, leftValue, rightValue);
        const autoValue = autoMap[key];
        const manualValue = state.deduction.manualCells[key];
        const effective = manualValue && manualValue !== "unknown" ? manualValue : autoValue || "unknown";
        const conflict = manualValue && autoValue && manualValue !== autoValue;

        const td = document.createElement("td");
        td.className = "deduction-cell";
        if (autoValue) td.classList.add("auto");
        if (manualValue) td.classList.add("manual");
        if (conflict) td.classList.add("conflict");

        td.textContent = conflict ? "⚠" : effective === "yes" ? "✓" : effective === "no" ? "✗" : "";
        td.title = conflict
          ? `Konflikt: manual=${manualValue}, auto=${autoValue}`
          : autoValue
            ? `Auto: ${autoValue}`
            : "Manual";
        td.addEventListener("click", () => toggleManualDeductionCell(key));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(title);
    wrapper.appendChild(table);
    deductionBoardEl.appendChild(wrapper);
  }
}

let saveTimer = null;

function saveSession(options = {}) {
  const { silent = false } = options;
  const payload = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    assignments: state.assignments,
    groups: state.groups,
    sandbox: state.sandbox,
    deduction: state.deduction,
    nextGroupId: state.nextGroupId,
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (!silent) {
    setStatus(`Session saved (${new Date().toLocaleTimeString()}).`);
  }
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveSession({ silent: true });
    saveTimer = null;
  }, 250);
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function loadSession() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;

    if (parsed.assignments && typeof parsed.assignments === "object") {
      for (const category of rowOrder) {
        const incoming = parsed.assignments[category];
        if (!incoming || typeof incoming !== "object") continue;
        for (const house of houses) {
          state.assignments[category][house] = incoming[house] ?? null;
        }
      }
    }

    if (parsed.groups && typeof parsed.groups === "object") {
      state.groups = parsed.groups;
    }

    if (parsed.sandbox && typeof parsed.sandbox === "object") {
      state.sandbox.positions = parsed.sandbox.positions || {};
      state.sandbox.links = Array.isArray(parsed.sandbox.links) ? parsed.sandbox.links : [];
      state.sandbox.nextLinkId =
        typeof parsed.sandbox.nextLinkId === "number" && parsed.sandbox.nextLinkId > 0
          ? parsed.sandbox.nextLinkId
          : 1;
      state.sandbox.selectedLinkId =
        typeof parsed.sandbox.selectedLinkId === "number" ? parsed.sandbox.selectedLinkId : null;
    }

    if (parsed.deduction && typeof parsed.deduction === "object") {
      state.deduction.manualCells = parsed.deduction.manualCells || {};
    }

    if (typeof parsed.nextGroupId === "number" && parsed.nextGroupId > 0) {
      state.nextGroupId = parsed.nextGroupId;
    }

    if ((parsed.schemaVersion || 1) < STORAGE_SCHEMA_VERSION) {
      ensureSandboxPositions();
      saveSession();
    }

    return true;
  } catch {
    return false;
  }
}

function render() {
  renderBoard();
  renderTokenPools();
  renderSandboxGroups();
  renderFreeSandbox();
  renderDeductionBoard();
  scheduleSave();
}

function renderSandboxGroups() {
  const groups = {};
  for (const [id, groupId] of Object.entries(state.groups)) {
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(id);
  }

  sandboxGroupsEl.innerHTML = "";
  const groupIds = Object.keys(groups).sort((a, b) => Number(a) - Number(b));

  if (groupIds.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Brak relacji. Zaznacz minimum 2 etykiety i kliknij Glue Selected.";
    sandboxGroupsEl.appendChild(empty);
    return;
  }

  for (const groupId of groupIds) {
    const card = document.createElement("div");
    card.className = "sandbox-group";

    const header = document.createElement("div");
    header.className = "sandbox-group-header";

    const title = document.createElement("p");
    title.className = "sandbox-group-title";
    title.textContent = `Group G${groupId}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove Group";
    removeBtn.addEventListener("click", () => {
      for (const memberId of groups[groupId]) {
        delete state.groups[memberId];
      }
      setStatus(`Removed group G${groupId}.`);
      render();
    });

    header.appendChild(title);
    header.appendChild(removeBtn);

    const items = document.createElement("div");
    items.className = "sandbox-group-items";
    for (const id of groups[groupId]) {
      items.appendChild(createTokenElement(id));
    }

    card.appendChild(header);
    card.appendChild(items);
    sandboxGroupsEl.appendChild(card);
  }
}

function getTokenCenterInSandbox(id) {
  const pos = state.sandbox.positions[id];
  if (!pos) return null;
  return { x: pos.x + 45, y: pos.y + 16 };
}

function createSandboxLink(type) {
  const selection = [...state.selected];
  if (selection.length !== 2) {
    setStatus("Select exactly 2 labels to add a sandbox relation.");
    return;
  }

  const [a, b] = selection;
  const exists = state.sandbox.links.some(
    (link) => link.type === type && ((link.a === a && link.b === b) || (link.a === b && link.b === a)),
  );
  if (exists) {
    setStatus("This relation already exists in sandbox.");
    return;
  }

  state.sandbox.links.push({
    id: state.sandbox.nextLinkId++,
    a,
    b,
    type,
  });
  setStatus(`Added relation: ${type}.`);
  render();
}

function deleteSandboxLink(id) {
  state.sandbox.links = state.sandbox.links.filter((link) => link.id !== id);
  if (state.sandbox.selectedLinkId === id) {
    state.sandbox.selectedLinkId = null;
  }
  setStatus("Relation removed.");
  render();
}

function resetSelectedSandboxLink() {
  if (!state.sandbox.selectedLinkId) {
    setStatus("Select a relation in sandbox first.");
    return;
  }
  deleteSandboxLink(state.sandbox.selectedLinkId);
}

function makeSandboxDraggable(el, id) {
  let dragState = null;
  el.addEventListener("pointerdown", (event) => {
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: state.sandbox.positions[id].x,
      originY: state.sandbox.positions[id].y,
    };
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    state.sandbox.positions[id].x = Math.max(0, dragState.originX + dx);
    state.sandbox.positions[id].y = Math.max(0, dragState.originY + dy);
    renderFreeSandbox();
    scheduleSave();
  });

  el.addEventListener("pointerup", () => {
    dragState = null;
  });
}

function renderFreeSandbox() {
  ensureSandboxPositions();
  freeSandboxItemsEl.innerHTML = "";
  sandboxLinksSvgEl.innerHTML = "";
  sandboxLinksListEl.innerHTML = "";

  for (const id of getAllTokenIds()) {
    const item = createTokenElement(id);
    item.classList.add("sandbox-item");
    const pos = state.sandbox.positions[id];
    item.style.left = `${pos.x}px`;
    item.style.top = `${pos.y}px`;
    makeSandboxDraggable(item, id);
    freeSandboxItemsEl.appendChild(item);
  }

  for (const link of state.sandbox.links) {
    const a = getTokenCenterInSandbox(link.a);
    const b = getTokenCenterInSandbox(link.b);
    if (!a || !b) continue;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(a.x));
    line.setAttribute("y1", String(a.y));
    line.setAttribute("x2", String(b.x));
    line.setAttribute("y2", String(b.y));
    line.setAttribute("class", "sandbox-link-line");
    sandboxLinksSvgEl.appendChild(line);
  }

  const list = document.createElement("ul");
  list.className = "sandbox-link-list";
  if (state.sandbox.links.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No free-sandbox links yet. Select 2 labels and add a relation.";
    sandboxLinksListEl.appendChild(empty);
    return;
  }
  for (const link of state.sandbox.links) {
    const row = document.createElement("li");
    row.className = "sandbox-link-row";
    if (state.sandbox.selectedLinkId === link.id) {
      row.classList.add("selected");
    }

    const left = document.createElement("span");
    left.textContent = `${parseToken(link.a).value} ${link.type} ${parseToken(link.b).value}`;
    row.addEventListener("click", () => {
      state.sandbox.selectedLinkId = state.sandbox.selectedLinkId === link.id ? null : link.id;
      renderFreeSandbox();
      scheduleSave();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSandboxLink(link.id);
    });

    row.appendChild(left);
    row.appendChild(removeBtn);
    list.appendChild(row);
  }
  sandboxLinksListEl.appendChild(list);
}

glueBtn.addEventListener("click", glueSelected);
unglueBtn.addEventListener("click", unglueSelected);
resetBtn.addEventListener("click", resetBoard);
saveBtn.addEventListener("click", () => {
  saveSession();
});
restoreBtn.addEventListener("click", () => {
  const ok = loadSession();
  ensureSandboxPositions();
  render();
  setStatus(ok ? "Session restored." : "No saved session found.");
});
clearSessionBtn.addEventListener("click", () => {
  clearSession();
  setStatus("Session storage cleared.");
});
clearDeductionBtn.addEventListener("click", clearManualDeductionMarks);
linkSameBtn.addEventListener("click", () => createSandboxLink("same_house"));
linkLeftBtn.addEventListener("click", () => createSandboxLink("left_of"));
linkNextBtn.addEventListener("click", () => createSandboxLink("next_to"));
resetSelectedLinkBtn.addEventListener("click", resetSelectedSandboxLink);

const restored = loadSession();
ensureSandboxPositions();
render();
setStatus(restored ? "Session restored." : "Ready.");
