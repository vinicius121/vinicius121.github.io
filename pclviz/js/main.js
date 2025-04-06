// js/main.js
import * as viewer from './viewer.js';
import * as ui from './ui.js';
import { parseFile } from './fileParser.js';

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', initApp); // Use a more descriptive name

function initApp() {
    console.log("Initializing Point Cloud App...");

    const viewerContainer = document.getElementById('viewer-container');
    const hoverInfoElement = document.getElementById('hover-info');

    // Critical element check
    if (!viewerContainer || !hoverInfoElement) {
        console.error("Fatal Error: Required HTML elements #viewer-container or #hover-info not found.");
        document.body.innerHTML = '<p style="color: red; padding: 20px;">Application Error: Cannot find required page elements. Initialization failed.</p>';
        return; // Stop execution
    }

    try {
        // 1. Initialize Viewer (sets up scene, camera, renderer)
        viewer.initViewer(viewerContainer, hoverInfoElement);

        // 2. Initialize UI (gets element refs, sets up listeners)
        // Pass necessary callbacks from viewer or main logic to UI module
        ui.initUI({
            onLoadFile: handleLoadFile, // Use handler defined in main.js
            onResetView: viewer.resetView,
            onPointSizeChange: viewer.setPointSize,
            onNormalsToggle: viewer.setNormalsVisibility,
            onColorMapToggle: viewer.setColorMapActive,
            // Theme toggle callback receives state and colors directly from ui.js
            onThemeToggle: (isDark, themeColors) => {
                viewer.setTheme(isDark, themeColors);
            },
        });

        // 3. Apply Initial Theme to Viewer
        // Get the initial theme state (determined by ui.js) and apply it to the viewer
        const initialIsDark = document.getElementById('theme-toggle')?.checked ?? true;
        const initialThemeColors = ui.applyTheme(initialIsDark); // Ensure class is set correctly
        viewer.setTheme(initialIsDark, initialThemeColors); // Tell viewer about the theme

        // 4. Start Rendering Loop
        viewer.startAnimationLoop();

        console.log("Point Cloud App Ready.");

    } catch (error) {
         console.error("Fatal Error during application initialization:", error);
         document.body.innerHTML = `<p style="color: red; padding: 20px;">Application Error: Initialization failed. Check console (F12) for details. <br>Message: ${error.message}</p>`;
    }
}

// --- File Loading Handler ---
async function handleLoadFile(file) {
    if (!file) return;
    console.log(`Loading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    ui.showLoading(true);
    ui.resetUIStateForNewFile(); // Clear previous data info

    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const fileContent = event.target.result;
            if (!fileContent) {
                throw new Error("File content is empty or could not be read.");
            }

            // Parse file (returns promise: { positions, normals, boundingBox, ... })
            const geometryData = await parseFile(fileContent, file.name);

             // Check if parsing resulted in any points
            if (!geometryData || geometryData.pointCount === 0) {
                 console.warn("File parsed, but no valid point data found.");
                 alert("Warning: No valid points found in the file.");
                 viewer.clearScene(); // Clear any previous geometry
                 ui.updateInfoPanel(0, null); // Update UI to show no points
                 ui.setNormalsToggleState(false);
            } else {
                 // Create point cloud in the viewer
                 viewer.createPointCloud(geometryData);
                 // Update UI with info
                 ui.updateInfoPanel(geometryData.pointCount, geometryData.boundingBox);
                 // Enable normals toggle only if normals exist in the data
                 ui.setNormalsToggleState(geometryData.hasNormals, false); // Default normals off
            }

        } catch (error) {
            console.error("Error processing file:", error);
            alert(`Error loading file. Check console (F12) for details.\nMessage: ${error.message}`);
            viewer.clearScene(); // Attempt to clean up viewer state
            ui.updateInfoPanel(0, null); // Reset UI info
            ui.setNormalsToggleState(false);
        } finally {
            ui.showLoading(false); // Always hide loading indicator
        }
    };

    reader.onerror = (event) => {
        console.error("File Reading Error:", event);
        alert("An error occurred while trying to read the file.");
        ui.showLoading(false);
    };

    // Determine how to read the file based on extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension === 'ply') {
        reader.readAsArrayBuffer(file); // PLYLoader needs ArrayBuffer
    } else if (fileExtension === 'txt') {
        reader.readAsText(file); // TXT parser needs text
    } else {
         alert(`Unsupported file extension: .${fileExtension}. Please use .ply or .txt.`);
         ui.showLoading(false); // Hide loading if format is wrong
    }
}