// --- Audio System ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTurnSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

// --- Three.js Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.5, 3.8, 6.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- Cube Configuration ---
const CUBE_SIZE = 1;
const SPACING = 0.05;
const offset = (CUBE_SIZE + SPACING) / 2;

// WCA Colors: U(White), D(Yellow), F(Green), B(Blue), R(Red), L(Orange)
// Faces in Three.js BoxGeometry: +x(R), -x(L), +y(U), -y(D), +z(F), -z(B)
const colors = {
    R: 0xb71234, // Red
    L: 0xff5800, // Orange
    U: 0xffffff, // White
    D: 0xffd500, // Yellow
    F: 0x009b48, // Green
    B: 0x0046ad, // Blue
    Core: 0x111111 // Black/Dark Grey
};

let cubies = [];
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// --- Dot System State (Declared early to eliminate TDZ ReferenceErrors) ---
let dots = [];
let dotMode = false;
let dotColorIndex = 0;
const dotColors = ['#00FFFF', '#FF00FF', '#00FF00', '#FFA500', '#800080', '#FFFF00', '#FFC0CB', '#0000FF'];

// --- Floating Hidden Sides State (Declared early to eliminate TDZ ReferenceErrors) ---
const floatingSidesGroup = new THREE.Group();
scene.add(floatingSidesGroup);
let floatingSidesEnabled = true;
let floatingMirrors = {};

const MIRROR_DIST = 2.45;
const MIRROR_SIZE = 2.05;

const mirrorConfigs = {
    D: { // Down face (Yellow) - lies in XZ plane, normal +Y (facing up towards camera)
        pos: new THREE.Vector3(0.1, -2.9, 0.4),
        rot: new THREE.Euler(-Math.PI / 2, 0, 0),
        quadrants: [
            [ [1, 0], [1, 1] ],
            [ [0, 0], [0, 1] ]
        ]
    },
    U: { // Up face (White) - lies in XZ plane, normal -Y (facing down towards camera)
        pos: new THREE.Vector3(-0.1, 2.9, -0.4),
        rot: new THREE.Euler(Math.PI / 2, 0, 0),
        quadrants: [
            [ [0, 0], [0, 1] ],
            [ [1, 0], [1, 1] ]
        ]
    },
    L: { // Left face (Orange) - lies in YZ plane, normal +X (facing right towards camera)
        pos: new THREE.Vector3(-2.6, 2.0, -0.8),
        rot: new THREE.Euler(0, Math.PI / 2, 0),
        quadrants: [
            [ [0, 1], [0, 0] ],
            [ [1, 1], [1, 0] ]
        ]
    },
    R: { // Right face (Red) - lies in YZ plane, normal -X (facing left towards camera)
        pos: new THREE.Vector3(2.6, -2.0, 0.8),
        rot: new THREE.Euler(0, -Math.PI / 2, 0),
        quadrants: [
            [ [0, 0], [0, 1] ],
            [ [1, 0], [1, 1] ]
        ]
    },
    B: { // Back face (Blue) - lies in XY plane, normal +Z (facing forward towards camera)
        pos: new THREE.Vector3(1.8, 2.0, -2.4),
        rot: new THREE.Euler(0, 0, 0),
        quadrants: [
            [ [0, 1], [0, 0] ],
            [ [1, 1], [1, 0] ]
        ]
    },
    F: { // Front face (Green) - lies in XY plane, normal -Z (facing backward towards camera)
        pos: new THREE.Vector3(-1.8, -2.0, 2.4),
        rot: new THREE.Euler(0, Math.PI, 0),
        quadrants: [
            [ [0, 0], [0, 1] ],
            [ [1, 0], [1, 1] ]
        ]
    }
};

// Materials Factory
function getMaterials(theme) {
    const mats = [];
    const colorMap = [colors.R, colors.L, colors.U, colors.D, colors.F, colors.B];
    
    for (let i = 0; i < 6; i++) {
        let matConfig = { color: colorMap[i], roughness: 0.5, metalness: 0.1 };
        
        if (theme === 'cyberpunk') {
            matConfig = { color: colorMap[i], emissive: colorMap[i], emissiveIntensity: 0.5, wireframe: true };
        } else if (theme === 'glass') {
            matConfig = { color: colorMap[i], transparent: true, opacity: 0.8, roughness: 0.1, transmission: 0.9 };
        } else if (theme === 'carbon') {
            matConfig = { color: colorMap[i], roughness: 0.8, metalness: 0.8 };
        }
        
        mats.push(new THREE.MeshStandardMaterial(matConfig));
    }
    return mats;
}

let currentMaterials = getMaterials('classic');
const coreMaterial = new THREE.MeshStandardMaterial({ color: colors.Core, roughness: 0.9 });

function createCube() {
    // Clear existing
    cubies.forEach(c => cubeGroup.remove(c));
    cubies = [];

    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    
    for (let x = -1; x <= 1; x += 2) {
        for (let y = -1; y <= 1; y += 2) {
            for (let z = -1; z <= 1; z += 2) {
                 // Core is empty structurally
                
                const pieceMats = currentMaterials.map((mat, index) => {
                    // Check if face is external
                    if (index === 0 && x === 1) return mat; // +x
                    if (index === 1 && x === -1) return mat; // -x
                    if (index === 2 && y === 1) return mat; // +y
                    if (index === 3 && y === -1) return mat; // -y
                    if (index === 4 && z === 1) return mat; // +z
                    if (index === 5 && z === -1) return mat; // -z
                    return coreMaterial;
                });

                const mesh = new THREE.Mesh(geometry, pieceMats);
                mesh.position.set(x * offset, y * offset, z * offset);
                mesh.userData = { initialPosition: mesh.position.clone() };
                cubeGroup.add(mesh);
                cubies.push(mesh);
            }
        }
    }
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}
createCube();

// --- Theme Management ---
document.getElementById('theme-select').addEventListener('change', (e) => {
    const theme = e.target.value;
    document.body.setAttribute('data-theme', theme);
    currentMaterials = getMaterials(theme);
    createCube(); // Recreate with new materials
    
    if (theme === 'cyberpunk') {
        scene.background = new THREE.Color(0x050510);
        ambientLight.intensity = 0.2;
    } else if (theme === 'glass') {
        scene.background = new THREE.Color(0xe0e5ec);
        ambientLight.intensity = 0.8;
    } else {
        scene.background = null;
        ambientLight.intensity = 0.6;
    }
});

