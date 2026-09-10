# BLACK SITE cinematic materials

Original, generated albedo textures commissioned for this game with OpenAI's built-in image generator. These are not assets extracted from another game. The full generation prompts are retained in `texture-attribution.json`.

- `stone.webp`: weathered limestone for world-space mapped paving, masonry and rock surfaces.
- `skin.webp`: neutral mottled skin and microdetail for infected characters.
- `fabric.webp`: worn woven fabric for clothes, sleeves and equipment.

Source PNGs were 1254 × 1254. Runtime copies are 1024 × 1024 WebP, quality 88, with mipmaps and capped anisotropic filtering. Combined runtime transfer size is about 1.2 MB. Seamless repetition was requested during generation; the images are not mathematically guaranteed seamless.

All anatomy, architecture, weapon and boss geometry in the cinematic modules is original procedural 3D geometry. The original six-area gameplay, difficulty modes, co-op messages, item effects and controls remain the underlying simulation.

Rendering features: physical materials, a local shadow volume following the player, image-based environment lighting, three nearby practical lights, a movable flashlight, animated water, weather, low ground mist, depth-aware contact shading, restrained bloom, antialiasing and adaptive resolution. Low quality disables the composite pass, shadows and weather but retains the detailed models and textures.
