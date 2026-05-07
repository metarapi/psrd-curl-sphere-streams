import {
	CAMERA_UNIFORM_SIZE,
	DEBUG_STYLE_SIZE,
	FIELD_UNIFORM_SIZE,
	RIBBON_STYLE_SIZE,
	SIM_UNIFORM_SIZE,
} from './constants.js';

// Bind-group helpers keep resource wiring localized instead of mixing it into frame code.

export function createFieldBindGroup({
	device,
	fieldPipeline,
	fieldUniform,
	vectorFieldView,
	valueFieldView,
}) {
	const layout = fieldPipeline.getBindGroupLayout(0);
	return device.createBindGroup({
		layout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: fieldUniform,
					offset: 0,
					size: FIELD_UNIFORM_SIZE,
				},
			},
			{ binding: 1, resource: vectorFieldView },
			{ binding: 2, resource: valueFieldView },
		],
	});
}

export function createComputeBindGroup({
	device,
	advectPipeline,
	particleBuffer,
	particleBufferSize,
	vectorFieldCubeView,
	fieldSampler,
	simUniform,
}) {
	const layout = advectPipeline.getBindGroupLayout(0);
	return device.createBindGroup({
		layout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: particleBuffer,
					offset: 0,
					size: particleBufferSize,
				},
			},
			{ binding: 1, resource: vectorFieldCubeView },
			{ binding: 2, resource: fieldSampler },
			{
				binding: 3,
				resource: {
					buffer: simUniform,
					offset: 0,
					size: SIM_UNIFORM_SIZE,
				},
			},
		],
	});
}

export function createRibbonBindGroup({
	device,
	ribbonBindGroupLayout,
	particleBuffer,
	particleBufferSize,
	cameraUniform,
	ribbonStyleUniform,
}) {
	return device.createBindGroup({
		layout: ribbonBindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: particleBuffer,
					offset: 0,
					size: particleBufferSize,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: cameraUniform,
					offset: 0,
					size: CAMERA_UNIFORM_SIZE,
				},
			},
			{
				binding: 2,
				resource: {
					buffer: ribbonStyleUniform,
					offset: 0,
					size: RIBBON_STYLE_SIZE,
				},
			},
		],
	});
}

export function createSurfaceBindGroup({
	device,
	surfacePipeline,
	cameraUniform,
	valueFieldCubeView,
	fieldSampler,
}) {
	const layout = surfacePipeline.getBindGroupLayout(0);
	return device.createBindGroup({
		layout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: cameraUniform,
					offset: 0,
					size: CAMERA_UNIFORM_SIZE,
				},
			},
			{ binding: 1, resource: valueFieldCubeView },
			{ binding: 2, resource: fieldSampler },
		],
	});
}

export function createDebugBindGroup({
	device,
	debugPipeline,
	particleBuffer,
	particleBufferSize,
	cameraUniform,
	debugStyleUniform,
}) {
	const layout = debugPipeline.getBindGroupLayout(0);
	return device.createBindGroup({
		layout,
		entries: [
			{
				binding: 0,
				resource: {
					buffer: particleBuffer,
					offset: 0,
					size: particleBufferSize,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: cameraUniform,
					offset: 0,
					size: CAMERA_UNIFORM_SIZE,
				},
			},
			{
				binding: 2,
				resource: {
					buffer: debugStyleUniform,
					offset: 0,
					size: DEBUG_STYLE_SIZE,
				},
			},
		],
	});
}