// --- Interaction (Raycast Dragging) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDragging = false;
let activeMesh = null;
let activeFaceNormal = null;
let startMousePos = new THREE.Vector2();
let dragAxis = null;
let dragGroup = new THREE.Group();
scene.add(dragGroup);
let animationInProgress = false;

function getIntersect(event) {
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubies);
    return intersects.length > 0 ? intersects[0] : null;
}

window.addEventListener('pointerdown', onInputDown, { passive: false, capture: true });
window.addEventListener('pointermove', onInputMove, { passive: false, capture: true });
window.addEventListener('pointerup', onInputUp, { capture: true });
window.addEventListener('pointercancel', onInputUp, { capture: true });

function onInputDown(event) {
    if (animationInProgress || event.button === 2) return; // Ignore right click
    
    // Ignore clicks originating inside drawer, buttons, or panels
    if (event.target && event.target.closest && (event.target.closest('#dot-drawer') || event.target.closest('#btn-open-drawer') || event.target.closest('.panel') || event.target.closest('.top-actions'))) {
        return;
    }

    const intersect = getIntersect(event);
    if (intersect) {
        controls.enabled = false; // Disable camera orbit while turning slice or placing dot
        if (!event.touches) event.preventDefault();
        
        if (dotMode) {
            const localNormal = intersect.face.normal.clone().round();
            addDotToFace(intersect.object, localNormal);
            return;
        }

        isDragging = true;
        activeMesh = intersect.object;
        activeFaceNormal = intersect.face.normal.clone().transformDirection(activeMesh.matrixWorld).round();
        
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        startMousePos.set(clientX, clientY);
        dragAxis = null;
    } else if (dotMode && floatingSidesEnabled && typeof mirrorConfigs !== 'undefined') {
        // Check if user clicked a floating mirror sticker directly
        const mirrorMeshes = Object.values(floatingMirrors).map(m => m.mesh);
        const mirrorHits = raycaster.intersectObjects(mirrorMeshes);
        if (mirrorHits.length > 0) {
            const hit = mirrorHits[0];
            const faceKey = hit.object.userData.faceKey;
            const uv = hit.uv;
            if (faceKey && uv) {
                const qr = uv.y < 0.5 ? 1 : 0;
                const qc = uv.x < 0.5 ? 0 : 1;
                const cfg = mirrorConfigs[faceKey];
                if (cfg && typeof getCube2DState === 'function') {
                    const [sr, sc] = cfg.quadrants[qr][qc];
                    const state = getCube2DState();
                    const sticker = state[faceKey] && state[faceKey][sr] ? state[faceKey][sr][sc] : null;
                    if (sticker && sticker.cubie && sticker.localNormal) {
                        controls.enabled = false;
                        if (!event.touches) event.preventDefault();
                        addDotToFace(sticker.cubie, sticker.localNormal);
                        return;
                    }
                }
            }
        }
        controls.enabled = true;
    } else {
        controls.enabled = true; // Clicked outside: OrbitControls rotates camera
    }
}

function onInputMove(event) {
    if (!isDragging || animationInProgress) return;
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    const deltaX = clientX - startMousePos.x;
    const deltaY = clientY - startMousePos.y;
    
    if (dragAxis === null) {
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            // Determine drag axis based on face clicked and screen movement
            determineDragAxis(deltaX, deltaY);
            if (dragAxis) {
                groupCubies(activeMesh, dragAxis);
            } else {
                isDragging = false; // Invalid drag
            }
        }
    } else {
        // Apply rotation to dragGroup
        const sensitivity = 0.01;
        let rotAmount = 0;
        
        // Simple mapping based on axis
        if (dragAxis === 'x') rotAmount = deltaY * sensitivity * Math.sign(activeFaceNormal.z || 1);
        if (dragAxis === 'y') rotAmount = deltaX * sensitivity * Math.sign(activeFaceNormal.z || 1);
        if (dragAxis === 'z') rotAmount = deltaX * sensitivity * Math.sign(activeFaceNormal.y || -1);
        
        dragGroup.rotation[dragAxis] = rotAmount;
    }
}

function determineDragAxis(dx, dy) {
    // Highly simplified mapping. 
    // In a full engine, we'd project 3D vectors to 2D screen space.
    if (Math.abs(activeFaceNormal.x) > 0.5) {
        dragAxis = Math.abs(dy) > Math.abs(dx) ? 'z' : 'y';
    } else if (Math.abs(activeFaceNormal.y) > 0.5) {
        dragAxis = Math.abs(dy) > Math.abs(dx) ? 'z' : 'x';
    } else {
        dragAxis = Math.abs(dy) > Math.abs(dx) ? 'x' : 'y';
    }
}

function groupCubies(centerMesh, axis) {
    const threshold = 0.1;
    const centerVal = centerMesh.getWorldPosition(new THREE.Vector3())[axis];
    
    cubies.forEach(c => {
        const pos = c.getWorldPosition(new THREE.Vector3());
        if (Math.abs(pos[axis] - centerVal) < threshold) {
            dragGroup.attach(c);
        }
    });
}

function onInputUp(event) {
    controls.enabled = true;
    if (!isDragging) return;
    isDragging = false;
    
    if (dragAxis && dragGroup.children.length > 0) {
        snapAndUngroup();
    }
}

function snapAndUngroup() {
    animationInProgress = true;
    
    // Snap to nearest 90 degrees (Math.PI / 2)
    const currentRot = dragGroup.rotation[dragAxis];
    const snapRot = Math.round(currentRot / (Math.PI / 2)) * (Math.PI / 2);
    
    // Animate snap
    const step = (snapRot - currentRot) * 0.2;
    let frames = 0;
    
    function animateSnap() {
        frames++;
        dragGroup.rotation[dragAxis] += step;
        
        if (frames < 5) {
            requestAnimationFrame(animateSnap);
        } else {
            dragGroup.rotation[dragAxis] = snapRot;
            dragGroup.updateMatrixWorld();
            
            // Re-parent to cubeGroup and fix floating point drift
            const children = [...dragGroup.children];
            children.forEach(c => {
                cubeGroup.attach(c);
                
                // Snap Position
                c.position.x = Math.round(c.position.x / offset) * offset;
                c.position.y = Math.round(c.position.y / offset) * offset;
                c.position.z = Math.round(c.position.z / offset) * offset;
                
                // Snap Rotation
                const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
                euler.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
                euler.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
                euler.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
                c.quaternion.setFromEuler(euler);
            });
            
            dragGroup.rotation.set(0,0,0);
            playTurnSound();
            animationInProgress = false;
            if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
            
            if (snapRot !== 0) {
                recordMove();
            }
        }
    }
    animateSnap();
}

