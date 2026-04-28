/**
 * parse-obj.js
 * Parses a Wavefront .obj file string into flat Float32Arrays
 * ready to upload to WebGL buffers.
 *
 * Returns: { positions, normals, vertexCount }
 *   positions – flat [x,y,z, x,y,z, …]  (one entry per triangle vertex)
 *   normals   – flat [nx,ny,nz, …]       (same length)
 *   vertexCount – number of vertices
 */
export function parseOBJ(text) {
    const rawPositions = [];   // indexed from 1
    const rawNormals   = [];   // indexed from 1
    const rawUVs       = [];   // indexed from 1

    const outPositions = [];
    const outNormals   = [];

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const keyword = parts[0];

        if (keyword === 'v') {
            rawPositions.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (keyword === 'vn') {
            rawNormals.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (keyword === 'vt') {
            rawUVs.push([
                parseFloat(parts[1]),
                parseFloat(parts[2] ?? 0),
            ]);
        } else if (keyword === 'f') {
            // Fan-triangulate any polygon (works for quads too)
            const faceVerts = parts.slice(1).map(parseFaceVertex);
            for (let i = 1; i < faceVerts.length - 1; i++) {
                emitTriangle(faceVerts[0], faceVerts[i], faceVerts[i + 1]);
            }
        }
    }

    // If the OBJ had no normals, compute face normals
    const hasNormals = outNormals.length > 0;
    if (!hasNormals) {
        computeFaceNormals(outPositions, outNormals);
    }

    return {
        positions:   new Float32Array(outPositions),
        normals:     new Float32Array(outNormals),
        vertexCount: outPositions.length / 3,
    };

    // ─── helpers ────────────────────────────────────────────────────────────

    function parseFaceVertex(token) {
        // token = "v", "v/vt", "v/vt/vn", or "v//vn"  (1-based indices)
        const [vi, ti, ni] = token.split('/').map(s => (s ? parseInt(s, 10) : undefined));
        return { vi, ti, ni };
    }

    function emitTriangle(a, b, c) {
        for (const ref of [a, b, c]) {
            const pos = rawPositions[ref.vi - 1];
            outPositions.push(...pos);

            if (ref.ni != null) {
                const n = rawNormals[ref.ni - 1];
                outNormals.push(...n);
            } else {
                // placeholder – will be filled by computeFaceNormals
                outNormals.push(0, 0, 1);
            }
        }
    }

    function computeFaceNormals(pos, nor) {
        // Overwrite every group of 3 vertices with the face normal
        for (let i = 0; i < pos.length; i += 9) {
            const ax = pos[i],     ay = pos[i+1], az = pos[i+2];
            const bx = pos[i+3],   by = pos[i+4], bz = pos[i+5];
            const cx = pos[i+6],   cy = pos[i+7], cz = pos[i+8];

            const ux = bx-ax, uy = by-ay, uz = bz-az;
            const vx = cx-ax, vy = cy-ay, vz = cz-az;

            let nx = uy*vz - uz*vy;
            let ny = uz*vx - ux*vz;
            let nz = ux*vy - uy*vx;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
            nx /= len; ny /= len; nz /= len;

            for (let k = 0; k < 3; k++) {
                nor[i + k*3]     = nx;
                nor[i + k*3 + 1] = ny;
                nor[i + k*3 + 2] = nz;
            }
        }
    }
}
