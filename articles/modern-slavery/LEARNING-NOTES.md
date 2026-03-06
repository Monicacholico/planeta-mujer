# Learning Notes — Modern Slavery Visualization

Technical concepts learned while building this project, organized for quick reference.

---

## Canvas

### ctx.setTransform (Retina/HiDPI support)
`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` scales Canvas drawing for Retina screens. Unlike SVG or `<img>`, Canvas is a raw pixel buffer — on a 2× screen, 100 CSS pixels = 200 physical pixels. Without this, the browser stretches a low-res buffer and it looks blurry.

**Boilerplate for any Canvas project:**
```js
const dpr = window.devicePixelRatio || 1;
canvas.width = cssWidth * dpr;
canvas.height = cssHeight * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

### vx / vy (velocity)
`x, y` = where a dot IS. `vx, vy` = where it's GOING. Each frame: `d.x += d.vx`. A random angle is converted to x/y velocity with `Math.cos(angle)` and `Math.sin(angle)`.

### Friction (velocity decay)
`d.vx *= 0.96` means velocity keeps 96% of its speed per frame. Movement decays exponentially — feels natural, not mechanical. Once velocity drops below `MIN_SPEED`, dots get nudged back to a gentle drift.

### Math.atan2(y, x)
Returns the angle from origin to point (x, y). The inverse of cos/sin: cos and sin go from angle → x,y; atan2 goes from x,y → angle. Unlike `Math.atan(y/x)`, atan2 handles all four quadrants correctly.

**Used in:** nudging slow dots — keeps their current direction but adds a small random wiggle.

---

## D3 / Geographic

### TopoJSON → GeoJSON → Projection chain
TopoJSON gives geographic coordinates (lon/lat). The full chain:
1. `topojson.feature(world, world.objects.countries)` → GeoJSON features
2. `d3.geoMercator().fitExtent(bounds, feature)` → creates a projection function
3. `projection([lon, lat])` → pixel coordinates [x, y]

The projection handles all the scaling. You just change the bounds for different screen sizes.

### d3.geoBounds vs screen bounds
Two different "bounds":
- **Screen bounds** — pixel rectangle we define: `[[left, top], [right, bottom]]`
- **d3.geoBounds(feature)** — geographic bounding box in lon/lat, e.g. Argentina `[[-73.4, -55.1], [-53.6, -21.8]]`

Screen bounds → projection setup. Geographic bounds → rejection sampling.

### d3.geoContains(feature, [lon, lat])
Point-in-polygon test: is this geographic coordinate inside this country's borders? Central to rejection sampling.

### d3.fitExtent(bounds, feature)
Configures a projection so a GeoJSON feature fits within a pixel rectangle. Handles scaling and centering automatically.

### Rejection sampling
Generate random points inside an irregular shape:
1. Get `d3.geoBounds(feature)` — the bounding rectangle in lon/lat
2. Pick random lon/lat inside that rectangle
3. Test with `d3.geoContains(feature, [lon, lat])`
4. If inside → keep. If outside → reject and retry.
5. Loop until you have enough points.

Like throwing 10,000 beads at a country outline — keep only the ones that land inside.

### GeoJSON winding order
On a sphere, a closed ring divides it into TWO areas. Winding order tells D3 which side is "inside":
- **Counter-clockwise** = the smaller area (the country)
- **Clockwise** = the larger area (the entire globe minus the country)

**The walking analogy:** Walk along Argentina's border counter-clockwise → land is always to your LEFT. Walk clockwise → land is to your RIGHT, and the rest of the world is to your left. D3 says "inside" is always to your left.

```
Counter-clockwise (CORRECT):     Clockwise (WRONG):
SW → NW → NE → SE → SW           SW → SE → NE → NW → SW
D3 sees: "Argentina"              D3 sees: "entire Earth minus Argentina"
```

Same four corners, same rectangle. Only the order changes. On a flat screen they look identical. On a sphere, one means "Argentina" and the other means "the whole planet."

**GeoJSON spec (RFC 7946):** Exterior rings MUST be counter-clockwise. Not a bug — a design decision for spherical geometry.

### d3.forceSimulation
Only requires nodes. Forces are added with `.force("name", forceType)`. Common forces: `forceX`, `forceY`, `forceCollide`, `forceCenter`, `forceManyBody`, `forceLink`.

In this project: `forceX(d => d.tx)` and `forceY(d => d.ty)` pull dots toward target positions. `velocityDecay(0.35)` = damping. `alphaDecay(0.015)` = how fast the simulation cools down.

---

## Animation / Physics

### requestAnimationFrame — not recursion, not closure
`requestAnimationFrame(tick)` does NOT call tick recursively. It hands tick to the browser and says "run this the next time you paint (~16ms from now)." The current call finishes and returns. The browser later calls tick fresh. One execution per frame, call stack stays flat.

### Linear Interpolation (lerp)
**The formula:**
```js
current += (target - current) * t
```

`t` is a blending factor (0 to 1), NOT raw time. Small t = slow/smooth. Large t = fast/snappy.

**Used everywhere in this project:**
- **Color blending:** `colorBlend += (colorBlendTarget - colorBlend) * 0.025`
- **Highlight count:** `highlightCount += (highlightTarget - highlightCount) * 0.04`
- **Label opacity:** `circleLabelOpacity += (1 - circleLabelOpacity) * 0.06`
- **Dot colors:** `fr = r + (gr - r) * p` (p = colorBlend factor)

This creates exponential easing — rushes toward the target at first, then slows as it gets closer. Once you see it, you notice it everywhere: camera smoothing, scroll animation, physics, audio, 3D.

### Two-engine system
Two physics engines coexist, controlled by `shapeMode`:
- **shapeMode = null** → manual Canvas physics (drift with vx/vy + friction)
- **shapeMode = "argentina"/"circle"/etc.** → D3 force simulation (forceX/forceY toward targets)

In `tick()`: `if (shapeMode) simulation.tick(); else driftDots();` — only one engine runs at a time.

---

## Patterns / Architecture

### Binary search / d3.bisector
Finds the closest data point for a given value (e.g. mouse position → year). Halves the search space each step: O(log n) instead of O(n).

**The dictionary analogy:** Looking for a word starting with C — you don't search after D. You open to the middle, check if you're before or after C, and keep halving.

```js
const bisect = d3.bisector(d => d.year).left;
const i = bisect(data, year, 1);
```

### Pre-computation
If a calculation is expensive and the inputs never change, do it once offline and store the result. At runtime, just load and project.

**In this project:** Rejection sampling for 10,000 world map points ran offline in a Node.js script (~10 seconds). Saved as JSON (138KB). At runtime: zero polygon tests. Just 10,000 simple `projection([lon, lat])` calls — instant.

### colorBlend / highlightCount — state-driven animation
One number controls all dot colors. Step handlers only set the TARGET. The animation loop smoothly lerps toward it every frame.

- `colorBlend` (0 = diverse palette, 1 = gender colors)
- `highlightCount` (number of dots to highlight in gold)
- `circleLabelOpacity` (label fade in/out)

Three layers of color in draw(): base palette → gender blend → highlight blend.

---

## Performance

### Main-thread blocking
Running heavy computation (like rejection sampling for 150+ countries) on the main thread blocks everything: animation, scroll events, CSS transitions. Solutions:
- **Pre-computation** — do the work offline, store results
- **Chunking** — process in small batches with `setTimeout(fn, 0)` to yield between chunks
- **Resize guards** — skip recomputation for small height changes (Android URL bar)

### Android viewport units (100vh vs dvh vs svh)
- `100vh` = max viewport (URL bar hidden) — stable but leaves a gap when bar is visible
- `100dvh` = dynamic, changes as URL bar animates — causes constant resizing, bad for Scrollama
- `100svh` = smallest viewport (URL bar visible) — stable, good for scroll step heights

**Solution:** `100vh` for canvas wrapper (stable, no gap at top). `100svh` for step sections (stable, works with IntersectionObserver). Never use `visualViewport` resize for Scrollama.

---

## Scrollama

### Setup pattern
```js
const scroller = scrollama();
scroller
    .setup({ step: ".step", offset: 0.5 })
    .onStepEnter(({ element, direction }) => {
        handleStep(element.dataset.step, direction);
    })
    .onStepExit(({ element, direction }) => {
        // cleanup
    });
```

`step` = the elements observed. `offset` = where the trigger line is (0.5 = middle of viewport). `onStepEnter` fires when a step crosses the trigger line.

---

## D3 General

### Enter / Update / Exit
- `.enter()` = new data without DOM elements → create them
- `.exit()` = DOM elements without data → remove them
- Update = data matched to existing elements → modify them

`petals.exit().remove()` removes DOM elements that no longer have matching data (e.g. after filtering).

### d3.range(n)
Returns `[0, 1, 2, ..., n-1]`. Quick way to generate an array of indices.

### Map() vs Array.map()
- `Array.map()` — transforms each element of an array
- `new Map()` — key-value data structure (like a dictionary)

`new Map(features.map(f => [f, assignRegion(f)]))` creates a Map from [key, value] pairs.
