import { createComputeBindGroup, createDebugBindGroup, createFieldBindGroup, createRibbonBindGroup, createSurfaceBindGroup } from './bindGroup.js';
import {
  computeSegmentInstanceCount,
  createParticleStorageBuffer,
  createRibbonGeometryBuffers,
  createSurfaceGeometryBuffers,
  createUniformBuffers,
  resetParticles,
  uploadRibbonGeometry,
  writeCameraUniforms,
  writeDebugStyleUniforms,
  writeFieldUniforms,
  writeRibbonStyleUniforms,
  writeSimUniforms,
} from './buffers.js';
import {
  CLEAR_COLOR,
  FIELD_SIZE,
  HISTORY_LEN,
  SPHERE_RADIUS,
  SPHERE_SUBDIV,
  SURFACE_RADIUS,
} from './constants.js';
import { ArcRotateCamera, CanvasArcballController } from './camera.js';
import { getShaders } from './importShaders.js';
import { clamp } from './math.js';
import { createSimulationPipelines, createShaderModules } from './pipelines.js';
import { createDepthTexture, createFieldTextures } from './textures.js';
import { initWebGPU } from '../util/initWebGPU.js';

// Orchestrates the same update flow as the Python app: field bake -> advect -> surface draw -> ribbon draw.
export class ParticleRibbonSphereApp {
  constructor({ canvas, uiState }) {
    this.canvas = canvas;
    this.uiState = uiState;

    this.device = null;
    this.context = null;
    this.colorFormat = null;

    this.depthFormat = 'depth24plus';
    this.depthTexture = null;
    this.depthView = null;
    this.depthWidth = 0;
    this.depthHeight = 0;

    this.fieldSize = FIELD_SIZE;
    this.historyLen = HISTORY_LEN;
    this.sphereRadius = SPHERE_RADIUS;
    this.surfaceRadius = SURFACE_RADIUS;

    this.frameIdx = 0;
    this.simTime = 0;
    this.randomOffset = 0;
    this.lastFrameTimeSeconds = 0;

    this.particleCount = Math.max(1000, Math.floor(Number(this.uiState.particleCount) || 80000));
    this.segmentInstanceCount = computeSegmentInstanceCount(this.particleCount);
    this.isPlaying = Boolean(this.uiState.isPlaying);

    this.camera = new ArcRotateCamera({
      alpha: 0.8,
      beta: 1.1,
      radius: 3.8,
      target: [0.0, 0.0, 0.0],
      minRadius: 1.4,
      maxRadius: 14.0,
    });
    this.controller = new CanvasArcballController(this.camera, this.canvas);

    this.onRestart = this.onRestart.bind(this);
    this.renderLoop = this.renderLoop.bind(this);
  }