// --- Logic & Scrambling ---
const moveHistory = [];
const axes = ['x', 'y', 'z'];
const coords = [-offset, offset];

function performProgrammaticMove(axis, coord, direction, duration=200) {
    return new Promise(resolve => {
        animationInProgress = true;
        dragAxis = axis;
        
        cubies.forEach(c => {
            if (Math.abs(c.position[axis] - coord) < 0.1) dragGroup.attach(c);
        });
        
        const targetRot = direction * (Math.PI / 2);
        const startTime = performance.now();
        
        function animateFrame(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            dragGroup.rotation[axis] = targetRot * progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                dragGroup.updateMatrixWorld();
                const children = [...dragGroup.children];
                children.forEach(c => {
                    cubeGroup.attach(c);
                    c.position.x = Math.round(c.position.x / offset) * offset;
                    c.position.y = Math.round(c.position.y / offset) * offset;
                    c.position.z = Math.round(c.position.z / offset) * offset;
                    
                    const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
                    euler.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
                    euler.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
                    euler.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
                    c.quaternion.setFromEuler(euler);
                });
                dragGroup.rotation.set(0,0,0);
                playTurnSound();
                animationInProgress = false;
                if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
                resolve();
            }
        }
        requestAnimationFrame(animateFrame);
    });
}

function recordMove() {
    // Real implementation would parse matrix state to standard notation.
    // We just note a change happened.
}

const INITIAL_CAMERA_POS = new THREE.Vector3(4.5, 3.8, 6.8);
const INITIAL_TARGET_POS = new THREE.Vector3(0, 0, 0);

function resetCamera(duration = 350) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(startPos, INITIAL_CAMERA_POS, ease);
        controls.target.lerpVectors(startTarget, INITIAL_TARGET_POS, ease);
        controls.update();

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            camera.position.copy(INITIAL_CAMERA_POS);
            controls.target.copy(INITIAL_TARGET_POS);
            controls.update();
        }
    }
    requestAnimationFrame(step);
}

function resetCube() {
    isPlaying = false;
    animationInProgress = false;
    isDragging = false;
    dragAxis = null;

    if (dragGroup.children.length > 0) {
        const children = [...dragGroup.children];
        children.forEach(c => cubeGroup.attach(c));
    }
    dragGroup.rotation.set(0, 0, 0);

    // Reset positions and rotations to canonical initial state without destroying cubies or their child dots
    cubies.forEach(c => {
        c.position.copy(c.userData.initialPosition);
        c.quaternion.identity();
        c.updateMatrixWorld();
    });

    moveHistory.length = 0;
    const solveControls = document.getElementById('solve-controls');
    if (solveControls) solveControls.style.display = 'none';

    resetCamera(350);
    playTurnSound();
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

async function scrambleCube() {
    if (animationInProgress) return;
    moveHistory.length = 0; // reset
    
    const solveControls = document.getElementById('solve-controls');
    if (solveControls) solveControls.style.display = 'none';
    
    for (let i = 0; i < 20; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const coord = coords[Math.floor(Math.random() * coords.length)];
        const dir = Math.random() > 0.5 ? 1 : -1;
        
        moveHistory.push({ axis, coord, dir: -dir }); // Push inverse for solver
        await performProgrammaticMove(axis, coord, dir, 50); // fast turn
    }
    
    if (solveControls) solveControls.style.display = 'block';
}

document.getElementById('btn-scramble').addEventListener('click', () => {
    scrambleCube();
});

document.getElementById('btn-reset').addEventListener('click', () => {
    resetCube();
});


const MOVES = {
    'R': { axis: 'x', coord: offset, dir: -1 },
    "R'": { axis: 'x', coord: offset, dir: 1 },
    'L': { axis: 'x', coord: -offset, dir: 1 },
    "L'": { axis: 'x', coord: -offset, dir: -1 },
    'U': { axis: 'y', coord: offset, dir: -1 },
    "U'": { axis: 'y', coord: offset, dir: 1 },
    'D': { axis: 'y', coord: -offset, dir: 1 },
    "D'": { axis: 'y', coord: -offset, dir: -1 },
    'F': { axis: 'z', coord: offset, dir: -1 },
    "F'": { axis: 'z', coord: offset, dir: 1 },
    'B': { axis: 'z', coord: -offset, dir: 1 },
    "B'": { axis: 'z', coord: -offset, dir: -1 },
};

async function executeMove(moveStr) {
    if (animationInProgress) return;
    if (moveStr.endsWith('2')) {
        const base = moveStr.slice(0, -1);
        await executeMove(base);
        await executeMove(base);
        return;
    }
    const m = MOVES[moveStr];
    if (m) {
        moveHistory.push({ axis: m.axis, coord: m.coord, dir: -m.dir }); // Push inverse for solver
        await performProgrammaticMove(m.axis, m.coord, m.dir, 200);
        document.getElementById('solve-controls').style.display = 'block';
    }
}

document.querySelectorAll('.notation-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
        executeMove(btn.getAttribute('data-move'));
    });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu && settingsMenu.classList.contains('open')) {
            settingsMenu.classList.remove('open');
            return;
        }
        const drawer = document.getElementById('dot-drawer');
        if (drawer && drawer.classList.contains('open')) {
            drawer.classList.remove('open');
            return;
        }
        resetCube();
        return;
    }

    if (e.target.tagName === 'INPUT') return; // ignore notation keys when typing in text fields
    
    const key = e.key.toUpperCase();
    const validKeys = ['R', 'L', 'U', 'D', 'F', 'B'];
    if (validKeys.includes(key)) {
        const moveStr = key + (e.shiftKey ? "'" : "");
        executeMove(moveStr);
    }
});


