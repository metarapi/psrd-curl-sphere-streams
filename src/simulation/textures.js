export function createFieldTextures(device, fieldSize) {
	const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;

	const vectorFieldTexture = device.createTexture({
		dimension: '2d',
		size: [fieldSize, fieldSize, 6],
		sampleCount: 1,
		format: 'rgba16float',
		usage,
	});

	const valueFieldTexture = device.createTexture({
		dimension: '2d',
		size: [fieldSize, fieldSize, 6],
		sampleCount: 1,
		format: 'rgba16float',
		usage,
	});

	return {
		vectorFieldTexture,
		vectorFieldView: vectorFieldTexture.createView({
			dimension: '2d-array',
			baseArrayLayer: 0,
			arrayLayerCount: 6,
		}),
		vectorFieldCubeView: vectorFieldTexture.createView({ dimension: 'cube' }),
		valueFieldTexture,
		valueFieldView: valueFieldTexture.createView({
			dimension: '2d-array',
			baseArrayLayer: 0,
			arrayLayerCount: 6,
		}),
		valueFieldCubeView: valueFieldTexture.createView({ dimension: 'cube' }),
	};
}

export function createDepthTexture(device, width, height, depthFormat = 'depth24plus') {
	const depthTexture = device.createTexture({
		size: [Math.max(1, width), Math.max(1, height), 1],
		format: depthFormat,
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});

	return {
		depthTexture,
		depthView: depthTexture.createView(),
	};
}