  async init() {
    this.device = await initWebGPU();
    this.context = this.canvas.getContext('webgpu');
    this.colorFormat = navigator.gpu.getPreferredCanvasFormat();
    this.configureContext();

    const shaderSources = await getShaders(this.historyLen);
    const shaderModules = createShaderModules(this.device, shaderSources);
    this.pipelines = createSimulationPipelines({
      device: this.device,
      shaderModules,
      colorFormat: this.colorFormat,
      depthFormat: this.depthFormat,
    });

    this.textures = createFieldTextures(this.device, this.fieldSize);
    this.fieldSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });

    this.uniforms = createUniformBuffers(this.device);

    this.ribbonGeometry = createRibbonGeometryBuffers(this.device);
    uploadRibbonGeometry(this.ribbonGeometry);

    this.surfaceGeometry = createSurfaceGeometryBuffers(
      this.device,
      SPHERE_SUBDIV,
      this.surfaceRadius,
    );

    this.fieldBindGroup = createFieldBindGroup({
      device: this.device,
      fieldPipeline: this.pipelines.fieldPipeline,
      fieldUniform: this.uniforms.fieldUniform,
      vectorFieldView: this.textures.vectorFieldView,
      valueFieldView: this.textures.valueFieldView,
    });

    this.surfaceBindGroup = createSurfaceBindGroup({
      device: this.device,
      surfacePipeline: this.pipelines.surfacePipeline,
      cameraUniform: this.uniforms.cameraUniform,
      valueFieldCubeView: this.textures.valueFieldCubeView,
      fieldSampler: this.fieldSampler,
    });

    this.rebuildParticleResources(this.particleCount);
    writeDebugStyleUniforms({
      device: this.device,
      debugStyleUniform: this.uniforms.debugStyleUniform,
    });

    this.resizeTargetsIfNeeded();

    window.addEventListener('restart-sim', this.onRestart);
    this.device.lost.then((info) => {
      console.error('WebGPU device lost:', info.message);
    });

    this.lastFrameTimeSeconds = performance.now() * 0.001;
    requestAnimationFrame(this.renderLoop);
  }

  configureContext() {
    this.context.configure({
      device: this.device,
      format: this.colorFormat,
      alphaMode: 'premultiplied',
    });
  }

  rebuildParticleResources(newCount) {
    this.particleCount = newCount;
    this.segmentInstanceCount = computeSegmentInstanceCount(this.particleCount);

    if (this.particleBuffer) {
      this.particleBuffer.destroy();
    }

    const storage = createParticleStorageBuffer(this.device, this.particleCount);
    this.particleBuffer = storage.particleBuffer;
    this.particleBufferSize = storage.particleBufferSize;

    this.computeBindGroup = createComputeBindGroup({
      device: this.device,
      advectPipeline: this.pipelines.advectPipeline,
      particleBuffer: this.particleBuffer,
      particleBufferSize: this.particleBufferSize,
      vectorFieldCubeView: this.textures.vectorFieldCubeView,
      fieldSampler: this.fieldSampler,
      simUniform: this.uniforms.simUniform,
    });

    this.ribbonBindGroup = createRibbonBindGroup({
      device: this.device,
      ribbonBindGroupLayout: this.pipelines.ribbonBindGroupLayout,
      particleBuffer: this.particleBuffer,
      particleBufferSize: this.particleBufferSize,
      cameraUniform: this.uniforms.cameraUniform,
      ribbonStyleUniform: this.uniforms.ribbonStyleUniform,
    });

    this.debugBindGroup = createDebugBindGroup({
      device: this.device,
      debugPipeline: this.pipelines.debugPipeline,
      particleBuffer: this.particleBuffer,
      particleBufferSize: this.particleBufferSize,
      cameraUniform: this.uniforms.cameraUniform,
      debugStyleUniform: this.uniforms.debugStyleUniform,
    });

    this.randomOffset = resetParticles({
      device: this.device,
      particleBuffer: this.particleBuffer,
      particleCount: this.particleCount,
      state: this.uiState,
      sphereRadius: this.sphereRadius,
    });
  }

  resizeTargetsIfNeeded() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (!this.depthTexture || this.depthWidth !== width || this.depthHeight !== height) {
      if (this.depthTexture) {
        this.depthTexture.destroy();
      }
      const depth = createDepthTexture(this.device, width, height, this.depthFormat);
      this.depthTexture = depth.depthTexture;
      this.depthView = depth.depthView;
      this.depthWidth = width;
      this.depthHeight = height;
    }

    return { width, height };
  }

  onRestart() {
    this.uiState.isPlaying = true;
    this.isPlaying = true;
    this.simTime = 0.0;
    this.frameIdx = 0;
    this.lastFrameTimeSeconds = performance.now() * 0.001;

    this.randomOffset = resetParticles({
      device: this.device,
      particleBuffer: this.particleBuffer,
      particleCount: this.particleCount,
      state: this.uiState,
      sphereRadius: this.sphereRadius,
    });
  }

  syncUiState() {
    const nextPlaying = Boolean(this.uiState.isPlaying);
    if (nextPlaying && !this.isPlaying) {
      this.lastFrameTimeSeconds = performance.now() * 0.001;
    }
    this.isPlaying = nextPlaying;

    const nextParticleCount = clamp(
      Math.floor(Number(this.uiState.particleCount) || 80000),
      1000,
      160000,
    );

    if (nextParticleCount !== this.particleCount) {
      this.uiState.particleCount = nextParticleCount;
      this.rebuildParticleResources(nextParticleCount);
    }
  }

  renderLoop(nowMs) {
    if (!this.device) {
      return;
    }

    this.syncUiState();
    this.camera.step();

    const { width, height } = this.resizeTargetsIfNeeded();

    const nowSeconds = nowMs * 0.001;
    const dt = Math.max(0.0, Math.min(nowSeconds - this.lastFrameTimeSeconds, 0.05));
    this.lastFrameTimeSeconds = nowSeconds;

    let simDt = 0.0;
    if (this.isPlaying) {
      simDt = dt;
      this.simTime += dt;
      this.frameIdx = (this.frameIdx + 1) >>> 0;
    }

    writeFieldUniforms({
      device: this.device,
      fieldUniform: this.uniforms.fieldUniform,
      fieldSize: this.fieldSize,
      state: this.uiState,
    });

    writeSimUniforms({
      device: this.device,
      simUniform: this.uniforms.simUniform,
      state: this.uiState,
      particleCount: this.particleCount,
      historyLen: this.historyLen,
      frameIdx: this.frameIdx,
      randomOffset: this.randomOffset,
      dt: simDt,
      sphereRadius: this.sphereRadius,
    });

    writeCameraUniforms({
      device: this.device,
      cameraUniform: this.uniforms.cameraUniform,
      camera: this.camera,
      width,
      height,
    });

    writeRibbonStyleUniforms({
      device: this.device,
      ribbonStyleUniform: this.uniforms.ribbonStyleUniform,
      state: this.uiState,
    });

    const encoder = this.device.createCommandEncoder();

    // First compute pass bakes/update the field texture from current field controls.
    const fieldPass = encoder.beginComputePass();
    fieldPass.setPipeline(this.pipelines.fieldPipeline);
    fieldPass.setBindGroup(0, this.fieldBindGroup);
    fieldPass.dispatchWorkgroups(
      Math.ceil(this.fieldSize / 8),
      Math.ceil(this.fieldSize / 8),
      6,
    );
    fieldPass.end();

    if (this.isPlaying) {
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(this.pipelines.advectPipeline);
      computePass.setBindGroup(0, this.computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(this.particleCount / 256), 1, 1);
      computePass.end();
    }

    let currentView;
    try {
      currentView = this.context.getCurrentTexture().createView();
    } catch {
      this.configureContext();
      requestAnimationFrame(this.renderLoop);
      return;
    }

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentView,
          clearValue: CLEAR_COLOR,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipelines.surfacePipeline);
    renderPass.setBindGroup(0, this.surfaceBindGroup);
    renderPass.setVertexBuffer(0, this.surfaceGeometry.surfaceVertexBuffer);
    renderPass.setIndexBuffer(this.surfaceGeometry.surfaceIndexBuffer, 'uint32');
    renderPass.drawIndexed(this.surfaceGeometry.surfaceIndexCount, 1, 0, 0, 0);

    const blendMode = this.uiState.blendMode === 'additive' ? 'additive' : 'alpha';
    renderPass.setPipeline(
      blendMode === 'additive'
        ? this.pipelines.ribbonPipelineAdditive
        : this.pipelines.ribbonPipelineAlpha,
    );
    renderPass.setBindGroup(0, this.ribbonBindGroup);
    renderPass.setVertexBuffer(0, this.ribbonGeometry.ribbonVertexBuffer);
    renderPass.setIndexBuffer(this.ribbonGeometry.ribbonIndexBuffer, 'uint16');
    renderPass.drawIndexed(this.ribbonGeometry.ribbonIndexCount, this.segmentInstanceCount, 0, 0, 0);

    if (this.uiState.showDebugCenters) {
      renderPass.setPipeline(this.pipelines.debugPipeline);
      renderPass.setBindGroup(0, this.debugBindGroup);
      renderPass.setVertexBuffer(0, this.ribbonGeometry.ribbonVertexBuffer);
      renderPass.setIndexBuffer(this.ribbonGeometry.ribbonIndexBuffer, 'uint16');
      renderPass.drawIndexed(this.ribbonGeometry.ribbonIndexCount, this.particleCount, 0, 0, 0);
    }

    renderPass.end();
    this.device.queue.submit([encoder.finish()]);

    requestAnimationFrame(this.renderLoop);
  }
}
