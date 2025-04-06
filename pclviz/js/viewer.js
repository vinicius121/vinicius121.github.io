// js/viewer.js
import { formatPointCoords } from './utils.js';

// Access THREE globally
const THREE = window.THREE;

// --- Module State ---
let scene, camera, renderer, controls;
let pointsMesh = null;     // Holds the THREE.Points object
let normalsMesh = null;    // Holds the THREE.LineSegments for normals
let initialCameraPosition = null; // Will be calculated based on data
let initialTarget = null;       // Will be calculated based on data
let raycaster, mouse;
let viewerContainer;      // Reference to the container div
let hoverInfoElement;     // Reference to the hover info div

let basePointColor = new THREE.Color('#ffffff'); // Default, updated by theme
let currentPointSize = 1.0;
let isColorMapActive = false;

const Z_COLOR_GRADIENT = [
    { stop: 0.0, color: new THREE.Color(0x0000ff) }, // Blue
    { stop: 0.5, color: new THREE.Color(0x00ff00) }, // Green
    { stop: 1.0, color: new THREE.Color(0xff0000) }  // Red
];

// --- Initialization ---
export function initViewer(container, hoverEl) {
    if (!THREE) {
        console.error("THREE.js not loaded before initViewer!");
        alert("Error: 3D Library failed to load.");
        return;
    }
    if (!THREE.OrbitControls) {
         console.error("THREE.OrbitControls not found. Check loading order/URL.");
         alert("Error: 3D Controls failed to load.");
         return;
    }

    viewerContainer = container;
    hoverInfoElement = hoverEl;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x282c34);

    // Camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    // Set a default initial position/target until data loads
    initialCameraPosition = new THREE.Vector3(0, 0, 10);
    initialTarget = new THREE.Vector3(0, 0, 0);
    camera.position.copy(initialCameraPosition);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.target.copy(initialTarget);
    controls.update();

    // Raycaster
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.1;
    mouse = new THREE.Vector2(-Infinity, -Infinity); // Init mouse way off-screen

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseleave', onMouseLeave, false);

    console.log("Viewer initialized.");
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate); // Request next frame first
    const controlsExist = controls?.update(); // Update controls if they exist
    updateHoverInfo(); // Check for hover regardless of controls update
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function startAnimationLoop() {
    if (renderer) {
        animate();
        console.log("Animation loop started.");
    } else {
        console.error("Cannot start animation loop: Renderer not ready.");
    }
}

// --- Scene Management ---
export function clearScene() {
    if (!scene) return;
    if (pointsMesh) {
        scene.remove(pointsMesh);
        pointsMesh.geometry?.dispose();
        pointsMesh.material?.dispose();
        pointsMesh = null; // Reset the variable
    }
    if (normalsMesh) {
        scene.remove(normalsMesh);
        normalsMesh.geometry?.dispose();
        normalsMesh.material?.dispose();
        normalsMesh = null; // Reset the variable
    }
    if (hoverInfoElement) hoverInfoElement.style.display = 'none';
    console.log("Scene cleared.");
}

export function createPointCloud(geometryData) {
    if (!scene || !THREE) {
        console.error("Cannot create point cloud: Scene or THREE not ready.");
        return;
    }
    clearScene(); // Clear previous before adding new

    if (!geometryData || !geometryData.positions || geometryData.positions.length === 0) {
        console.warn("Attempted to create point cloud with no position data.");
        return; // Don't proceed if no points
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.positions, 3));
    // Bounding box should be provided by parser
    geometry.boundingBox = geometryData.boundingBox || new THREE.Box3().setFromBufferAttribute(geometry.attributes.position); // Fallback bounds calculation

    // Create Points Mesh
    const material = new THREE.PointsMaterial({
        size: currentPointSize,
        vertexColors: true, // Always enable, coloring function handles logic
        sizeAttenuation: true
    });
    pointsMesh = new THREE.Points(geometry, material); // Assign to module variable
    scene.add(pointsMesh);

    // Create Normals Mesh (if applicable)
    if (geometryData.hasNormals && geometryData.normals) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.normals, 3));
        createNormalsVisualization(geometry); // Pass the created THREE geometry
        if (normalsMesh) normalsMesh.visible = false; // Initially hidden
    }

    // Apply Colors and Center View
    updatePointColors(); // Apply initial colors based on current settings
    centerView(geometry.boundingBox); // Center based on calculated bounding box

    console.log("Point cloud created with", geometryData.pointCount, "points.");
}

