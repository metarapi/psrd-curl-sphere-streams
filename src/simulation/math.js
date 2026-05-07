// Matrix helpers use row-major math to match the Python reference, then convert to column-major for GPU upload.
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize3(v, fallback = [0, 0, 0], eps = 1e-20) {
  const n = length3(v);
  if (n <= eps) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function lookAtRowMajor(eye, target, up) {
  const z = normalize3(sub3(eye, target), [0, 0, 1]);
  const x = normalize3(cross3(up, z), [1, 0, 0]);
  const y = cross3(z, x);

  const m = new Float32Array(16);
  m[0] = x[0];
  m[1] = x[1];
  m[2] = x[2];
  m[3] = -dot3(x, eye);

  m[4] = y[0];
  m[5] = y[1];
  m[6] = y[2];
  m[7] = -dot3(y, eye);

  m[8] = z[0];
  m[9] = z[1];
  m[10] = z[2];
  m[11] = -dot3(z, eye);

  m[12] = 0.0;
  m[13] = 0.0;
  m[14] = 0.0;
  m[15] = 1.0;

  return m;
}

export function perspectiveRowMajor(fovYRadians, aspect, zNear, zFar) {
  const f = 1.0 / Math.tan(0.5 * fovYRadians);
  const safeAspect = Math.max(1e-12, aspect);

  const m = new Float32Array(16);
  m[0] = f / safeAspect;
  m[5] = f;
  m[10] = zFar / (zNear - zFar);
  m[11] = (zFar * zNear) / (zNear - zFar);
  m[14] = -1.0;
  return m;
}

export function multiplyMat4RowMajor(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[row * 4 + k] * b[k * 4 + col];
      }
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

export function mat4RowMajorToColumnMajor(rowMajor) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] = rowMajor[row * 4 + col];
    }
  }
  return out;
}
