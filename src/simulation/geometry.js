// Mesh bases for cube-sphere generation (separate from cube texture sampling orientation).
const FACE_BASES = [
  {
    uAxis: [1.0, 0.0, 0.0],
    vAxis: [0.0, -1.0, 0.0],
    wAxis: [0.0, 0.0, -1.0],
  },
  {
    uAxis: [-1.0, 0.0, 0.0],
    vAxis: [0.0, -1.0, 0.0],
    wAxis: [0.0, 0.0, 1.0],
  },
  {
    uAxis: [1.0, 0.0, 0.0],
    vAxis: [0.0, 0.0, 1.0],
    wAxis: [0.0, -1.0, 0.0],
  },
  {
    uAxis: [1.0, 0.0, 0.0],
    vAxis: [0.0, 0.0, -1.0],
    wAxis: [0.0, 1.0, 0.0],
  },
  {
    uAxis: [0.0, 0.0, -1.0],
    vAxis: [0.0, -1.0, 0.0],
    wAxis: [-1.0, 0.0, 0.0],
  },
  {
    uAxis: [0.0, 0.0, 1.0],
    vAxis: [0.0, -1.0, 0.0],
    wAxis: [1.0, 0.0, 0.0],
  },
];

function cubeToSphere(v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];

  const sx = x * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * y * y - 0.5 * z * z + (y * y * z * z) / 3.0));
  const sy = y * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * z * z - 0.5 * x * x + (z * z * x * x) / 3.0));
  const sz = z * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * x * x - 0.5 * y * y + (x * x * y * y) / 3.0));

  return [sx, sy, sz];
}

function buildIndices(subdiv) {
  const indices = [];
  const n = subdiv + 1;

  for (let faceId = 0; faceId < 6; faceId += 1) {
    const offset = faceId * n * n;
    for (let j = 0; j < subdiv; j += 1) {
      for (let i = 0; i < subdiv; i += 1) {
        const v00 = offset + j * n + i;
        const v10 = offset + j * n + (i + 1);
        const v11 = offset + (j + 1) * n + (i + 1);
        const v01 = offset + (j + 1) * n + i;
        indices.push(v00, v10, v11, v00, v11, v01);
      }
    }
  }

  return indices;
}

function buildFace(faceId, subdiv) {
  const { uAxis, vAxis, wAxis } = FACE_BASES[faceId];
  const facePositions = [];

  for (let j = 0; j <= subdiv; j += 1) {
    for (let i = 0; i <= subdiv; i += 1) {
      const u = -1.0 + (2.0 * i) / subdiv;
      const v = -1.0 + (2.0 * j) / subdiv;

      const cube = [
        u * uAxis[0] + v * vAxis[0] + wAxis[0],
        u * uAxis[1] + v * vAxis[1] + wAxis[1],
        u * uAxis[2] + v * vAxis[2] + wAxis[2],
      ];
      const sphere = cubeToSphere(cube);
      facePositions.push(sphere[0], sphere[1], sphere[2]);
    }
  }

  return facePositions;
}

export function buildCubeSphere(subdiv = 32) {
  const positions = [];
  for (let faceId = 0; faceId < 6; faceId += 1) {
    positions.push(...buildFace(faceId, subdiv));
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(buildIndices(subdiv)),
  };
}
