function initBuffers(gl) {
    return {
        position: initPositionBuffer(gl),
        color:    initColorBuffer(gl),
        normal:   null,
        count:    4,
        mode:     'square',
    };
}

function initColorBuffer(gl) {
    const colors = [
        1.0, 1.0, 1.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 0.0, 1.0, 1.0,
    ];
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    return buf;
}

function initPositionBuffer(gl) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    return buf;
}

function initMeshBuffers(gl, obj) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, obj.positions, gl.STATIC_DRAW);

    const norBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, norBuf);
    gl.bufferData(gl.ARRAY_BUFFER, obj.normals, gl.STATIC_DRAW);

    return {
        position: posBuf,
        normal:   norBuf,
        color:    null,
        count:    obj.vertexCount,
        mode:     'mesh',
        bbox: computeBBox(obj.positions),
    };
}

function computeBBox(pos) {
    let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
        minX = Math.min(minX, pos[i]);   maxX = Math.max(maxX, pos[i]);
        minY = Math.min(minY, pos[i+1]); maxY = Math.max(maxY, pos[i+1]);
        minZ = Math.min(minZ, pos[i+2]); maxZ = Math.max(maxZ, pos[i+2]);
    }
    return {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
        center: [(minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2],
        size: Math.max(maxX-minX, maxY-minY, maxZ-minZ),
    };
}

export { initBuffers, initMeshBuffers };
