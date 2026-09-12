# BAYLINE — BUILD 02 / HD

2026-09-12

## Changes

- Procedural 1024px asphalt and facade textures with bump, roughness and matched window emission; rain adjusts road gloss.
- Detailed original car models: shaped bodywork, clearcoat, reflective glass, grilles, mirrors, exhausts, wheel arches and animated wheels.
- Layered sky, warm directional light, local environment capture, fine shadow presets, bloom, color grading and anti-aliasing. Ultra adds GTAO contact shading.
- Added building entrances, balconies, shop glazing, rooftop equipment and roadside props.
- Four quality tiers: low / medium / high / ultra. Default high; optional automatic downgrade can be switched off.
- Sprint changed from 8 to 14 m/s (1.75x), walking remains 4.6 m/s. Both co-op players use the same simulation. Collision substeps and actual movement speed reporting retained.
- Landscape / portrait / auto controls on title, HUD and settings. Native orientation lock when available; otherwise rotate the logical in-page viewport, including touch input and modal layout.
- Save format, 12 chapters and login-free 2-player networking preserved. Previous modules retained; versioned HD entry avoids mixing old and new modules.

## Verification for this build

- Nine Node simulation/geometry checks passed: sprint, diagonal speed, both players, walls, saves, shared vehicle seating, finite outward-facing car geometry and accelerated ten-minute simulation.
- Eighteen offline Chromium UI checks passed using real game simulation/input with a stub renderer: portrait/landscape fallback, real multi-touch joystick plus sprint, input release, settings and automatic layout.
- Three.js scene-object integration passed across all four tiers: 819 meshes, 25 cars, finite geometry and six postprocessing passes. Renderer and environment capture were stubbed.
- No actual GPU shader compilation, rendered-image review, real-phone frame-rate measurement or new end-to-end internet co-op test was possible in this execution environment. Previous build reports do not substitute for those tests.

## Scope

This is enhanced procedural browser 3D, not PS5 GTA-quality photorealism. Ultra can be expensive on mobile devices. The orientation fallback rotates the game area; it cannot override an unsupported operating-system screen lock. Existing saves are retained on the same browser and origin.
