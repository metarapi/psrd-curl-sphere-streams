struct SimParams {
    particle_count: u32,
    history_len: u32,
    frame_idx: u32,
    random_offset: u32,
    delta_time: f32,
    speed_factor: f32,
    ribbon_width: f32,
    lifetime_min_seconds: f32,
    lifetime_max_seconds: f32,
    decay_time: f32,
    sphere_radius: f32,
    decay_exponent: f32,
};

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

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var field_tex: texture_cube<f32>;
@group(0) @binding(2) var field_sampler: sampler;
@group(0) @binding(3) var<uniform> params: SimParams;

const HISTORY_LEN: u32 = __HISTORY_LEN__u;
const TAU: f32 = 6.28318530718;
const PARTICLE_STATE_ALIVE: f32 = 0.0;
const PARTICLE_STATE_DYING: f32 = 1.0;

fn pcg2d(p: vec2<u32>) -> vec2<u32> {
    var v = p * 1664525u + 1013904223u;
    v.x = v.x + v.y * 1664525u;
    v.y = v.y + v.x * 1664525u;
    v = v ^ (v >> vec2<u32>(16u, 16u));
    v.x = v.x + v.y * 1664525u;
    v.y = v.y + v.x * 1664525u;
    v = v ^ (v >> vec2<u32>(16u, 16u));
    return v;
}

fn hash_to_float(hash: u32) -> f32 {
    return f32(hash) / 4294967296.0;
}

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

fn sample_center(sample: EdgeSample) -> vec3<f32> {
    let center = 0.5 * (sample.left.xyz + sample.right.xyz);
    return safe_normalize(center, vec3<f32>(0.0, 0.0, 1.0)) * params.sphere_radius;
}

fn sample_velocity(position: vec3<f32>) -> vec3<f32> {
    let direction = safe_normalize(position, vec3<f32>(0.0, 0.0, 1.0));
    let sampled = textureSampleLevel(field_tex, field_sampler, direction, 0.0).xyz;
    let tangent = project_to_tangent(sampled, direction);
    let tangent_len = length(tangent);
    if (tangent_len < 1e-6) {
        return orthogonal_tangent(direction) * 1e-4;
    }
    return tangent;
}

fn tangent_from_velocity(normal: vec3<f32>, velocity: vec3<f32>) -> vec3<f32> {
    let tangent = project_to_tangent(velocity, normal);
    let tangent_len = length(tangent);
    if (tangent_len < 1e-6) {
        return orthogonal_tangent(normal);
    }
    return tangent / tangent_len;
}

fn side_from_tangent(normal: vec3<f32>, tangent: vec3<f32>) -> vec3<f32> {
    let raw_side = cross(normal, tangent);
    let side_len = length(raw_side);
    if (side_len < 1e-6) {
        return orthogonal_tangent(normal);
    }
    return raw_side / side_len;
}

fn make_history_sample(center: vec3<f32>, velocity: vec3<f32>, half_width: f32) -> EdgeSample {
    let normal = safe_normalize(center, vec3<f32>(0.0, 0.0, 1.0));
    let tangent = tangent_from_velocity(normal, velocity);
    let side = side_from_tangent(normal, tangent);

    let left = safe_normalize(center - half_width * side, normal) * params.sphere_radius;
    let right = safe_normalize(center + half_width * side, normal) * params.sphere_radius;

    return EdgeSample(
        vec4<f32>(left, 0.0),
        vec4<f32>(right, 0.0),
    );
}

fn compute_live_weight(decay_age: f32, decay_time: f32) -> f32 {
    let safe_decay = max(decay_time, 1e-4);
    let t = clamp(decay_age / safe_decay, 0.0, 1.0);
    return pow(max(1.0 - t, 0.0), max(params.decay_exponent, 0.01));
}

fn sample_lifetime(particle_id: u32, cycle: u32) -> f32 {
    let min_lifetime = max(min(params.lifetime_min_seconds, params.lifetime_max_seconds), 0.05);
    let max_lifetime = max(max(params.lifetime_min_seconds, params.lifetime_max_seconds), min_lifetime);
    let seed = pcg2d(
        vec2<u32>(
            particle_id ^ params.random_offset ^ 0xA511E9B3u,
            cycle * 277803737u + params.frame_idx * 747796405u + 2891336453u,
        )
    );
    return mix(min_lifetime, max_lifetime, hash_to_float(seed.x));
}

