# Entry Routes And Asset Split Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the single HTML page into maintainable assets and add route-based teacher/student entry pages that auto-connect with sensible defaults.

**Architecture:** Keep a single HTML template and a single frontend app, but move CSS and JavaScript into `client/assets/app.css` and `client/assets/app.js`. The FastAPI server will render the HTML template with route-specific bootstrap data for `/client`, `/teacher`, and `/student`, so dedicated entry URLs can preselect role and auto-connect without duplicating UI.

**Tech Stack:** FastAPI, StaticFiles, plain HTML/CSS/JavaScript.

---

## Implementation Outline

1. Move inline CSS from `client/index.html` into `client/assets/app.css`.
2. Move inline JavaScript from `client/index.html` into `client/assets/app.js`.
3. Convert `client/index.html` into a lightweight template that loads the external CSS/JS and exposes server-provided bootstrap data through `data-*` attributes on `<body>`.
4. Add server-side HTML rendering for `/client`, `/teacher`, and `/student`.
5. Use the current route to prefill role/default room and auto-connect only for `/teacher` and `/student`.
6. Keep `/client` as the generic fallback page with manual connect still available.
7. Update the local verification script to validate the new external JS entrypoint and guard against regressions.

## Verification

1. Run `python scripts/check_client_html.py`.
2. Start the local server and verify:
   - `/client` returns `200` with manual mode bootstrap values.
   - `/teacher` returns `200` with `teacher` bootstrap values.
   - `/student` returns `200` with `student` bootstrap values.
   - `/client/assets/app.js` and `/client/assets/app.css` return `200`.
