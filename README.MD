# [PSRD Curl Sphere Streams](https://metarapi.github.io/psrd-curl-sphere-streams)

This project started as a chain of small obsessions.

First: PSRDnoise is just cool. The `alpha` parameter in `psrdnoise3` makes the noise feel less like a static texture source and more like something you can steer. Rather by chance, I then ran into [bitangent noise](https://github.com/atyuwen/bitangent_noise), along with the note that the same core idea had already shown up in Ivan DeWolf's work back in 2005. That in turn led me to Bærentzen et al.'s 2025 paper on *"Improving Curl Noise"*, and from there the direction became clearer: use the analytic gradient of PSRDnoise, cross it with the sphere normal, and get a vector field that is perfectly tangent to the sphere by construction.

I initially liked the fragment-shader accumulation style used in [`fieldplay`](https://github.com/anvaka/fieldplay), but it did not feel great in 3D. Doing it in screen space caused too much visual ghosting. So this repo became the "do it properly in geometry" version of that idea: keep the flow strictly on the sphere itself, advect particles in a compute shader, and render actual ribbon geometry instead of relying on a post-process framebuffer smear.

## What The App Does

This is a WebGPU prototype that builds a live cubemap vector field on the GPU and uses it to drive ribbon particles around a sphere.

- A **compute pass** evaluates `psrdnoise3`, extracts its analytic gradient, and builds a tangent flow field on the six faces of a cubemap-style texture.
- The cube faces are pushed onto the sphere using the cube-to-sphere mapping from Phil's Math Proofs post. This keeps the surface distribution much more even than naive normalization (although this is not strictly required for flow, I like it quite a bit for if/when I want to do displacement mapping).
- A **second compute pass** advects particles directly on the sphere, keeping a short ring-buffer history of the left and right ribbon edges for each particle.
- The **render pass** draws the sphere once, then draws the trails as instanced ribbon segments. Because it's actual 3D geometry, the motion remains perfectly stable under camera movement.

In practice, this repo is less about making a finished, polished effect and more about testing whether the combination of PSRD gradients, surface-tangent bitangent noise, and instanced ribbons feels like a solid foundation for spherical flow visuals. It does.

## Math + How It Works

The core construction is the bitangent / cross-gradient idea:

$$
\nabla \cdot (\nabla f_1 \times \nabla f_2) = 0
$$

For a sphere, one of those gradients becomes the sphere's implicit normal field:

$$
n(x) = \frac{x}{||x||}
$$

In this implementation, the vector field direction is built as:

$$
V(x, \alpha) = n(x) \times \nabla N(x \cdot \text{frequency}, \alpha)
$$

*(This is the same construction as $\nabla N \times n$ up to a sign flip, which only changes the swirl direction). *

Because of the cross product, the field is mathematically tangent to the sphere:

$$
V \cdot n = 0
$$

So the particles move exactly along the surface instead of drifting radially into space or diving into the core.

### The Cubemap Mapping
Cubemap texels are mapped to the sphere using the [cube-to-sphere transform](http://mathproofs.blogspot.com/2005/07/mapping-cube-to-sphere.html):

$$
s_x = x \sqrt{1 - \frac{y^2}{2} - \frac{z^2}{2} + \frac{y^2z^2}{3}}
$$
$$
s_y = y \sqrt{1 - \frac{z^2}{2} - \frac{x^2}{2} + \frac{z^2x^2}{3}}
$$
$$
s_z = z \sqrt{1 - \frac{x^2}{2} - \frac{y^2}{2} + \frac{x^2y^2}{3}}
$$

This gives a significantly more even surface distribution than standard normalization, helping keep the field behavior visually consistent across the cube edges and corners.

### The Pipeline
Per frame, the simulation runs as follows:

1. **Build Field:** Evaluate the PSRD gradient on the cubemap faces using the `alpha`-controlled rotation.
2. **Sample Field:** Sample the field at each particle's current direction and project it into tangent space.
3. **Advect:** Advance the particle's direction using a sphere-constrained Euler step:

   ```math
   \begin{aligned}
   d_{next} &= \text{normalize}\left( d + \left(\frac{\Delta t}{R}\right) \cdot v_{tangent} \right) \\
   p_{next} &= R \cdot d_{next}
   \end{aligned}
   ```

4. **Construct Geometry:** Build ribbon edges from the tangent/side vectors and write them into a per-particle ring buffer.vectors and write them into a per-particle ring buffer.
5. **Render:** Draw instanced ribbon segments from that history. 

**Alpha** is the animation dial inside PSRD: as $\alpha$ sweeps from $0$ to $2\pi$, the underlying noise gradient basis rotates smoothly and the flow pattern evolves continuously, giving the illusion of a complex, evolving fluid without evaluating a 4D noise function.

## Run

```bash
npm install
npm run dev
```

*Requires a browser with WebGPU enabled.*

## References

- Stefan Gustavson and Ian McEwan, `psrdnoise`: [github.com/stegu/psrdnoise](https://github.com/stegu/psrdnoise)
- atyuwen, Bitangent Noise: [github.com/atyuwen/bitangent_noise](https://github.com/atyuwen/bitangent_noise)
- anvaka, `fieldplay`: [github.com/anvaka/fieldplay](https://github.com/anvaka/fieldplay)
- Bærentzen et al., "Improving Curl Noise", SIGGRAPH Asia 2025, DOI: [10.1145/3757377.3763980](https://doi.org/10.1145/3757377.3763980)
- Phil, "Mapping a Cube to a Sphere": [Math Proofs Blog (2005)](http://mathproofs.blogspot.com/2005/07/mapping-cube-to-sphere.html)
- PETROCKET, Notes on sphere-to-cube mapping: [Petrocket Blog (2010)](http://petrocket.blogspot.com/2010/04/sphere-to-cube-mapping.html)