function createNormalsVisualization(geometry) {
    if (!scene || !THREE || !geometry?.attributes?.normal || !geometry?.boundingBox) return;

    const positions = geometry.attributes.position.array;
    const normals = geometry.attributes.normal.array;
    const lines = [];

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const avgDim = Math.max(0.01, (size.x + size.y + size.z) / 3); // Prevent zero scale
    const scale = avgDim * 0.03; // Adjust multiplier as needed

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i+1], z = positions[i+2];
        const nx = normals[i], ny = normals[i+1], nz = normals[i+2];
        // Basic check for valid normal vector components before using them
        if (isNaN(nx) || isNaN(ny) || isNaN(nz)) continue;
        lines.push(x, y, z); // Start
        lines.push(x + nx * scale, y + ny * scale, z + nz * scale); // End
    }

    if (lines.length === 0) return; // Don't create empty geometry

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green normals

    normalsMesh = new THREE.LineSegments(lineGeometry, lineMaterial); // Assign to module variable
    scene.add(normalsMesh);
}

// --- View Control ---
export function resetView() {
    if (!camera || !controls || !initialCameraPosition || !initialTarget) return;
    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialTarget);
    controls.update(); // Apply changes
}

function centerView(boundingBox) {
    if (!camera || !controls || !boundingBox || boundingBox.isEmpty()) {
        console.warn("Cannot center view: Invalid bounding box or missing components.");
        // Reset to absolute default if centering fails
        camera.position.set(0, 0, 10);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
    }

    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate distance to fit bounds in view
    const fov = camera.fov * (Math.PI / 180);
    let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    distance = Math.max(distance, 0.1); // Ensure minimum distance
    distance *= 1.5; // Add padding

    // Update the 'initial' position/target for reset functionality
    initialCameraPosition = center.clone().add(new THREE.Vector3(0, 0, distance)); // Look from +Z
    initialTarget = center.clone();

    // Apply immediately
    resetView(); // Use resetView to apply these new initial values
}

// --- Appearance Control ---
export function setPointSize(size) {
    currentPointSize = size;
    if (pointsMesh?.material) {
        pointsMesh.material.size = size;
    }
}

export function setNormalsVisibility(visible) {
    if (normalsMesh) {
        normalsMesh.visible = visible;
    }
}

export function setColorMapActive(isActive) {
    isColorMapActive = isActive;
    updatePointColors(); // Re-calculate colors
}

export function setTheme(isDark, themeColors) {
    if (scene && themeColors?.backgroundColor) {
        scene.background = new THREE.Color(themeColors.backgroundColor);
    }
    if (themeColors?.pointColor) {
       basePointColor = new THREE.Color(themeColors.pointColor);
    }
    updatePointColors(); // Re-apply colors based on new theme base color or gradient
}

