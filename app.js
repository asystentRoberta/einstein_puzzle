const categories = {
  color: ["Red", "Green", "White", "Yellow", "Blue"],
  nationality: ["Brit", "Swede", "Dane", "Norwegian", "German"],
  drink: ["Tea", "Coffee", "Milk", "Beer", "Water"],
  smoke: ["Pall Mall", "Dunhill", "Blends", "BlueMaster", "Prince"],
  pet: ["Dogs", "Birds", "Cats", "Horse", "Fish"],
};

const rowOrder = ["color", "nationality", "drink", "smoke", "pet"];
const rowLabels = {
  color: "Color",
  nationality: "Nationality",
  drink: "Drink",
  smoke: "Cigarettes",
  pet: "Pet",
};

const houses = [1, 2, 3, 4, 5];
const STORAGE_KEY = "einstein-puzzle-session-state-v1";
const state = {
  assignments: {},
  groups: {},
  selected: new Set(),
  nextGroupId: 1,
};

for (const category of rowOrder) {
  state.assignments[category] = { 1: null, 2: null, 3: null, 4: null, 5: null };
}

const boardEl = document.getElementById("board");
const tokensEl = document.getElementById("tokens");
const sandboxGroupsEl = document.getElementById("sandbox-groups");
const glueBtn = document.getElementById("glue-btn");
const unglueBtn = document.getElementById("unglue-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

function tokenId(category, value) {
  return `${category}:${value}`;
}

function parseToken(id) {
  const [category, value] = id.split(":");
  return { category, value };
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
  state.selected.clear();
  state.nextGroupId = 1;
  setStatus("Board reset.");
  render();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function saveState() {
  const payload = {
    assignments: state.assignments,
    groups: state.groups,
    nextGroupId: state.nextGroupId,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
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

    if (typeof parsed.nextGroupId === "number" && parsed.nextGroupId > 0) {
      state.nextGroupId = parsed.nextGroupId;
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
  saveState();
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

glueBtn.addEventListener("click", glueSelected);
unglueBtn.addEventListener("click", unglueSelected);
resetBtn.addEventListener("click", resetBoard);

const restored = loadState();
render();
setStatus(restored ? "Session restored." : "Ready.");
