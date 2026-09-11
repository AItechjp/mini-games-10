# Cinematic game materials

Original generated character, prop and navy-marble artwork, created for this project.
- actors-cinematic.webp: 16 characters and vehicles, 1254 × 1254 RGBA.
- props-cinematic.webp: 16 gameplay items, 1254 × 1254 RGBA.
- marble.webp: 1254 × 1254 RGB material.

Use the measured source rectangles in ../sprite-frames.mjs. The generated rows are not exact quarter divisions. Fit each source rectangle inside its target bounds, preserving its aspect ratio. The renderer and contact-shadow cache use the same rectangle. Marble is mapped once per surface; seamless repetition is not assumed.

Only the selected background loads. Sprites and physical surfaces are raster cached within a fixed pixel budget; effects never modify the game state or change online action coordinates.