fn respawn_center(particle_id: u32, cycle: u32) -> vec3<f32> {
    let seed = pcg2d(
        vec2<u32>(
            particle_id ^ params.random_offset ^ 0x9E3779B9u,
            cycle * 747796405u + params.frame_idx * 2891336453u + 1013904223u,
        )
    );
    let u = hash_to_float(seed.x);
    let v = hash_to_float(seed.y);
    let z = 1.0 - 2.0 * u;
    let a = TAU * v;
    let r = sqrt(max(0.0, 1.0 - z * z));
    return vec3<f32>(r * cos(a), r * sin(a), z) * params.sphere_radius;
}

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let particle_id = global_id.x;
    if (particle_id >= params.particle_count) {
        return;
    }

    if (params.delta_time <= 0.0) {
        return;
    }

    var particle = particles[particle_id];

    let head = u32(particle.state0.x + 0.5);
    let history_steps = u32(particle.state0.y + 0.5);
    let particle_state = particle.state0.z;
    let cycle = u32(particle.state0.w + 0.5);

    let age = particle.state1.x;
    let lifetime = max(particle.state1.y, 0.05);
    let decay_age = particle.state1.z;
    let decay_time = max(particle.state1.w, 0.05);

    let life_half_width = max(particle.state2.y, 1e-5);
    let cached_speed = particle.state2.z;

    let current_sample = particle.history[head];
    let current_center = sample_center(current_sample);

    if (particle_state >= 0.5) {
        let next_decay_age = decay_age + params.delta_time;
        let next_live_weight = compute_live_weight(next_decay_age, decay_time);

        if (next_decay_age >= decay_time || next_live_weight <= 0.0) {
            let next_cycle = cycle + 1u;
            let respawned_center = respawn_center(particle_id, next_cycle);
            let respawned_velocity = sample_velocity(respawned_center) * params.speed_factor;
            let respawned_sample = make_history_sample(respawned_center, respawned_velocity, params.ribbon_width);
            let respawned_lifetime = sample_lifetime(particle_id, next_cycle);

            for (var slot: u32 = 0u; slot < HISTORY_LEN; slot = slot + 1u) {
                particle.history[slot] = respawned_sample;
            }

            particle.state0 = vec4<f32>(0.0, 0.0, PARTICLE_STATE_ALIVE, f32(next_cycle));
            particle.state1 = vec4<f32>(0.0, respawned_lifetime, 0.0, max(params.decay_time, 0.05));
            particle.state2 = vec4<f32>(1.0, params.ribbon_width, length(respawned_velocity), 0.0);
            particles[particle_id] = particle;
            return;
        }

        particle.state0 = vec4<f32>(f32(head), f32(history_steps), PARTICLE_STATE_DYING, f32(cycle));
        particle.state1 = vec4<f32>(age, lifetime, next_decay_age, decay_time);
        particle.state2 = vec4<f32>(next_live_weight, life_half_width, cached_speed, 0.0);
        particles[particle_id] = particle;
        return;
    }

    let current_dir = safe_normalize(current_center, vec3<f32>(0.0, 0.0, 1.0));
    let current_velocity = sample_velocity(current_center) * params.speed_factor;
    let proposed_dir = current_dir + current_velocity * (params.delta_time / max(params.sphere_radius, 1e-4));
    let next_dir = safe_normalize(proposed_dir, current_dir);
    let next_center = next_dir * params.sphere_radius;
    let next_velocity = sample_velocity(next_center) * params.speed_factor;

    let new_head = (head + 1u) % HISTORY_LEN;
    particle.history[new_head] = make_history_sample(next_center, next_velocity, params.ribbon_width);

    let next_age = age + params.delta_time;
    var next_state = PARTICLE_STATE_ALIVE;
    if (next_age >= lifetime) {
        next_state = PARTICLE_STATE_DYING;
    }

    particle.state0 = vec4<f32>(
        f32(new_head),
        f32(min(history_steps + 1u, HISTORY_LEN - 1u)),
        next_state,
        f32(cycle),
    );
    particle.state1 = vec4<f32>(
        next_age,
        lifetime,
        0.0,
        max(params.decay_time, 0.05),
    );
    particle.state2 = vec4<f32>(1.0, params.ribbon_width, length(next_velocity), 0.0);
    particles[particle_id] = particle;
}