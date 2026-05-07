import { buildCubeSphere } from './geometry.js';
import {
	CAMERA_UNIFORM_SIZE,
	DEBUG_STYLE_SIZE,
	FIELD_UNIFORM_SIZE,
	HISTORY_LEN,
	META0_OFFSET,
	META1_OFFSET,
	META2_OFFSET,
	PARTICLE_FLOATS,
	PARTICLE_STATE_ALIVE,
	PARTICLE_STRIDE,
	RIBBON_STYLE_SIZE,
	SAMPLE_FLOATS,
	SIM_UNIFORM_SIZE,
} from './constants.js';
import {
	cross3,
	mat4RowMajorToColumnMajor,
	multiplyMat4RowMajor,
	normalize3,
	perspectiveRowMajor,
	scale3,
} from './math.js';

export function createUniformBuffers(device) {
	return {
		fieldUniform: device.createBuffer({
			size: FIELD_UNIFORM_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),
		simUniform: device.createBuffer({
			size: SIM_UNIFORM_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),
		cameraUniform: device.createBuffer({
			size: CAMERA_UNIFORM_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),
		ribbonStyleUniform: device.createBuffer({
			size: RIBBON_STYLE_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),
		debugStyleUniform: device.createBuffer({
			size: DEBUG_STYLE_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		}),
	};
}

export function createRibbonGeometryBuffers(device) {
	const ribbonVertices = new Float32Array([
		0.0, 0.0,
		1.0, 0.0,
		1.0, 1.0,
		0.0, 1.0,
	]);
	const ribbonIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	return {
		ribbonVertexBuffer: device.createBuffer({
			size: ribbonVertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		}),
		ribbonIndexBuffer: device.createBuffer({
			size: ribbonIndices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		}),
		ribbonIndexCount: ribbonIndices.length,
	};
}

export function uploadRibbonGeometry(buffers) {
	const vertices = new Float32Array([
		0.0, 0.0,
		1.0, 0.0,
		1.0, 1.0,
		0.0, 1.0,
	]);
	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	new Float32Array(buffers.ribbonVertexBuffer.getMappedRange()).set(vertices);
	buffers.ribbonVertexBuffer.unmap();

	new Uint16Array(buffers.ribbonIndexBuffer.getMappedRange()).set(indices);
	buffers.ribbonIndexBuffer.unmap();
}

export function createSurfaceGeometryBuffers(device, subdiv, surfaceRadius) {
	const surfaceMesh = buildCubeSphere(subdiv);
	const scaledPositions = new Float32Array(surfaceMesh.positions.length);

	for (let i = 0; i < surfaceMesh.positions.length; i += 1) {
		scaledPositions[i] = surfaceMesh.positions[i] * surfaceRadius;
	}

	const surfaceVertexBuffer = device.createBuffer({
		size: scaledPositions.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	});
	new Float32Array(surfaceVertexBuffer.getMappedRange()).set(scaledPositions);
	surfaceVertexBuffer.unmap();

	const surfaceIndexBuffer = device.createBuffer({
		size: surfaceMesh.indices.byteLength,
		usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	});
	new Uint32Array(surfaceIndexBuffer.getMappedRange()).set(surfaceMesh.indices);
	surfaceIndexBuffer.unmap();

	return {
		surfaceVertexBuffer,
		surfaceIndexBuffer,
		surfaceIndexCount: surfaceMesh.indices.length,
	};
}

export function createParticleStorageBuffer(device, particleCount) {
	const particleBufferSize = particleCount * PARTICLE_STRIDE;
	const particleBuffer = device.createBuffer({
		size: particleBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});

	return {
		particleBuffer,
		particleBufferSize,
	};
}

export function computeSegmentInstanceCount(particleCount) {
	return particleCount * (HISTORY_LEN - 1);
}

export function lifetimeRange(state) {
	const minLifetime = Math.max(0.05, Number(state.lifetimeMin));
	const maxLifetime = Math.max(0.05, Number(state.lifetimeMax));
	return [Math.min(minLifetime, maxLifetime), Math.max(minLifetime, maxLifetime)];
}

function randomDirection() {
	const u = Math.random();
	const v = Math.random();
	const z = 1.0 - 2.0 * u;
	const a = Math.PI * 2.0 * v;
	const r = Math.sqrt(Math.max(0.0, 1.0 - z * z));
	return [r * Math.cos(a), r * Math.sin(a), z];
}

function buildInitialRibbonEdges(center, width, radius) {
	const normal = normalize3(center, [0.0, 0.0, 1.0]);

	const upAxis = [0.0, 1.0, 0.0];
	const altAxis = [1.0, 0.0, 0.0];

	let tangent = cross3(upAxis, normal);
	if ((tangent[0] * tangent[0] + tangent[1] * tangent[1] + tangent[2] * tangent[2]) < 1e-12) {
		tangent = cross3(altAxis, normal);
	}
	tangent = normalize3(tangent, [1.0, 0.0, 0.0]);

	let side = cross3(normal, tangent);
	side = normalize3(side, [0.0, 1.0, 0.0]);

	const left = normalize3([
		center[0] - width * side[0],
		center[1] - width * side[1],
		center[2] - width * side[2],
	], normal);

	const right = normalize3([
		center[0] + width * side[0],
		center[1] + width * side[1],
		center[2] + width * side[2],
	], normal);

	return {
		left: scale3(left, radius),
		right: scale3(right, radius),
	};
}

export function resetParticles({
	device,
	particleBuffer,
	particleCount,
	state,
	sphereRadius,
}) {
	const randomOffset = Math.floor(Math.random() * 0x100000000) >>> 0;
	const particles = new Float32Array(particleCount * PARTICLE_FLOATS);

	const [minLifetime, maxLifetime] = lifetimeRange(state);
	const ribbonWidth = Number(state.ribbonWidth);
	const decayTime = Number(state.decayTime);

	// Each particle stores a full ring-buffer history plus 3 vec4 metadata slots.
	for (let particleId = 0; particleId < particleCount; particleId += 1) {
		const center = scale3(randomDirection(), sphereRadius);
		const edges = buildInitialRibbonEdges(center, ribbonWidth, sphereRadius);
		const lifetime = minLifetime + Math.random() * (maxLifetime - minLifetime);

		const particleBase = particleId * PARTICLE_FLOATS;

		for (let sampleIdx = 0; sampleIdx < HISTORY_LEN; sampleIdx += 1) {
			const sampleBase = particleBase + sampleIdx * SAMPLE_FLOATS;

			particles[sampleBase + 0] = edges.left[0];
			particles[sampleBase + 1] = edges.left[1];
			particles[sampleBase + 2] = edges.left[2];

			particles[sampleBase + 4] = edges.right[0];
			particles[sampleBase + 5] = edges.right[1];
			particles[sampleBase + 6] = edges.right[2];
		}

		const meta0 = particleBase + META0_OFFSET;
		particles[meta0 + 0] = 0.0;
		particles[meta0 + 1] = 0.0;
		particles[meta0 + 2] = PARTICLE_STATE_ALIVE;
		particles[meta0 + 3] = 0.0;

		const meta1 = particleBase + META1_OFFSET;
		particles[meta1 + 0] = 0.0;
		particles[meta1 + 1] = lifetime;
		particles[meta1 + 2] = 0.0;
		particles[meta1 + 3] = decayTime;

		const meta2 = particleBase + META2_OFFSET;
		particles[meta2 + 0] = 1.0;
		particles[meta2 + 1] = ribbonWidth;
		particles[meta2 + 2] = 0.0;
		particles[meta2 + 3] = 0.0;
	}

	device.queue.writeBuffer(particleBuffer, 0, particles);
	return randomOffset;
}

export function writeFieldUniforms({ device, fieldUniform, fieldSize, state }) {
	// Mixed uint+float uniforms are easiest to write with a DataView.
	const payload = new ArrayBuffer(FIELD_UNIFORM_SIZE);
	const view = new DataView(payload);

	view.setUint32(0, fieldSize, true);
	view.setUint32(4, 0, true);
	view.setUint32(8, 0, true);
	view.setUint32(12, 0, true);

	view.setFloat32(16, Number(state.noiseFrequency), true);
	view.setFloat32(20, Number(state.noiseAlpha), true);
	view.setFloat32(24, Number(state.fieldStrength), true);
	view.setFloat32(28, 0.0, true);

	device.queue.writeBuffer(fieldUniform, 0, payload);
}

export function writeSimUniforms({
	device,
	simUniform,
	state,
	particleCount,
	historyLen,
	frameIdx,
	randomOffset,
	dt,
	sphereRadius,
}) {
	const [minLifetime, maxLifetime] = lifetimeRange(state);

	const payload = new ArrayBuffer(SIM_UNIFORM_SIZE);
	const view = new DataView(payload);

	view.setUint32(0, particleCount >>> 0, true);
	view.setUint32(4, historyLen >>> 0, true);
	view.setUint32(8, frameIdx >>> 0, true);
	view.setUint32(12, randomOffset >>> 0, true);

	view.setFloat32(16, dt, true);
	view.setFloat32(20, Number(state.speedFactor), true);
	view.setFloat32(24, Number(state.ribbonWidth), true);
	view.setFloat32(28, minLifetime, true);
	view.setFloat32(32, maxLifetime, true);
	view.setFloat32(36, Number(state.decayTime), true);
	view.setFloat32(40, sphereRadius, true);
	view.setFloat32(44, Number(state.decayExponent), true);

	device.queue.writeBuffer(simUniform, 0, payload);
}

export function writeCameraUniforms({
	device,
	cameraUniform,
	camera,
	width,
	height,
}) {
	const aspect = width / Math.max(height, 1);
	const proj = perspectiveRowMajor((55.0 * Math.PI) / 180.0, aspect, 0.05, 100.0);
	const view = camera.viewMatrix();
	const viewProj = multiplyMat4RowMajor(proj, view);
	const viewProjColumnMajor = mat4RowMajorToColumnMajor(viewProj);
	const eye = camera.eye();

	const payload = new Float32Array(20);
	payload.set(viewProjColumnMajor, 0);
	payload[16] = eye[0];
	payload[17] = eye[1];
	payload[18] = eye[2];
	payload[19] = 1.0;

	device.queue.writeBuffer(cameraUniform, 0, payload);
}

export function writeRibbonStyleUniforms({ device, ribbonStyleUniform, state }) {
	const headColor = [0.6, 1.0, 0.95, 1.0];
	const tailColor = [0.2, 0.6, 0.9, 0.0];

	const payload = new Float32Array(12);
	payload[0] = Number(state.alphaFalloff);
	payload[1] = 1.0;
	payload[2] = state.shrinkWidthDying ? 1.0 : 0.0;
	payload[3] = 0.12;

	payload[4] = headColor[0];
	payload[5] = headColor[1];
	payload[6] = headColor[2];
	payload[7] = headColor[3];

	payload[8] = tailColor[0];
	payload[9] = tailColor[1];
	payload[10] = tailColor[2];
	payload[11] = tailColor[3];

	device.queue.writeBuffer(ribbonStyleUniform, 0, payload);
}

export function writeDebugStyleUniforms({ device, debugStyleUniform }) {
	const payload = new Float32Array(8);
	payload[0] = 0.014;
	payload[1] = 0.85;
	payload[4] = 0.95;
	payload[5] = 0.95;
	payload[6] = 1.0;
	payload[7] = 1.0;
	device.queue.writeBuffer(debugStyleUniform, 0, payload);
}
