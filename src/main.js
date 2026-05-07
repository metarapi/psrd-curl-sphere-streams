import 'flyonui/flyonui'
import Alpine from 'alpinejs'
import '@fontsource/ibm-plex-mono';
import { ParticleRibbonSphereApp } from './simulation/app.js';

window.Alpine = Alpine;
Alpine.start();

async function bootstrapApp() {
	const canvas = document.getElementById('webgpu-canvas');
	const uiState = window.__simState ?? document.body?._x_dataStack?.[0];

	if (!canvas || !uiState) {
		console.error('Could not locate simulation canvas or Alpine state root.');
		return;
	}

	const app = new ParticleRibbonSphereApp({ canvas, uiState });
	window.__particleRibbonApp = app;

	try {
		await app.init();
	} catch (error) {
		console.error('Failed to initialize simulation:', error);
	}
}

queueMicrotask(() => {
	bootstrapApp();
});