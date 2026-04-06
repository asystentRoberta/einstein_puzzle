# Einstein Puzzle – Sprint 1 POC

Simple vanilla JavaScript proof-of-concept for an Einstein/Fish puzzle helper.

## What is included

- Five fixed houses (1..5)
- Five interactive categories: color, nationality, drink, cigarettes, pet
- Drag-and-drop assignment of values into house slots
- “Glue Selected” sandbox feature to link labels across categories (without choosing a house yet)
- Relation groups can be extended/merged and removed in a dedicated sandbox panel
- Free Sandbox area with draggable labels and explicit relation links (`same_house`, `left_of`, `next_to`)
- Session persistence utilities (`Save Session`, `Restore Session`, `Clear Session`) backed by `sessionStorage`
- “Unglue Selected” and “Reset Board” actions

## Run locally

No build step is required.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
