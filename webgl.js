import { initBuffers, initMeshBuffers } from "./init-buffers.js";
import { drawScene, camera }            from "./draw-scene.js";
import { parseOBJ }                     from "./parse-obj.js";

let gl, programInfo, buffers;
let animFrameId = null;

main();

function main() {
    const canvas = document.querySelector("#gl-canvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
        consoleLog("ERROR: WebGL not supported.", "error");
        return;
    }

    resizeCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); render(); });

    programInfo = {
        square: buildSquareProgram(gl),
        mesh:   buildMeshProgram(gl),
    };

    buffers = initBuffers(gl);
    startRenderLoop();
    setupOrbitControls(canvas);
    consoleLog("WebGL ready. Type <b>help</b> for commands.", "info");
}

function startRenderLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    (function loop() {
        animFrameId = requestAnimationFrame(loop);
        resizeCanvas();
        drawScene(gl, programInfo, buffers);
    })();
}

function render() {
    drawScene(gl, programInfo, buffers);
}

function resizeCanvas() {
    const canvas = gl.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(canvas.clientWidth  * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}

function setupOrbitControls(canvas) {
    let dragging = false, lastX = 0, lastY = 0;

    canvas.addEventListener('mousedown', e => {
        dragging = true;
        lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup',   () => { dragging = false; });
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        camera.yaw   -= dx * 0.005;
        camera.pitch -= dy * 0.005;
        camera.pitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, camera.pitch));
    });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        camera.distance *= (1 + e.deltaY * 0.001);
        camera.distance = Math.max(0.1, camera.distance);
    }, { passive: false });

    let lastTouchDist = null;
    canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            dragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }
    });
    canvas.addEventListener('touchend',   () => { dragging = false; lastTouchDist = null; });
    canvas.addEventListener('touchmove',  e => {
        e.preventDefault();
        if (e.touches.length === 1 && dragging) {
            const dx = e.touches[0].clientX - lastX;
            const dy = e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            camera.yaw   -= dx * 0.005;
            camera.pitch -= dy * 0.005;
            camera.pitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, camera.pitch));
        } else if (e.touches.length === 2) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY,
            );
            if (lastTouchDist !== null) {
                camera.distance *= lastTouchDist / d;
                camera.distance = Math.max(0.1, camera.distance);
            }
            lastTouchDist = d;
        }
    }, { passive: false });
}

document.addEventListener('keyup', async (e) => {
    if (e.key !== 'Enter') return;
    const input = document.getElementById('enter');
    const raw   = input.value.trim();
    if (!raw) return;

    consoleLog('> ' + raw, 'cmd');
    input.value = '';
    document.getElementById('console-history').scrollTop = 9999;

    await handleCommand(raw);
});

async function handleCommand(raw) {
    const [cmd, ...args] = raw.split(/\s+/);

    switch (cmd.toLowerCase()) {

        case 'load': {
            consoleLog('Opening file picker…', 'info');
            try {
                const text = await pickOBJFile();
                consoleLog('Parsing OBJ…', 'info');
                const obj = parseOBJ(text);
                buffers = initMeshBuffers(gl, obj);
                camera.distance = buffers.bbox.size * 1.8;
                camera.target   = [...buffers.bbox.center];
                consoleLog(`Loaded: ${obj.vertexCount} vertices, ${obj.vertexCount/3|0} triangles.`, 'ok');
            } catch (err) {
                if (err.message !== 'cancelled') {
                    consoleLog('Load failed: ' + err.message, 'error');
                } else {
                    consoleLog('Load cancelled.', 'info');
                }
            }
            break;
        }

        case 'reset':
            buffers = initBuffers(gl);
            camera.yaw = 0.4; camera.pitch = 0.3; camera.distance = 5;
            camera.target = [0,0,0];
            consoleLog('Reset to default view.', 'ok');
            break;

        case 'fov': {
            const v = parseFloat(args[0]);
            if (isNaN(v) || v < 5 || v > 170) { consoleLog('Usage: fov &lt;5-170&gt;', 'error'); return; }
            camera.fov = v;
            consoleLog(`FOV set to ${v}°.`, 'ok');
            break;
        }

        case 'color': {
            const hex = args[0];
            if (!hex) { consoleLog('Usage: color #rrggbb', 'error'); return; }
            const r = parseInt(hex.slice(1,3),16)/255;
            const g = parseInt(hex.slice(3,5),16)/255;
            const b = parseInt(hex.slice(5,7),16)/255;
            if (isNaN(r)) { consoleLog('Invalid hex color.', 'error'); return; }
            // Stored on programInfo; draw-scene reads it next frame
            programInfo.mesh._overrideColor = [r, g, b];
            consoleLog(`Mesh colour set to ${hex}.`, 'ok');
            break;
        }

        case 'help':
            consoleLog(
                'Commands: <b>load</b> | <b>reset</b> | <b>fov &lt;deg&gt;</b> | <b>color &lt;#hex&gt;</b> | <b>help</b>',
                'info',
            );
            break;

        default:
            consoleLog(`Unknown command: ${cmd}. Type <b>help</b>.`, 'error');
    }
}

function pickOBJFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.obj,text/plain';

        const onFocus = () => {
            window.removeEventListener('focus', onFocus);
            setTimeout(() => reject(new Error('cancelled')), 500);
        };

        input.addEventListener('change', () => {
            window.removeEventListener('focus', onFocus);
            const file = input.files[0];
            if (!file) { reject(new Error('cancelled')); return; }
            consoleLog(`Reading "${file.name}" (${(file.size/1024).toFixed(1)} KB)…`, 'info');
            const reader = new FileReader();
            reader.onload  = e  => resolve(e.target.result);
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsText(file);
        });

        window.addEventListener('focus', onFocus);
        input.click();
    });
}

function consoleLog(html, type = 'info') {
    const history = document.getElementById('console-history');
    const p = document.createElement('p');
    p.innerHTML  = html;
    p.className  = 'preCommand ' + type;
    history.appendChild(p);
    history.scrollTop = history.scrollHeight;
}

function buildSquareProgram(gl) {
    const vs = `
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        varying lowp vec4 vColor;
        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            vColor = aVertexColor;
        }
    `;
    const fs = `
        varying lowp vec4 vColor;
        void main() {
            gl_FragColor = vColor;
        }
    `;
    const prog = initShaderProgram(gl, vs, fs);
    return {
        program: prog,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(prog, 'aVertexPosition'),
            vertexColor:    gl.getAttribLocation(prog, 'aVertexColor'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(prog, 'uProjectionMatrix'),
            modelViewMatrix:  gl.getUniformLocation(prog, 'uModelViewMatrix'),
        },
    };
}

function buildMeshProgram(gl) {
    const vs = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uNormalMatrix;

        varying vec3 vNormal;
        varying vec3 vFragPos;

        void main() {
            vec4 worldPos   = uModelViewMatrix * vec4(aVertexPosition, 1.0);
            vFragPos        = worldPos.xyz;
            vNormal         = mat3(uNormalMatrix) * aVertexNormal;
            gl_Position     = uProjectionMatrix * worldPos;
        }
    `;
    const fs = `
        precision mediump float;

        uniform vec3 uLightDirection;
        uniform vec3 uLightColor;
        uniform vec3 uAmbientColor;
        uniform vec3 uMeshColor;
        uniform vec3 uEyePosition;
        uniform float uShininess;

        varying vec3 vNormal;
        varying vec3 vFragPos;

        void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(uLightDirection);
            vec3 V = normalize(uEyePosition - vFragPos);
            vec3 H = normalize(L + V);

            float diff = max(dot(N, L), 0.0);
            float spec = pow(max(dot(N, H), 0.0), uShininess);

            vec3 ambient  = uAmbientColor * uMeshColor;
            vec3 diffuse  = diff * uLightColor * uMeshColor;
            vec3 specular = spec * uLightColor * 0.4;

            gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
        }
    `;
    const prog = initShaderProgram(gl, vs, fs);
    return {
        program: prog,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(prog, 'aVertexPosition'),
            vertexNormal:   gl.getAttribLocation(prog, 'aVertexNormal'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(prog, 'uProjectionMatrix'),
            modelViewMatrix:  gl.getUniformLocation(prog, 'uModelViewMatrix'),
            normalMatrix:     gl.getUniformLocation(prog, 'uNormalMatrix'),
            lightDirection:   gl.getUniformLocation(prog, 'uLightDirection'),
            lightColor:       gl.getUniformLocation(prog, 'uLightColor'),
            ambientColor:     gl.getUniformLocation(prog, 'uAmbientColor'),
            meshColor:        gl.getUniformLocation(prog, 'uMeshColor'),
            eyePosition:      gl.getUniformLocation(prog, 'uEyePosition'),
            shininess:        gl.getUniformLocation(prog, 'uShininess'),
        },
    };
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vs = loadShader(gl, gl.VERTEX_SHADER,   vsSource);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Shader link error:', gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

function loadShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}