function updatePointColors() {
    // Most important fix: Exit if pointsMesh hasn't been created yet.
    if (!pointsMesh || !THREE) {
        return;
    }
    if (!pointsMesh.geometry) {
        console.warn("updatePointColors: pointsMesh has no geometry.");
        return;
    }
    const geometry = pointsMesh.geometry;
    const positionAttribute = geometry.attributes.position;
    if (!positionAttribute) {
        console.warn("updatePointColors: Geometry missing 'position' attribute.");
        return;
    }

    const count = positionAttribute.count;
    const colors = new Float32Array(count * 3);
    const tempColor = new THREE.Color(); // Reuse color object

    if (isColorMapActive && geometry.boundingBox && !geometry.boundingBox.isEmpty()) {
        // Apply Z-Gradient Color
        const bbox = geometry.boundingBox;
        const zMin = bbox.min.z;
        const zMax = bbox.max.z;
        const zRange = zMax - zMin;

        for (let i = 0; i < count; i++) {
            const z = positionAttribute.getZ(i);
            let normalizedZ = (zRange > 0.0001) ? (z - zMin) / zRange : 0.5;
            normalizedZ = Math.max(0, Math.min(1, normalizedZ)); // Clamp

            // Find gradient stops (simple linear interpolation for this example)
            let c1 = Z_COLOR_GRADIENT[0];
            let c2 = Z_COLOR_GRADIENT[Z_COLOR_GRADIENT.length - 1];
            for (let j = 0; j < Z_COLOR_GRADIENT.length - 1; j++) {
                if (normalizedZ >= Z_COLOR_GRADIENT[j].stop && normalizedZ <= Z_COLOR_GRADIENT[j + 1].stop) {
                    c1 = Z_COLOR_GRADIENT[j];
                    c2 = Z_COLOR_GRADIENT[j + 1];
                    break;
                }
            }
            const segmentRange = c2.stop - c1.stop;
            const segmentValue = (segmentRange > 0) ? (normalizedZ - c1.stop) / segmentRange : 0;
            tempColor.lerpColors(c1.color, c2.color, segmentValue);

            colors[i * 3] = tempColor.r;
            colors[i * 3 + 1] = tempColor.g;
            colors[i * 3 + 2] = tempColor.b;
        }
    } else {
        // Apply Base Color
        for (let i = 0; i < count; i++) {
            colors[i * 3] = basePointColor.r;
            colors[i * 3 + 1] = basePointColor.g;
            colors[i * 3 + 2] = basePointColor.b;
        }
    }

    // Update Geometry Attribute
    if (!geometry.attributes.color) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    } else {
        geometry.attributes.color.array = colors; // Update existing array
        geometry.attributes.color.needsUpdate = true; // Flag for update
    }
    if (pointsMesh.material) { // Ensure material knows colors might have changed
       pointsMesh.material.needsUpdate = true;
    }
}

// --- Interaction ---
function onWindowResize() {
    if (!camera || !renderer || !viewerContainer) return;
    camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

function onMouseMove(event) {
    if (!renderer || !viewerContainer || !mouse) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // Prevent division by zero

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    mouse.clientX = event.clientX; // Store raw position for tooltip
    mouse.clientY = event.clientY;
}

function onMouseLeave() {
    if (!mouse) return;
    mouse.x = -Infinity; // Move mouse way off-screen logically
    mouse.y = -Infinity;
    if (hoverInfoElement) hoverInfoElement.style.display = 'none'; // Hide tooltip
}

function updateHoverInfo() {
    if (!pointsMesh || !raycaster || !camera || !hoverInfoElement || !mouse || mouse.x === -Infinity) {
         if (hoverInfoElement && hoverInfoElement.style.display !== 'none') {
            hoverInfoElement.style.display = 'none'; // Ensure hidden if conditions not met
         }
        return;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(pointsMesh);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const index = intersection.index;
        const geometry = pointsMesh.geometry;
        // Double-check position attribute exists before accessing
        if (!geometry?.attributes?.position) return;
        const positionAttribute = geometry.attributes.position;

        const point = {
             x: positionAttribute.getX(index),
             y: positionAttribute.getY(index),
             z: positionAttribute.getZ(index)
        };

        hoverInfoElement.textContent = formatPointCoords(point);
        hoverInfoElement.style.display = 'block';
        // Position tooltip, avoid going off-screen
        let left = mouse.clientX + 15;
        let top = mouse.clientY + 5;
        hoverInfoElement.style.left = `${left}px`;
        hoverInfoElement.style.top = `${top}px`;

         // Re-check bounds after setting initial position
         const tooltipRect = hoverInfoElement.getBoundingClientRect();
         const bodyRect = document.body.getBoundingClientRect();
         if (tooltipRect.right > bodyRect.right) {
            left = mouse.clientX - tooltipRect.width - 5;
         }
         if (tooltipRect.bottom > bodyRect.bottom) {
            top = mouse.clientY - tooltipRect.height - 5;
         }
         // Apply adjusted positions if needed
         hoverInfoElement.style.left = `${left}px`;
         hoverInfoElement.style.top = `${top}px`;

    } else {
        if (hoverInfoElement.style.display !== 'none') {
            hoverInfoElement.style.display = 'none';
        }
    }
}