// Uniform block sizes match WGSL struct alignment and are written as packed bytes.
export const FIELD_UNIFORM_SIZE = 32;
export const SIM_UNIFORM_SIZE = 48;
export const CAMERA_UNIFORM_SIZE = 80;
export const RIBBON_STYLE_SIZE = 48;
export const DEBUG_STYLE_SIZE = 32;

// History and metadata layout mirrors the WGSL Particle struct.
export const HISTORY_LEN = 16;
export const SAMPLE_FLOATS = 8;
export const META_FLOATS = 12;

export const PARTICLE_FLOATS = HISTORY_LEN * SAMPLE_FLOATS + META_FLOATS;
export const PARTICLE_STRIDE = PARTICLE_FLOATS * 4;

export const META0_OFFSET = HISTORY_LEN * SAMPLE_FLOATS;
export const META1_OFFSET = META0_OFFSET + 4;
export const META2_OFFSET = META1_OFFSET + 4;

export const FIELD_SIZE = 256;
export const SPHERE_SUBDIV = 32;
export const SPHERE_RADIUS = 1.0;
export const SURFACE_RADIUS = 0.975;

export const PARTICLE_STATE_ALIVE = 0.0;
export const PARTICLE_STATE_DYING = 1.0;

export const CLEAR_COLOR = [0.035, 0.045, 0.05, 1.0];
