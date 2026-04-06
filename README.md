# Einstein Puzzle – Sprint 1 POC

Simple vanilla JavaScript proof-of-concept for an Einstein/Fish puzzle helper.

## What is included

- Five fixed houses (1..5)
- Five interactive categories: color, nationality, drink, cigarettes, pet
- Drag-and-drop assignment of values into house slots
- “Glue Selected” sandbox feature to link labels across categories (without choosing a house yet)
- Relation groups can be extended/merged and removed in a dedicated sandbox panel
- Session state is auto-saved in `sessionStorage` while the app is running in the browser tab
- “Unglue Selected” and “Reset Board” actions

## Run locally

No build step is required.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