// --- Solver Interface (Reverse playback for Demo) ---
let isPlaying = false;
document.getElementById('btn-solve-play').addEventListener('click', async () => {
    if (isPlaying || animationInProgress || moveHistory.length === 0) return;
    isPlaying = true;
    while (moveHistory.length > 0 && isPlaying) {
        const move = moveHistory.pop();
        await performProgrammaticMove(move.axis, move.coord, move.dir, 200);
        await new Promise(r => setTimeout(r, 100)); // slight pause
    }
    isPlaying = false;
});

document.getElementById('btn-solve-next').addEventListener('click', async () => {
    if (animationInProgress || moveHistory.length === 0) return;
    const move = moveHistory.pop();
    await performProgrammaticMove(move.axis, move.coord, move.dir, 200);
});

// --- Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();


// --- Dot System ---

function toggleDotMode() {
    dotMode = !dotMode;
    const btn = document.getElementById('btn-toggle-dot-mode');
    if (btn) {
        btn.classList.toggle('active', dotMode);
        btn.innerText = `Facelet Mode: ${dotMode ? 'ON' : 'OFF'}`;
    }
}

function formatDotTextHtml(text) {
    if (!text) return '';
    if (text.includes('\n')) {
        return text.split('\n').map(part => formatDotTextHtml(part)).join('<br>');
    }
    const match = text.match(/^([A-Za-z0-9<>/\\]+)[_\{]+([A-Za-z0-9]+)[\}]?$/);
    if (match) {
        return `${match[1]}<sub>${match[2]}</sub>`;
    }
    const underMatch = text.match(/^([0-9]+)_$/);
    if (underMatch) {
        return `<u>${underMatch[1]}</u>`;
    }
    return text;
}

function parseUnderlineSegments(str) {
    if (!str) return [{ text: '', underline: false }];
    const segments = [];
    const regex = /<u>(.*?)<\/u>/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ text: str.substring(lastIndex, match.index), underline: false });
        }
        segments.push({ text: match[1], underline: true });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
        segments.push({ text: str.substring(lastIndex), underline: false });
    }
    return segments.length > 0 ? segments : [{ text: str, underline: false }];
}

function drawTextWithUnderline(ctx, textStr, centerX, centerY, font, fontSize, color = '#000000') {
    const segments = parseUnderlineSegments(textStr);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    
    // Measure total width
    let totalWidth = 0;
    for (const seg of segments) {
        seg.width = ctx.measureText(seg.text).width;
        totalWidth += seg.width;
    }
    
    let curX = centerX - totalWidth / 2;
    const underlineY = centerY + fontSize * 0.44;
    const lineWidth = Math.max(3, Math.round(fontSize * 0.085));
    
    ctx.textAlign = 'left';
    for (const seg of segments) {
        ctx.fillText(seg.text, curX, centerY);
        if (seg.underline) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(curX, underlineY);
            ctx.lineTo(curX + seg.width, underlineY);
            ctx.stroke();
            ctx.restore();
        }
        curX += seg.width;
    }
}

