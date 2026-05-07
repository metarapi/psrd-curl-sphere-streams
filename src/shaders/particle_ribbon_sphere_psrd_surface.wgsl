struct CameraUniforms {
    view_proj: mat4x4<f32>,
    eye: vec4<f32>,
};

struct VertexInput {
    @location(0) pos: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) normal: vec3<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var value_tex: texture_cube<f32>;
@group(0) @binding(2) var value_sampler: sampler;

fn surface_gray(t: f32) -> f32 {
    let low = 0.0;
    let high = 1.0;
    return mix(low, high, smoothstep(0.0, 1.0, t));
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.pos = camera.view_proj * vec4<f32>(in.pos, 1.0);
    out.normal = normalize(in.pos);
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let n = normalize(in.normal);
    let field_sample = textureSampleLevel(value_tex, value_sampler, n, 0.0);

    let noise_value = clamp(field_sample.x * 0.5 + 0.5, 0.0, 1.0);
    let flow_strength = clamp(field_sample.y, 0.0, 1.0);

    let light_dir = normalize(vec3<f32>(0.35, 0.86, 0.27));
    let ndotl = max(dot(n, light_dir), 0.0);
    let fresnel = pow(1.0 - max(dot(n, normalize(camera.eye.xyz)), 0.0), 2.0);

    let gray = surface_gray(noise_value);
    // var color = vec3<f32>(gray, gray, gray) * (0.42 + 0.58 * ndotl);
    // color = color + vec3<f32>(flow_strength * 0.08 + fresnel * 0.04);
    
    // Dark navy blue to a slightly lighter steel blue
    let dark_blue  = vec3<f32>(0.02, 0.05, 0.18);
    let light_blue = vec3<f32>(0.18, 0.32, 0.58);
    var color = mix(dark_blue, light_blue, gray) * (0.42 + 0.58 * ndotl);

    // Flow highlight stays blueish, fresnel adds a subtle cool rim
    color = color + vec3<f32>(0.0, flow_strength * 0.04, flow_strength * 0.08)
                  + vec3<f32>(0.02, 0.04, fresnel * 0.10);

    return vec4<f32>(min(color, vec3<f32>(1.0)), 1.0);
}