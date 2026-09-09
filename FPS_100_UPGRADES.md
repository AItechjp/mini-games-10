# LIMINAL ZOMBIE FPS — 100 Improvements Implemented

## Gunfeel / shooting
1. Strong camera shake on every shot.
2. Additional roll shake on heavy impacts.
3. Reduced-motion aware shake scaling.
4. Recoil accumulation while firing rapidly.
5. Recoil recovery over time.
6. Muzzle flash starburst.
7. Muzzle light bloom.
8. Bullet tracer effect.
9. Ejected shell particles.
10. Hit-stop on successful hits.
11. Stronger hit-stop on critical hits.
12. Dynamic crosshair spread from recoil.
13. Dynamic crosshair spread while moving.
14. Green hit marker feedback.
15. Critical-hit feedback.
16. Blood impact particles.
17. Spark particles on critical hits.
18. Environmental impact sparks.
19. Hold-to-fire support on the main FIRE button.
20. Fire-rate limiter for stable gunfeel.

## Weapon / player systems
21. 12-round magazine.
22. Reserve ammunition.
23. Automatic reload on empty magazine.
24. Manual reload with R.
25. Reload animation/drop motion.
26. Sprint with Shift.
27. Stamina system.
28. Stamina regeneration.
29. Weapon walk bob.
30. Weapon sway / recoil rotation.
31. Player health system.
32. Armor absorption system.
33. Damage invulnerability window.
34. Second-wind recovery instead of abrupt run termination.
35. Flashlight toggle with F.
36. Flashlight cone lighting.
37. Health pickups.
38. Ammo pickups.
39. Armor pickups.
40. Pickup glow and rotation effects.

## Enemy variety / AI
41. Walker zombie type.
42. Runner zombie type.
43. Crawler zombie type.
44. Tank zombie type.
45. Spitter zombie type.
46. Brute zombie type.
47. Per-type HP tuning.
48. Per-type speed tuning.
49. Per-type body size / hit radius.
50. Per-type melee damage.
51. Per-type score rewards.
52. Line-of-sight aggro.
53. Hearing aggro after gunfire.
54. Enemy separation to reduce stacking.
55. Collision-aware wall steering.
56. Dynamic spawn population.
57. Difficulty scaling with progress.
58. Ranged acid projectiles for spitters.
59. Acid projectile collision and damage.
60. Enemy hit-react slowdown.

## Boss / combat pacing
61. Final boss with 34 HP.
62. Large custom boss silhouette.
63. Boss health bar.
64. Boss phase-two transition at 50% HP.
65. Phase-two speed increase.
66. Boss charge behavior.
67. Boss ranged acid attacks.
68. Boss phase-two minion reinforcements.
69. Enrage stage banner.
70. Large boss death particle burst.
71. Heavy boss death camera shake.
72. Slow-motion boss death finish.
73. Final-stage lightning flash.
74. Boss-specific score reward.
75. Boss completion delay for cinematic finish.

## Stages / world / visuals
76. Six different stage maps.
77. Abandoned manor stage.
78. Fog mountain stage.
79. Flooded river passage stage.
80. Drowned sea facility stage.
81. Neon city deadzone stage.
82. Demon castle final stage.
83. Stage-specific wall palettes.
84. Stage-specific floor palettes.
85. Stage-specific ceiling palettes.
86. Distance fog / exposure shading.
87. Procedural wall texture variation.
88. Perspective floor striping.
89. Water shimmer treatment.
90. Rain / spray weather layers.
91. Dust / mist weather layers.
92. Ember weather in demon castle.
93. Random lightning in demon castle.
94. Explosive barrels.
95. Breakable crates.

## HUD / polish / performance
96. Live minimap with nearby enemies.
97. Compass with heading degrees.
98. Combo / multiplier / accuracy HUD and achievements.
99. Adaptive ray count based on frame time for smoother performance.
100. Film grain, vignette, damage tint, low-health emphasis, and chromatic-edge post effects.

All changes are implemented in `fps-game.js` while preserving the existing `window.ARCADE_GAME` interface used by `fps-controller.js` and the existing solo / Supabase online modes.