function createDotTexture(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.stroke();
    
    // Text drawing with full subscript support
    if (text) {
        if (text.includes('\n')) {
            const lines = text.split('\n');
            const line1 = lines[0]; // Singmaster (e.g. F_{UL} or F)
            const line2 = lines[1]; // GAP54 (e.g. 19 or 23)

            // Subtle divider line across middle
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(56, 128);
            ctx.lineTo(200, 128);
            ctx.stroke();

            // Line 1: Singmaster
            const subMatch = line1.match(/^([A-Za-z0-9]+)[_\{]+([A-Za-z0-9]+)[\}]?$/);
            if (subMatch) {
                const base = subMatch[1];
                const sub = subMatch[2];
                ctx.fillStyle = '#000000';
                ctx.textBaseline = 'middle';
                const baseFont = 'bold 70px sans-serif';
                const subFont = 'bold 46px sans-serif';
                ctx.font = baseFont;
                const baseW = ctx.measureText(base).width;
                ctx.font = subFont;
                const subW = ctx.measureText(sub).width;
                const totalW = baseW + subW + 2;
                const startX = 128 - totalW / 2;

                ctx.font = baseFont;
                ctx.fillText(base, startX, 78);

                ctx.font = subFont;
                ctx.fillText(sub, startX + baseW + 2, 98);
            } else {
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = line1.length === 1 ? 'bold 76px sans-serif' : 'bold 62px sans-serif';
                ctx.fillText(line1, 128, 82);
            }

            // Line 2: GAP24 index (with underline support)
            const cleanLine2 = line2.replace(/<\/?u>/g, '');
            const fontSize = cleanLine2.length === 1 ? 76 : 68;
            const font = 'bold ' + fontSize + 'px sans-serif';
            drawTextWithUnderline(ctx, line2, 128, 180, font, fontSize);
        } else {
            const subMatch = text.match(/^([A-Za-z0-9<>/\\]+)[_\{]+([A-Za-z0-9]+)[\}]?$/);
            if (subMatch) {
                const base = subMatch[1];
                const sub = subMatch[2];
                
                ctx.fillStyle = '#000000';
                ctx.textBaseline = 'middle';
                
                const baseFont = 'bold 96px sans-serif';
                const subFont = 'bold 62px sans-serif';
                
                ctx.font = baseFont;
                const baseW = ctx.measureText(base.replace(/<\/?u>/g, '')).width;
                ctx.font = subFont;
                const subW = ctx.measureText(sub.replace(/<\/?u>/g, '')).width;
                
                const totalW = baseW + subW + 4;
                const startX = 128 - totalW / 2;
                
                drawTextWithUnderline(ctx, base, startX + baseW / 2, 118, baseFont, 96);
                drawTextWithUnderline(ctx, sub, startX + baseW + 4 + subW / 2, 154, subFont, 62);
            } else {
                const cleanText = text.replace(/<\/?u>/g, '');
                let fontSize = 65;
                if (cleanText.length === 1) {
                    fontSize = 125;
                } else if (cleanText.length === 2) {
                    fontSize = 100;
                } else if (cleanText.length === 3) {
                    fontSize = 80;
                }
                const font = 'bold ' + fontSize + 'px sans-serif';
                drawTextWithUnderline(ctx, text, 128, 128, font, fontSize);
            }
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function addDotToFaceDirect(cubie, localNormal, text, color, radius = 0.2) {
    const texture = createDotTexture(text, color);
    
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.05, 32);
    geometry.rotateX(Math.PI / 2); // Align circular face with Z axis
    geometry.rotateZ(Math.PI / 2); // 90° CCW rotation to make sideways text upright
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    
    const dotMesh = new THREE.Mesh(geometry, material);
    dotMesh.position.copy(localNormal).multiplyScalar(0.5 + 0.03);
    
    const worldNormal = localNormal.clone().applyQuaternion(cubie.quaternion).round();
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const qDesiredWorld = new THREE.Quaternion().setFromUnitVectors(defaultNormal, worldNormal);
    dotMesh.quaternion.copy(cubie.quaternion.clone().invert().multiply(qDesiredWorld));
    
    dotMesh.userData = {
        id: Date.now() + Math.random(),
        text: text,
        color: color,
        radius: radius,
        localNormal: localNormal.clone(),
        initialCubiePos: cubie.userData.initialPosition.clone()
    };
    
    cubie.add(dotMesh);
    dots.push({ mesh: dotMesh, cubie: cubie });
}

function addDotToFace(cubie, localNormal, customText, customColor) {
    const color = customColor || dotColors[dotColorIndex % dotColors.length];
    if (!customColor) dotColorIndex++;
    
    const text = customText !== undefined ? customText : `${dots.length + 1}`;
    addDotToFaceDirect(cubie, localNormal, text, color);
    
    renderDotList();
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

function updateDotTexture(dotObj) {
    dotObj.mesh.material.map = createDotTexture(dotObj.mesh.userData.text, dotObj.mesh.userData.color);
    dotObj.mesh.material.map.needsUpdate = true;
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

function removeDot(id) {
    const idx = dots.findIndex(d => d.mesh.userData.id === id);
    if (idx > -1) {
        const dotObj = dots[idx];
        dotObj.cubie.remove(dotObj.mesh);
        dots.splice(idx, 1);
        renderDotList();
        if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
    }
}

function clearAllDots() {
    dots.forEach(d => d.cubie.remove(d.mesh));
    dots = [];
    dotColorIndex = 0;
    renderDotList();
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

function renderDotList() {
    const list = document.getElementById('dot-list');
    if (!list) return;
    list.innerHTML = '';
    
    const countEl = document.getElementById('dot-count');
    if (countEl) countEl.innerText = dots.length;
    
    dots.forEach(dotObj => {
        const d = dotObj.mesh.userData;
        const item = document.createElement('div');
        item.className = 'dot-item';
        
        item.innerHTML = `
            <div class="dot-item-row" style="display: flex; align-items: center; gap: 8px;">
                <input type="color" class="dot-color-picker" value="${d.color}">
                <span class="dot-label-preview" style="min-width: 42px; font-weight: bold; font-size: 0.8rem; line-height: 1.1; text-align: center; color: var(--accent);">${formatDotTextHtml(d.text)}</span>
                <input type="text" class="dot-text-input" value="${(d.text || '').replace(/\n/g, ' / ')}" placeholder="Text" style="flex: 1;">
                <button class="dot-delete-btn" data-id="${d.id}">🗑️</button>
            </div>
        `;
        
        const colorPicker = item.querySelector('.dot-color-picker');
        colorPicker.addEventListener('input', (e) => {
            d.color = e.target.value;
            updateDotTexture(dotObj);
        });
        
        const textInput = item.querySelector('.dot-text-input');
        textInput.addEventListener('input', (e) => {
            if (e.target.value.includes(' / ')) {
                d.text = e.target.value.split(' / ').join('\n');
            } else {
                d.text = e.target.value;
            }
            const preview = item.querySelector('.dot-label-preview');
            if (preview) preview.innerHTML = formatDotTextHtml(d.text);
            updateDotTexture(dotObj);
        });
        
        item.querySelector('.dot-delete-btn').addEventListener('click', function() {
            removeDot(Number(this.getAttribute('data-id')));
        });
        
        list.appendChild(item);
    });
}

function initDrawerEvents() {
    const drawer = document.getElementById('dot-drawer');
    const openBtn = document.getElementById('btn-open-drawer');
    const closeBtn = document.getElementById('btn-close-drawer');
    const toggleModeBtn = document.getElementById('btn-toggle-dot-mode');
    const resetDotsBtn = document.getElementById('btn-reset-dots');
    const removeAllBtn = document.getElementById('btn-remove-all');
    
    if (openBtn && drawer) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const settingsMenu = document.getElementById('settings-menu');
            if (settingsMenu && settingsMenu.classList.contains('open')) {
                settingsMenu.classList.remove('open');
            }
            drawer.classList.toggle('open');
        });
    }
    if (closeBtn && drawer) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            drawer.classList.remove('open');
        });
    }
    if (toggleModeBtn) {
        toggleModeBtn.addEventListener('click', toggleDotMode);
    }
    if (resetDotsBtn) {
        resetDotsBtn.addEventListener('click', clearAllDots);
    }
    if (removeAllBtn) {
        removeAllBtn.addEventListener('click', clearAllDots);
    }
    
    // Close drawer when clicking outside
    window.addEventListener('pointerdown', (e) => {
        if (drawer && drawer.classList.contains('open')) {
            if (!drawer.contains(e.target) && e.target !== openBtn && !openBtn.contains(e.target)) {
                drawer.classList.remove('open');
            }
        }
    });

    const saveBtn = document.getElementById('btn-save-config');
    const configName = document.getElementById('config-name');
    if (saveBtn && configName) {
        saveBtn.addEventListener('click', () => {
            const name = configName.value.trim();
            if (!name) return alert('Enter a config name');
            saveDotConfig(name);
            configName.value = '';
        });
    }
    
    loadConfigList();
}

function initSettingsEvents() {
    const settingsBtn = document.getElementById('btn-settings');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettingsBtn = document.getElementById('btn-close-settings');
    const drawer = document.getElementById('dot-drawer');

    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (drawer && drawer.classList.contains('open')) {
                drawer.classList.remove('open');
            }
            settingsMenu.classList.toggle('open');
        });
    }

    if (closeSettingsBtn && settingsMenu) {
        closeSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.remove('open');
        });
    }

    window.addEventListener('pointerdown', (e) => {
        if (settingsMenu && settingsMenu.classList.contains('open')) {
            if (!settingsMenu.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
                settingsMenu.classList.remove('open');
            }
        }
    });
}

