// Builds all GPU pipelines and keeps blend-mode variants for ribbons.
export function createShaderModules(device, shaders) {
	return {
		fieldModule: device.createShaderModule({ code: shaders.field }),
		advectModule: device.createShaderModule({ code: shaders.advect }),
		renderModule: device.createShaderModule({ code: shaders.render }),
		surfaceModule: device.createShaderModule({ code: shaders.surface }),
		debugModule: device.createShaderModule({ code: shaders.debug }),
	};
}

function createRibbonPipeline({
	device,
	pipelineLayout,
	shaderModule,
	blendState,
	colorFormat,
	depthFormat,
}) {
	return device.createRenderPipeline({
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: 'vs_main',
			buffers: [
				{
					arrayStride: 8,
					stepMode: 'vertex',
					attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
				},
			],
		},
		primitive: {
			topology: 'triangle-list',
			frontFace: 'ccw',
		},
		depthStencil: {
			format: depthFormat,
			depthWriteEnabled: false,
			depthCompare: 'less',
		},
		fragment: {
			module: shaderModule,
			entryPoint: 'fs_main',
			targets: [{ format: colorFormat, blend: blendState }],
		},
	});
}

export function createSimulationPipelines({
	device,
	shaderModules,
	colorFormat,
	depthFormat,
}) {
	const fieldPipeline = device.createComputePipeline({
		layout: 'auto',
		compute: {
			module: shaderModules.fieldModule,
			entryPoint: 'main',
		},
	});

	const advectPipeline = device.createComputePipeline({
		layout: 'auto',
		compute: {
			module: shaderModules.advectModule,
			entryPoint: 'main',
		},
	});

	const ribbonBindGroupLayout = device.createBindGroupLayout({
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'read-only-storage' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'uniform' },
			},
			{
				binding: 2,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'uniform' },
			},
		],
	});

	const ribbonPipelineLayout = device.createPipelineLayout({
		bindGroupLayouts: [ribbonBindGroupLayout],
	});

	const alphaBlend = {
		color: {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
			operation: 'add',
		},
		alpha: {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
			operation: 'add',
		},
	};

	const additiveBlend = {
		color: {
			srcFactor: 'one',
			dstFactor: 'one',
			operation: 'add',
		},
		alpha: {
			srcFactor: 'one',
			dstFactor: 'one',
			operation: 'add',
		},
	};

	const ribbonPipelineAlpha = createRibbonPipeline({
		device,
		pipelineLayout: ribbonPipelineLayout,
		shaderModule: shaderModules.renderModule,
		blendState: alphaBlend,
		colorFormat,
		depthFormat,
	});

	const ribbonPipelineAdditive = createRibbonPipeline({
		device,
		pipelineLayout: ribbonPipelineLayout,
		shaderModule: shaderModules.renderModule,
		blendState: additiveBlend,
		colorFormat,
		depthFormat,
	});

	const surfacePipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: {
			module: shaderModules.surfaceModule,
			entryPoint: 'vs_main',
			buffers: [
				{
					arrayStride: 12,
					stepMode: 'vertex',
					attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
				},
			],
		},
		primitive: {
			topology: 'triangle-list',
			frontFace: 'ccw',
			cullMode: 'back',
		},
		depthStencil: {
			format: depthFormat,
			depthWriteEnabled: true,
			depthCompare: 'less',
		},
		fragment: {
			module: shaderModules.surfaceModule,
			entryPoint: 'fs_main',
			targets: [{ format: colorFormat }],
		},
	});

	const debugPipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: {
			module: shaderModules.debugModule,
			entryPoint: 'vs_main',
			buffers: [
				{
					arrayStride: 8,
					stepMode: 'vertex',
					attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
				},
			],
		},
		primitive: {
			topology: 'triangle-list',
			frontFace: 'ccw',
		},
		depthStencil: {
			format: depthFormat,
			depthWriteEnabled: false,
			depthCompare: 'less',
		},
		fragment: {
			module: shaderModules.debugModule,
			entryPoint: 'fs_main',
			targets: [{ format: colorFormat, blend: alphaBlend }],
		},
	});

	return {
		fieldPipeline,
		advectPipeline,
		ribbonBindGroupLayout,
		ribbonPipelineLayout,
		ribbonPipelineAlpha,
		ribbonPipelineAdditive,
		surfacePipeline,
		debugPipeline,
	};
}
