/**
 * draw-scene.js
 * Renders either the legacy coloured square or a lit 3-D OBJ mesh.
 */
import { mat4 } from "./glMatrix/index.js";

// ─── Shared camera state (mutated by webgl.js) ────────────────────────────────
export const camera = {
    yaw:      0.4,
    pitch:    0.3,
    distance: 5.0,
    target:   [0, 0, 0],
    fov:      45,
};

// ─── Main draw ────────────────────────────────────────────────────────────────
function drawScene(gl, programInfo, buffers) {
    gl.clearColor(0.08, 0.08, 0.10, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;

    const projectionMatrix = mat4.create();
    mat4.perspective(
        projectionMatrix,
        (camera.fov * Math.PI) / 180,
        aspect,
        0.01,
        1000.0,
    );

    // Orbit camera
    const eyeX = camera.target[0] + camera.distance * Math.sin(camera.yaw)   * Math.cos(camera.pitch);
    const eyeY = camera.target[1] + camera.distance * Math.sin(camera.pitch);
    const eyeZ = camera.target[2] + camera.distance * Math.cos(camera.yaw)   * Math.cos(camera.pitch);

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [eyeX, eyeY, eyeZ], camera.target, [0, 1, 0]);

    const modelMatrix     = mat4.create();
    const modelViewMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    if (buffers.mode === 'mesh') {
        drawMesh(gl, programInfo.mesh, buffers, projectionMatrix, modelViewMatrix, normalMatrix, [eyeX, eyeY, eyeZ]);
    } else {
        drawSquare(gl, programInfo.square, buffers, projectionMatrix);
    }
}

// ─── OBJ mesh (Phong) ─────────────────────────────────────────────────────────
function drawMesh(gl, p, buffers, proj, mv, nm, eyePos) {
    gl.useProgram(p.program);

    bindAttr(gl, buffers.position, p.attribLocations.vertexPosition, 3);
    bindAttr(gl, buffers.normal,   p.attribLocations.vertexNormal,   3);

    gl.uniformMatrix4fv(p.uniformLocations.projectionMatrix, false, proj);
    gl.uniformMatrix4fv(p.uniformLocations.modelViewMatrix,  false, mv);
    gl.uniformMatrix4fv(p.uniformLocations.normalMatrix,     false, nm);

    const meshColor = p._overrideColor || [0.72, 0.78, 0.88];

    gl.uniform3fv(p.uniformLocations.lightDirection, normalize3([1.0, 2.0, 1.5]));
    gl.uniform3fv(p.uniformLocations.lightColor,     [1.0, 0.97, 0.9]);
    gl.uniform3fv(p.uniformLocations.ambientColor,   [0.12, 0.12, 0.18]);
    gl.uniform3fv(p.uniformLocations.meshColor,      meshColor);
    gl.uniform3fv(p.uniformLocations.eyePosition,    eyePos);
    gl.uniform1f( p.uniformLocations.shininess,      64.0);

    gl.drawArrays(gl.TRIANGLES, 0, buffers.count);
}

// ─── Legacy square ────────────────────────────────────────────────────────────
function drawSquare(gl, p, buffers, proj) {
    gl.useProgram(p.program);

    const mv = mat4.create();
    mat4.translate(mv, mv, [0.0, 0.0, -6.0]);

    bindAttr(gl, buffers.position, p.attribLocations.vertexPosition, 2);
    bindAttr(gl, buffers.color,    p.attribLocations.vertexColor,    4);

    gl.uniformMatrix4fv(p.uniformLocations.projectionMatrix, false, proj);
    gl.uniformMatrix4fv(p.uniformLocations.modelViewMatrix,  false, mv);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function bindAttr(gl, buffer, location, numComponents) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location, numComponents, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(location);
}

function normalize3([x, y, z]) {
    const len = Math.sqrt(x*x + y*y + z*z) || 1;
    return [x/len, y/len, z/len];
}

export { drawScene };