function initUI() {
    initDrawerEvents();
    initSettingsEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
} else {
    initUI();
}

window.saveDotConfig = function(name) {
    const configData = dots.map(d => ({
        color: d.mesh.userData.color,
        text: d.mesh.userData.text,
        radius: d.mesh.userData.radius || 0.2,
        initialCubiePos: d.mesh.userData.initialCubiePos.toArray(),
        localNormal: d.mesh.userData.localNormal.toArray()
    }));
    
    const configs = JSON.parse(localStorage.getItem('rubiks_dots_configs') || '{}');
    configs[name] = configData;
    localStorage.setItem('rubiks_dots_configs', JSON.stringify(configs));
    loadConfigList();
}

window.loadDotConfig = function(name) {
    const configs = JSON.parse(localStorage.getItem('rubiks_dots_configs') || '{}');
    const configData = configs[name];
    if (!configData) return;
    
    clearAllDots();
    
    configData.forEach(data => {
        const targetPos = new THREE.Vector3().fromArray(data.initialCubiePos);
        const cubie = cubies.find(c => c.userData.initialPosition.distanceTo(targetPos) < 0.1);
        if (!cubie) return;
        
        const localNormal = new THREE.Vector3().fromArray(data.localNormal);
        addDotToFaceDirect(cubie, localNormal, data.text, data.color, data.radius || 0.2);
    });
    
    renderDotList();
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

window.deleteConfig = function(name) {
    const configs = JSON.parse(localStorage.getItem('rubiks_dots_configs') || '{}');
    delete configs[name];
    localStorage.setItem('rubiks_dots_configs', JSON.stringify(configs));
    loadConfigList();
}

function loadConfigList() {
    const list = document.getElementById('saved-configs-list');
    if (!list) return;
    list.innerHTML = '';
    
    const configs = JSON.parse(localStorage.getItem('rubiks_dots_configs') || '{}');
    Object.keys(configs).forEach(name => {
        const item = document.createElement('div');
        item.className = 'saved-config-item';
        item.innerHTML = `
            <span>${name}</span>
            <div>
                <button class="btn-load" onclick="window.loadDotConfig('${name}')">Load</button>
                <button class="btn-del" onclick="window.deleteConfig('${name}')">X</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- Embedded Sequence Execution & Presets ---
const btnExecuteSeq = document.getElementById('btn-execute-sequence');
const seqInput = document.getElementById('sequence-input');

function parseSequence(inputStr) {
    if (!inputStr) return null;
    const clean = inputStr.trim();
    // Match tokens: face letter followed optionally by ' or 2
    const tokens = clean.match(/[UDFBRL][\'2]?/gi);
    if (!tokens || tokens.length === 0) return null;
    
    // Check if the input contains anything other than valid tokens and whitespace/commas
    const stripped = clean.replace(/[UDFBRL][\'2]?/gi, '').replace(/[\s,]+/g, '');
    if (stripped.length > 0) {
        return null; // invalid characters present!
    }
    return tokens.map(t => t.toUpperCase());
}

if (seqInput && btnExecuteSeq) {
    seqInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnExecuteSeq.click();
        }
    });
}

if (btnExecuteSeq) {
    btnExecuteSeq.addEventListener('click', async () => {
        const inputStr = (seqInput ? seqInput.value : '').trim();
        const errorEl = document.getElementById('sequence-error');
        
        if (!inputStr) return;
        
        const moves = parseSequence(inputStr);
        if (!moves) {
            if (errorEl) errorEl.style.display = 'block';
            return;
        }
        
        if (errorEl) errorEl.style.display = 'none';
        
        for (const move of moves) {
            await executeMove(move);
            await new Promise(r => setTimeout(r, 50)); // small pause
        }
    });
}

// Preset Buttons
document.querySelectorAll('.btn-preset-seq').forEach(btn => {
    btn.addEventListener('click', () => {
        const seq = btn.getAttribute('data-seq');
        if (seqInput) seqInput.value = seq;
        if (btnExecuteSeq) btnExecuteSeq.click();
    });
});


// --- 2D Unfolded Net System ---

function getCube2DState() {
    const state = {
        U: Array(2).fill(null).map(() => Array(2).fill(null)),
        L: Array(2).fill(null).map(() => Array(2).fill(null)),
        F: Array(2).fill(null).map(() => Array(2).fill(null)),
        R: Array(2).fill(null).map(() => Array(2).fill(null)),
        B: Array(2).fill(null).map(() => Array(2).fill(null)),
        D: Array(2).fill(null).map(() => Array(2).fill(null))
    };

    const localNormals = [
        new THREE.Vector3( 1,  0,  0), // 0: +x (R)
        new THREE.Vector3(-1,  0,  0), // 1: -x (L)
        new THREE.Vector3( 0,  1,  0), // 2: +y (U)
        new THREE.Vector3( 0, -1,  0), // 3: -y (D)
        new THREE.Vector3( 0,  0,  1), // 4: +z (F)
        new THREE.Vector3( 0,  0, -1)  // 5: -z (B)
    ];

    cubies.forEach(cubie => {
        const worldPos = cubie.getWorldPosition(new THREE.Vector3());
        const gx = Math.round(worldPos.x / offset);
        const gy = Math.round(worldPos.y / offset);
        const gz = Math.round(worldPos.z / offset);

        for (let i = 0; i < 6; i++) {
            const mat = cubie.material[i];
            if (!mat || mat === coreMaterial) continue;

            const worldNorm = localNormals[i].clone().applyQuaternion(cubie.quaternion).round();
            let faceKey = null;
            let row = null;
            let col = null;

            if (worldNorm.y === 1 && gy === 1) {
                faceKey = 'U';
                row = gz + 1;
                col = gx + 1;
            } else if (worldNorm.y === -1 && gy === -1) {
                faceKey = 'D';
                row = 1 - gz;
                col = gx + 1;
            } else if (worldNorm.z === 1 && gz === 1) {
                faceKey = 'F';
                row = 1 - gy;
                col = gx + 1;
            } else if (worldNorm.z === -1 && gz === -1) {
                faceKey = 'B';
                row = 1 - gy;
                col = 1 - gx;
            } else if (worldNorm.x === 1 && gx === 1) {
                faceKey = 'R';
                row = 1 - gy;
                col = 1 - gz;
            } else if (worldNorm.x === -1 && gx === -1) {
                faceKey = 'L';
                row = 1 - gy;
                col = gz + 1;
            }
            if (row === 2) row = 1;
            if (col === 2) col = 1;


            if (faceKey && row >= 0 && row < 2 && col >= 0 && col < 2) {
                let dotData = null;
                for (const d of dots) {
                    if (d.cubie === cubie && d.mesh.userData.localNormal.equals(localNormals[i])) {
                        dotData = {
                            text: d.mesh.userData.text,
                            color: d.mesh.userData.color
                        };
                        break;
                    }
                }

                const hexColor = '#' + mat.color.getHexString();
                state[faceKey][row][col] = {
                    color: hexColor,
                    dot: dotData,
                    cubie: cubie,
                    localNormal: localNormals[i].clone()
                };
            }
        }
    });

    return state;
}

function render2DNet() {
    const container = document.getElementById('net-container');
    if (!container) return;

    const state = getCube2DState();

    const layout = [
        [null, 'U', null, null],
        ['L', 'F', 'R', 'B'],
        [null, 'D', null, null]
    ];

    const faceLabels = {
        U: 'U',
        L: 'L',
        F: 'F',
        R: 'R',
        B: 'B',
        D: 'D'
    };

    container.innerHTML = '';

    layout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'net-row';

        row.forEach(faceKey => {
            if (!faceKey) {
                const placeholder = document.createElement('div');
                placeholder.className = 'net-face-placeholder';
                rowEl.appendChild(placeholder);
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'net-face-wrapper';

                const label = document.createElement('div');
                label.className = 'net-face-label';
                label.innerText = faceLabels[faceKey];
                wrapper.appendChild(label);

                const grid = document.createElement('div');
                grid.className = 'net-face-grid';

                const faceGridData = state[faceKey];
                for (let r = 0; r < 2; r++) {
                    for (let c = 0; c < 2; c++) {
                        const cellData = faceGridData[r][c];
                        const stickerEl = document.createElement('div');
                        stickerEl.className = 'net-sticker';
                        if (cellData) {
                            stickerEl.style.backgroundColor = cellData.color;
                            if (cellData.dot) {
                                const dotEl = document.createElement('div');
                                dotEl.className = 'net-dot';
                                dotEl.style.backgroundColor = cellData.dot.color;
                                dotEl.innerHTML = formatDotTextHtml(cellData.dot.text || '');
                                stickerEl.appendChild(dotEl);
                            }

                            // Interactive click: place dot in Dot Mode directly from 2D view!
                            stickerEl.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (dotMode && cellData.cubie && cellData.localNormal) {
                                    addDotToFace(cellData.cubie, cellData.localNormal);
                                }
                            });
                        } else {
                            stickerEl.style.backgroundColor = '#111';
                        }
                        grid.appendChild(stickerEl);
                    }
                }
                wrapper.appendChild(grid);
                rowEl.appendChild(wrapper);
            }
        });

        container.appendChild(rowEl);
    });
}

// 2D Net Toggle & Close listeners
const btnToggleNet = document.getElementById('btn-toggle-net');
const btnCloseNet = document.getElementById('btn-close-net');
const netPanel = document.getElementById('net-panel');

if (btnToggleNet && netPanel) {
    if (netPanel.classList.contains('open')) {
        btnToggleNet.style.display = 'none';
    }

    btnToggleNet.addEventListener('click', (e) => {
        e.stopPropagation();
        netPanel.classList.add('open');
        btnToggleNet.style.display = 'none';
        render2DNet();
    });
}

if (btnCloseNet && netPanel) {
    btnCloseNet.addEventListener('click', (e) => {
        e.stopPropagation();
        netPanel.classList.remove('open');
        if (btnToggleNet) btnToggleNet.style.display = 'block';
    });
}

// Initial 2D Net render
render2DNet();


// --- Full Cube Naming (GAP & Singmaster) ---

function applyFullCubeNaming(scheme) {
    if (animationInProgress) return;
    clearAllDots();
    
    const singmasterMap = {
        U: [
            ['U_{LB}', 'U_{BR}'],
            ['U_{FL}', 'U_{RF}']
        ],
        L: [
            ['L_{BU}', 'L_{UF}'],
            ['L_{DB}', 'L_{FD}']
        ],
        F: [
            ['F_{LU}', 'F_{UR}'],
            ['F_{DL}', 'F_{RD}']
        ],
        R: [
            ['R_{FU}', 'R_{UB}'],
            ['R_{DF}', 'R_{BD}']
        ],
        B: [
            ['B_{RU}', 'B_{UL}'],
            ['B_{DR}', 'B_{LD}']
        ],
        D: [
            ['D_{LF}', 'D_{FR}'],
            ['D_{BL}', 'D_{RB}']
        ]
    };
    
    const gapMap = {
        U: [
            ['1', '2'],
            ['3', '4']
        ],
        L: [
            ['5', '<u>6</u>'],
            ['7', '8']
        ],
        F: [
            ['9', '10'],
            ['11', '12']
        ],
        R: [
            ['13', '14'],
            ['15', '<u>16</u>']
        ],
        B: [
            ['17', '18'],
            ['19', '20']
        ],
        D: [
            ['21', '22'],
            ['23', '24']
        ]
    };

    const dotColor = '#ffffff';
    const dotRadius = scheme === 'both' ? 0.32 : 0.2;

    const state = getCube2DState();
    const faceKeys = ['U', 'L', 'F', 'R', 'B', 'D'];

    faceKeys.forEach(faceKey => {
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
                const cell = state[faceKey][r][c];
                if (cell && cell.cubie && cell.localNormal) {
                    let labelText = '';
                    if (scheme === 'gap') {
                        labelText = gapMap[faceKey][r][c];
                    } else if (scheme === 'singmaster') {
                        labelText = singmasterMap[faceKey][r][c];
                    } else if (scheme === 'both') {
                        const s = singmasterMap[faceKey][r][c];
                        const g = gapMap[faceKey][r][c];
                        labelText = `${s}\n${g}`;
                    }
                    addDotToFaceDirect(cell.cubie, cell.localNormal, labelText, dotColor, dotRadius);
                }
            }
        }
    });

    renderDotList();
    if (typeof render2DNet === 'function') render2DNet();
    if (typeof updateFloatingSides === 'function') updateFloatingSides();
}

const btnNamingGap = document.getElementById('btn-naming-gap');
const btnNamingSingmaster = document.getElementById('btn-naming-singmaster');
const btnNamingBoth = document.getElementById('btn-naming-both');

if (btnNamingGap) {
    btnNamingGap.addEventListener('click', () => {
        applyFullCubeNaming('gap');
    });
}

if (btnNamingSingmaster) {
    btnNamingSingmaster.addEventListener('click', () => {
        applyFullCubeNaming('singmaster');
    });
}

if (btnNamingBoth) {
    btnNamingBoth.addEventListener('click', () => {
        applyFullCubeNaming('both');
    });
}


// --- Floating Hidden Sides (Ruwix "Floating hidden sides" Style) ---
function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
    } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }
}

function initFloatingSides() {
    if (Object.keys(floatingMirrors).length === 6) {
        updateFloatingSides();
        return;
    }

    const geometry = new THREE.PlaneGeometry(MIRROR_SIZE, MIRROR_SIZE);

    for (const [faceKey, cfg] of Object.entries(mirrorConfigs)) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide, // Crucial: automatically culls mirrors facing away from camera!
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(cfg.pos);
        mesh.rotation.copy(cfg.rot);
        mesh.userData = { faceKey: faceKey };
        
        floatingSidesGroup.add(mesh);
        floatingMirrors[faceKey] = {
            mesh: mesh,
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            texture: texture,
            config: cfg
        };
    }

    updateFloatingSides();
}

function updateFloatingSides() {
    if (!floatingSidesEnabled) {
        floatingSidesGroup.visible = false;
        return;
    }
    floatingSidesGroup.visible = true;

    if (Object.keys(floatingMirrors).length < 6) {
        initFloatingSides();
        return;
    }

    if (typeof getCube2DState !== 'function') return;
    const state = getCube2DState();

    const stickerSize = 236;
    const margin = 16;
    const gap = 8;
    const positions = [
        [margin, margin],                                     // (0,0) Top-Left
        [margin + stickerSize + gap, margin],                 // (0,1) Top-Right
        [margin, margin + stickerSize + gap],                 // (1,0) Bottom-Left
        [margin + stickerSize + gap, margin + stickerSize + gap] // (1,1) Bottom-Right
    ];

    for (const [faceKey, mirror] of Object.entries(floatingMirrors)) {
        const ctx = mirror.ctx;
        ctx.clearRect(0, 0, 512, 512);

        // 1. Dark background panel / bevel frame
        ctx.fillStyle = '#0e0e14';
        ctx.beginPath();
        roundRect(ctx, 4, 4, 504, 504, 20);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();

        const faceData = state[faceKey];
        if (!faceData) continue;

        const quadMap = mirror.config.quadrants;

        // Draw 4 stickers
        for (let qr = 0; qr < 2; qr++) {
            for (let qc = 0; qc < 2; qc++) {
                const [sr, sc] = quadMap[qr][qc];
                const sticker = faceData[sr] ? faceData[sr][sc] : null;
                const posIdx = qr * 2 + qc;
                const [sx, sy] = positions[posIdx];

                const color = sticker ? sticker.color : (colors[faceKey] ? '#' + colors[faceKey].toString(16).padStart(6, '0') : '#222222');

                // Sticker rectangle
                ctx.fillStyle = color;
                ctx.beginPath();
                roundRect(ctx, sx, sy, stickerSize, stickerSize, 14);
                ctx.fill();

                // Sticker border
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 6;
                ctx.stroke();

                // Subtle gloss overlay
                const gloss = ctx.createLinearGradient(sx, sy, sx + stickerSize, sy + stickerSize);
                gloss.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
                gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
                gloss.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
                ctx.fillStyle = gloss;
                ctx.beginPath();
                roundRect(ctx, sx, sy, stickerSize, stickerSize, 14);
                ctx.fill();

                // Badge / Dot
                if (sticker && sticker.dot && sticker.dot.text) {
                    const cx = sx + stickerSize / 2;
                    const cy = sy + stickerSize / 2;
                    const badgeRadius = 60;

                    // Badge circle
                    ctx.fillStyle = sticker.dot.color || '#ffffff';
                    ctx.beginPath();
                    ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 5;
                    ctx.stroke();

                    const text = sticker.dot.text;
                    if (text.includes('\n')) {
                        const lines = text.split('\n');
                        const l1 = lines[0];
                        const l2 = lines[1];
                        ctx.fillStyle = '#000000';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.font = 'bold 28px sans-serif';
                        ctx.fillText(l1.replace(/<\/?u>/g, ''), cx, cy - 20);
                        drawTextWithUnderline(ctx, l2, cx, cy + 22, 'bold 32px sans-serif', 32);
                    } else {
                        const clean = text.replace(/<\/?u>/g, '');
                        const fontSize = clean.length === 1 ? 64 : (clean.length === 2 ? 52 : 40);
                        drawTextWithUnderline(ctx, text, cx, cy, 'bold ' + fontSize + 'px sans-serif', fontSize);
                    }
                }
            }
        }

        mirror.texture.needsUpdate = true;
    }
}

function toggleFloatingSides(forcedState) {
    if (typeof forcedState === 'boolean') {
        floatingSidesEnabled = forcedState;
    } else {
        floatingSidesEnabled = !floatingSidesEnabled;
    }
    
    const btn = document.getElementById('btn-toggle-floating');
    if (btn) {
        btn.classList.toggle('active', floatingSidesEnabled);
        btn.innerText = '🪞 Floating Sides: ' + (floatingSidesEnabled ? 'ON' : 'OFF');
    }
    
    if (floatingSidesEnabled && typeof resetCamera === 'function') {
        resetCamera(400);
    }

    updateFloatingSides();
}

const btnToggleFloating = document.getElementById('btn-toggle-floating');
if (btnToggleFloating) {
    btnToggleFloating.addEventListener('click', () => {
        toggleFloatingSides();
    });
}

// Initialize floating mirror sides
initFloatingSides();
