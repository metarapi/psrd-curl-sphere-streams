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

struct RibbonStyle {
    alpha_falloff: f32,
    base_alpha: f32,
    dying_shrink_enabled: f32,
    dying_min_scale: f32,
    head_color: vec4<f32>,
    tail_color: vec4<f32>,
};

struct VertexInput {
    @location(0) local_uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) head_mix: f32,
    @location(1) alpha: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> style: RibbonStyle;

const HISTORY_LEN: u32 = __HISTORY_LEN__u;

fn ring_index(head: u32, newest_offset: u32) -> u32 {
    return (head + HISTORY_LEN - (newest_offset % HISTORY_LEN)) % HISTORY_LEN;
}

@vertex
fn vs_main(
    in: VertexInput,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
    var out: VertexOutput;

    let particle_id = instance_index / (HISTORY_LEN - 1u);
    let segment_id = instance_index % (HISTORY_LEN - 1u);
    let particle = particles[particle_id];

    let head = u32(particle.state0.x + 0.5);
    let valid_segments = min(u32(particle.state0.y + 0.5), HISTORY_LEN - 1u);
    let particle_state = particle.state0.z;
    let live_weight = clamp(particle.state2.x, 0.0, 1.0);

    if (segment_id >= valid_segments || live_weight <= 0.0) {
        out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        out.head_mix = 0.0;
        out.alpha = 0.0;
        return out;
    }

    let newer_idx = ring_index(head, segment_id);
    let older_idx = ring_index(head, segment_id + 1u);

    let older = particle.history[older_idx];
    let newer = particle.history[newer_idx];

    var older_left = older.left.xyz;
    var older_right = older.right.xyz;
    var newer_left = newer.left.xyz;
    var newer_right = newer.right.xyz;

    if (style.dying_shrink_enabled > 0.5 && particle_state >= 0.5) {
        let width_scale = mix(style.dying_min_scale, 1.0, live_weight);
        let older_center = 0.5 * (older_left + older_right);
        let newer_center = 0.5 * (newer_left + newer_right);

        older_left = mix(older_center, older_left, width_scale);
        older_right = mix(older_center, older_right, width_scale);
        newer_left = mix(newer_center, newer_left, width_scale);
        newer_right = mix(newer_center, newer_right, width_scale);
    }

    let edge_start = select(older_left, older_right, in.local_uv.x > 0.5);
    let edge_end = select(newer_left, newer_right, in.local_uv.x > 0.5);
    let world_pos = mix(edge_start, edge_end, in.local_uv.y);

    let denom = max(f32(HISTORY_LEN - 2u), 1.0);
    let segment_t = clamp(f32(segment_id) / denom, 0.0, 1.0);
    let segment_falloff = pow(max(1.0 - segment_t, 0.0), max(style.alpha_falloff, 0.01));

    out.pos = camera.view_proj * vec4<f32>(world_pos, 1.0);
    out.head_mix = 1.0 - segment_t;
    out.alpha = style.base_alpha * segment_falloff * live_weight;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.alpha <= 0.0) {
        discard;
    }

    let color = mix(style.tail_color.rgb, style.head_color.rgb, in.head_mix);
    let alpha = clamp(in.alpha, 0.0, 1.0);
    return vec4<f32>(color * alpha, alpha);
}