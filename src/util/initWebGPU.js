const WEBGPU_MODAL_ID = 'webgpu-error-modal';

function showWebGPUErrorModal() {
    const existing = document.getElementById(WEBGPU_MODAL_ID);
    if (existing) {
        existing.classList.remove('hidden');
        return;
    }

    const html = `
        <div id="${WEBGPU_MODAL_ID}" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div class="w-full max-w-lg rounded-xl border border-base-300 bg-base-100 p-6 shadow-2xl">
                <div class="mb-4 flex items-start justify-between gap-4">
                    <h3 class="text-xl font-semibold">WebGPU Is Not Available</h3>
                    <button class="btn btn-ghost btn-sm" data-close-webgpu-modal="true">Close</button>
                </div>
                <p class="mb-3 text-sm text-base-content/80">
                    This prototype needs WebGPU to run. Try an up-to-date Chromium browser and verify hardware acceleration is enabled.
                </p>
                <a
                    href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary"
                >
                    WebGPU browser support details
                </a>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const closeButton = document.querySelector('[data-close-webgpu-modal="true"]');
    closeButton?.addEventListener('click', () => {
        document.getElementById(WEBGPU_MODAL_ID)?.classList.add('hidden');
    });
}

export async function checkWebGPUSupport() {
    if (!navigator.gpu) {
        showWebGPUErrorModal();
        return false;
    }
    return true;
}

export async function initWebGPU() {
    const isSupported = await checkWebGPUSupport();
    if (!isSupported) {
        throw new Error('WebGPU not supported in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
    });

    if (!adapter) {
        throw new Error('No WebGPU adapter found.');
    }

    const device = await adapter.requestDevice();
    return device;
}