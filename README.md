# 3D 2x2x2 Rubik's Cube Simulator (Pocket Cube)

A high-performance, fully 3D Pocket Cube simulator and permutation group analysis tool built with Three.js.

**Live Deployment:** [https://rubiks-cube-2x2.vercel.app](https://rubiks-cube-2x2.vercel.app)

---

## Features

- **Realistic 3D Graphics**:
  - 8 corner cubies with rounded beveled geometry and inner core rendered via Three.js.
  - Official WCA color scheme: White (Top / U), Yellow (Bottom / D), Green (Front / F), Blue (Back / B), Red (Right / R), Orange (Left / L).
  - 60fps slice turns with cubic easing and numerical stability.

- **Direct Touch & Mouse Interaction**:
  - Click/touch and drag any sticker directly to rotate the layer.
  - Interactive drag projection with release snap to the nearest $90^\circ$ turn.
  - Right-click / two-finger drag camera orbit controls with damping.

- **Full Cube Naming Schemes**:
  - **GAP24**: Standard permutation representation indexing 1 through 24 across the 6 faces in order (U: 1–4, L: 5–8, F: 9–12, R: 13–16, B: 17–20, D: 21–24).
  - **Singmaster**: Canonical clockwise cyclic Singmaster notation for all 24 corner facelets (e.g. $U_{RF}, R_{FU}, F_{UR}$).
  - **Both**: Simultaneous dual-badge mode showing Singmaster above GAP24 on high-contrast markers.
  - **Current-State Stamping**: Dynamically calculates upright relative rotation based on the current cubie orientation.

- **Facelet & Tracking Drawer**:
  - Place custom tracking dots on any facelet to observe permutation actions.
  - Customizable dot colors via real-time color picker and custom text labels.
  - Save and load dot presets to `localStorage`.
  - 2D Unfolded Net View synchronized in real-time with the 3D cube.

- **Algorithms & Themes**:
  - Valid 11-move WCA 2x2 scrambler and state reset.
  - Preset algorithms (Sexy Move, Sune, T-Perm).
  - Visual themes: Classic WCA, Cyberpunk Neon, Frosted Glass, Carbon Fiber.
  - PWA support with offline caching via Service Worker.

---

## Local Development

Open `index.html` in any modern web browser or serve locally:

```bash
# Python simple HTTP server
python -m http.server 8000
```
