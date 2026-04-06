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

function areValidGlueSelection(selection) {
  if (selection.length !== 2) {
    return "Select exactly 2 items to glue.";
  }

  const [a, b] = selection.map(parseToken);
  if (a.category === b.category) {
    return "Choose items from different categories.";
  }

  return null;
}

function glueSelected() {
  const selection = [...state.selected];
  const problem = areValidGlueSelection(selection);
  if (problem) {
    setStatus(problem);
    return;
  }

  const groupId = state.nextGroupId++;
  for (const id of selection) {
    state.groups[id] = groupId;
  }

  state.selected.clear();
  setStatus(`Created glue group G${groupId}.`);
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

    const members = Object.entries(state.groups)
      .filter(([, groupId]) => groupId === gid)
      .map(([memberId]) => memberId);

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

function render() {
  renderBoard();
  renderTokenPools();
}

glueBtn.addEventListener("click", glueSelected);
unglueBtn.addEventListener("click", unglueSelected);
resetBtn.addEventListener("click", resetBoard);

render();
setStatus("Ready.");
