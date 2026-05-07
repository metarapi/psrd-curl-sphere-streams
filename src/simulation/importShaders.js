const SHADER_FILES = {
    advect: 'particle_ribbon_sphere_psrd_advect',
    debug: 'particle_ribbon_sphere_psrd_debug',
    field: 'particle_ribbon_sphere_psrd_field',
    surface: 'particle_ribbon_sphere_psrd_surface',
    render: 'particle_ribbon_sphere_psrd_render',
};

const HISTORY_TOKEN_SHADERS = new Set(['advect', 'debug', 'render']);

function getShaderUrl(shaderFileName) {
    return new URL(`../shaders/${shaderFileName}.wgsl`, import.meta.url).href;
}

export async function getShaders(historyLen) {
    const shaders = {};
    const entries = Object.entries(SHADER_FILES);

    await Promise.all(
        entries.map(async ([name, shaderFileName]) => {
            const response = await fetch(getShaderUrl(shaderFileName));
            if (!response.ok) {
                throw new Error(`Failed to load shader ${shaderFileName}: ${response.status}`);
            }

            const source = await response.text();
            shaders[name] = HISTORY_TOKEN_SHADERS.has(name)
                ? source.replaceAll('__HISTORY_LEN__', String(historyLen))
                : source;
        }),
    );

    return shaders;
}