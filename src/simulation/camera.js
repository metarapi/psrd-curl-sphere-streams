import {
  add3,
  clamp,
  cross3,
  dot3,
  lookAtRowMajor,
  normalize3,
  scale3,
  sub3,
} from './math.js';

export class ArcRotateCamera {
  constructor(options = {}) {
    this.alpha = options.alpha ?? 0.8;
    this.beta = options.beta ?? 1.1;
    this.radius = options.radius ?? 3.8;
    this.target = [...(options.target ?? [0.0, 0.0, 0.0])];

    this.alphaVelocity = options.alphaVelocity ?? 0.0;
    this.betaVelocity = options.betaVelocity ?? 0.0;
    this.radiusVelocity = options.radiusVelocity ?? 0.0;
    this.panVelocity = [...(options.panVelocity ?? [0.0, 0.0, 0.0])];

    this.inertia = options.inertia ?? 0.9;
    this.angularSensitivity = options.angularSensitivity ?? 250.0;
    this.wheelPrecision = options.wheelPrecision ?? 600.0;
    this.panningSensitivity = options.panningSensitivity ?? 250.0;

    this.minRadius = options.minRadius ?? 1.4;
    this.maxRadius = options.maxRadius ?? 14.0;
  }

  step() {
    this.alphaVelocity *= this.inertia;
    this.betaVelocity *= this.inertia;
    this.radiusVelocity *= this.inertia;
    this.panVelocity = scale3(this.panVelocity, this.inertia);

    this.alpha += this.alphaVelocity;
    this.beta += this.betaVelocity;
    this.radius += this.radiusVelocity;
    this.target = add3(this.target, this.panVelocity);

    this.beta = clamp(this.beta, 0.01, Math.PI - 0.01);
    this.radius = clamp(this.radius, this.minRadius, this.maxRadius);

    if (Math.abs(this.alphaVelocity) < 1e-5) {
      this.alphaVelocity = 0.0;
    }
    if (Math.abs(this.betaVelocity) < 1e-5) {
      this.betaVelocity = 0.0;
    }
    if (Math.abs(this.radiusVelocity) < 1e-5) {
      this.radiusVelocity = 0.0;
    }
    if (dot3(this.panVelocity, this.panVelocity) < 1e-10) {
      this.panVelocity = [0.0, 0.0, 0.0];
    }
  }

  eye() {
    return [
      this.target[0] + this.radius * Math.sin(this.alpha) * Math.sin(this.beta),
      this.target[1] + this.radius * Math.cos(this.beta),
      this.target[2] + this.radius * Math.cos(this.alpha) * Math.sin(this.beta),
    ];
  }

  viewMatrix(up = [0.0, 1.0, 0.0]) {
    return lookAtRowMajor(this.eye(), this.target, up);
  }

  orbit(dx, dy) {
    this.alphaVelocity = dx / this.angularSensitivity;
    this.betaVelocity = dy / this.angularSensitivity;
  }

  zoom(wheelDy) {
    this.radiusVelocity = wheelDy / this.wheelPrecision;
  }

  pan(dx, dy, up = [0.0, 1.0, 0.0]) {
    const eye = this.eye();
    const fwd = normalize3(sub3(this.target, eye), [0.0, 0.0, -1.0]);
    const right = normalize3(cross3(fwd, up), [1.0, 0.0, 0.0]);
    const camUp = normalize3(cross3(right, fwd), [0.0, 1.0, 0.0]);

    const panScale = this.radius / this.panningSensitivity;
    const offset = add3(scale3(right, -dx), scale3(camUp, dy));
    this.panVelocity = scale3(offset, panScale);
  }
}

export class CanvasArcballController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.dragMode = null;
    this.lastX = 0.0;
    this.lastY = 0.0;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    this.lastX = event.clientX;
    this.lastY = event.clientY;

    const hasCtrl = event.ctrlKey || event.metaKey;
    this.dragMode = event.button === 2 || (event.button === 0 && hasCtrl) ? 'pan' : 'orbit';

    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onPointerMove(event) {
    if (this.dragMode === null) {
      return;
    }

    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    if (this.dragMode === 'orbit') {
      this.camera.orbit(dx, dy);
    } else {
      this.camera.pan(dx, dy);
    }

    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.dragMode === null) {
      return;
    }
    this.dragMode = null;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  }

  onWheel(event) {
    this.camera.zoom(event.deltaY);
    event.preventDefault();
  }

  onContextMenu(event) {
    event.preventDefault();
  }
}
