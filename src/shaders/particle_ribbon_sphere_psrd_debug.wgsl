struct EdgeSample {
    left: vec4<f32>,
    right: vec4<f32>,
};

struct Particle {
    history: array<EdgeSample, __HISTORY_LEN__>,
    state0: vec4<f32>,
    state1: vec4<f32>,
    state2: vec4<f32>,
};

struct CameraUniforms {
    view_proj: mat4x4<f32>,
    eye: vec4<f32>,
};

struct DebugStyle {
    quad_size: f32,
    alpha: f32,
    _pad0: vec2<f32>,
    color: vec4<f32>,
};

struct VertexInput {
    @location(0) local_uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) alpha: f32,
    @location(1) color: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> style: DebugStyle;

fn safe_normalize(v: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
    let len_v = length(v);
    if (len_v < 1e-6) {
        return fallback;
    }
    return v / len_v;
}

fn project_to_tangent(v: vec3<f32>, n: vec3<f32>) -> vec3<f32> {
    return v - n * dot(v, n);
}

fn orthogonal_tangent(normal: vec3<f32>) -> vec3<f32> {
    let up = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(normal.y) > 0.95);
    return safe_normalize(cross(up, normal), vec3<f32>(1.0, 0.0, 0.0));
}

@vertex
fn vs_main(
    in: VertexInput,
    @builtin(instance_index) particle_id: u32,
) -> VertexOutput {
    var out: VertexOutput;

    let particle = particles[particle_id];
    let head = u32(particle.state0.x + 0.5);
    let age_steps = u32(particle.state0.y + 0.5);
    let particle_state = particle.state0.z;
    let live_weight = clamp(particle.state2.x, 0.0, 1.0);
    let sample = particle.history[head];

    let raw_center = 0.5 * (sample.left.xyz + sample.right.xyz);
    let center_radius = max(length(raw_center), 1e-4);
    let center_normal = safe_normalize(raw_center, vec3<f32>(0.0, 0.0, 1.0));
    let center = center_normal * center_radius;

    let local = (in.local_uv - vec2<f32>(0.5, 0.5)) * (2.0 * style.quad_size);
    let view_tangent = project_to_tangent(camera.eye.xyz - center, center_normal);
    let tangent_u = safe_normalize(view_tangent, orthogonal_tangent(center_normal));
    let tangent_v = safe_normalize(cross(center_normal, tangent_u), orthogonal_tangent(center_normal));
    let world_pos = center + tangent_u * local.x + tangent_v * local.y;

    out.pos = camera.view_proj * vec4<f32>(world_pos, 1.0);
    out.alpha = select(0.0, style.alpha * live_weight, age_steps > 0u || live_weight > 0.0);
    out.color = mix(style.color.rgb, vec3<f32>(1.0, 0.55, 0.18), select(0.0, 1.0, particle_state >= 0.5));
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.alpha <= 0.0) {
        discard;
    }

    return vec4<f32>(in.color * in.alpha, in.alpha);
}