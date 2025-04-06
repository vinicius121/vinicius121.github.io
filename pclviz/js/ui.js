// js/ui.js
import { formatVector3, debounce } from './utils.js';

// --- DOM Element References ---
let elements = {}; // Populated in initUI

// --- Callbacks to other modules ---
let callbacks = {
    onLoadFile: null,
    onResetView: null,
    onPointSizeChange: null,
    onNormalsToggle: null,
    onColorMapToggle: null,
    onThemeToggle: null, // Expects (isDark, themeColors)
};

/**
 * Initializes UI elements and sets up event listeners.
 * @param {object} cbs - Object containing callback functions { onLoadFile, onResetView, ... }.
 */
export function initUI(cbs) {
    if (!cbs) {
        console.error("UI Init Error: Callbacks object is missing.");
        return;
    }
    // Assign provided callbacks
    callbacks = { ...callbacks, ...cbs };

    // Get references to all required DOM elements - check IDs carefully!
    elements = {
        html: document.documentElement,
        body: document.body,
        fileInput: document.getElementById('file-input'),
        viewerContainer: document.getElementById('viewer-container'), // Needed for drag/drop boundary?
        dropZone: document.getElementById('drop-zone'),
        loadingIndicator: document.getElementById('loading-indicator'),
        uiPanel: document.getElementById('ui-panel'),
        pointCount: document.getElementById('point-count'),
        bboxMin: document.getElementById('bbox-min'),
        bboxMax: document.getElementById('bbox-max'),
        resetViewButton: document.getElementById('reset-view-button'),
        pointSizeSlider: document.getElementById('point-size-slider'),
        pointSizeValue: document.getElementById('point-size-value'),
        normalsToggle: document.getElementById('normals-toggle'),
        colorMapToggle: document.getElementById('color-map-toggle'),
        themeToggle: document.getElementById('theme-toggle'),
        // hoverInfo is managed by viewer, no direct UI interaction needed here
    };

    // Basic validation that elements exist
    for (const key in elements) {
        if (!elements[key]) {
           console.warn(`UI Element not found in DOM: ${key}`);
           // Consider disabling features if critical elements are missing
        }
    }

    // --- Event Listeners (Use optional chaining ?. for safety) ---
    elements.fileInput?.addEventListener('change', handleFileSelect, false);

    // Drag and Drop Listeners on body for broader coverage
    elements.body?.addEventListener('dragover', handleDragOver, false);
    elements.body?.addEventListener('dragleave', handleDragLeave, false);
    elements.body?.addEventListener('drop', handleDrop, false);

    elements.resetViewButton?.addEventListener('click', () => callbacks.onResetView?.(), false);

    // Debounce slider input for performance
    const debouncedPointSizeChange = debounce((value) => {
         callbacks.onPointSizeChange?.(parseFloat(value));
    }, 50); // 50ms debounce time

    elements.pointSizeSlider?.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        updatePointSizeDisplay(size); // Update display immediately
        debouncedPointSizeChange(size); // Trigger debounced callback
    });

    elements.normalsToggle?.addEventListener('change', (e) => callbacks.onNormalsToggle?.(e.target.checked), false);
    elements.colorMapToggle?.addEventListener('change', (e) => callbacks.onColorMapToggle?.(e.target.checked), false);

    // Theme Toggle: apply theme and then call callback with state & colors
    elements.themeToggle?.addEventListener('change', (e) => {
         const isDark = e.target.checked;
         const themeColors = applyTheme(isDark); // Apply changes and get colors
         callbacks.onThemeToggle?.(isDark, themeColors); // Notify main logic
    }, false);

    // Initial theme setup based on saved preference or OS setting
    setupInitialTheme();

    console.log("UI Initialized.");
}

// --- Event Handlers ---
function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file && callbacks.onLoadFile) {
        callbacks.onLoadFile(file); // Pass file to main controller
    }
    // Reset input value to allow loading the same file again if needed
    if (event.target) event.target.value = null;
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow drop
    event.stopPropagation();
    elements.body?.classList.add('dragover'); // Show visual feedback
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Prevent flickering when moving over child elements within the drop target
     if (!event.relatedTarget || !elements.body?.contains(event.relatedTarget)) {
         elements.body?.classList.remove('dragover');
     }
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.body?.classList.remove('dragover'); // Hide feedback
    const file = event.dataTransfer?.files?.[0]; // Get the dropped file
    if (file && callbacks.onLoadFile) {
        callbacks.onLoadFile(file); // Pass file to main controller
    }
}

// --- UI Update Functions ---
export function showLoading(isLoading) {
    elements.loadingIndicator && (elements.loadingIndicator.style.display = isLoading ? 'block' : 'none');
    if (elements.uiPanel) {
        elements.uiPanel.style.opacity = isLoading ? '0.7' : '1';
        elements.uiPanel.style.pointerEvents = isLoading ? 'none' : 'auto'; // Disable panel interaction during load
    }
}

export function updateInfoPanel(count, boundingBox) {
    elements.pointCount && (elements.pointCount.textContent = count?.toLocaleString() ?? 'N/A');
    // Use formatVector3 which handles null/undefined boundingBox
    elements.bboxMin && (elements.bboxMin.textContent = formatVector3(boundingBox?.min));
    elements.bboxMax && (elements.bboxMax.textContent = formatVector3(boundingBox?.max));
}

export function updatePointSizeDisplay(size) {
    elements.pointSizeValue && (elements.pointSizeValue.textContent = size.toFixed(1));
}

export function setNormalsToggleState(enabled, checked = false) {
    if (elements.normalsToggle) {
        elements.normalsToggle.disabled = !enabled;
        // Only set checked state if it's enabled
        elements.normalsToggle.checked = enabled ? checked : false;
    }
}

/**
 * Applies theme class and returns calculated theme colors.
 * @param {boolean} isDark - True for dark theme, false for light.
 * @returns {object} { backgroundColor, pointColor }
 */
export function applyTheme(isDark) {
    const themeColors = { backgroundColor: '#282c34', pointColor: '#ffffff' }; // Defaults
    if (!elements.html) return themeColors;

    if (isDark) {
        elements.html.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        elements.html.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    }
    // Read computed styles AFTER changing the class
    const computedStyle = getComputedStyle(elements.html);
    themeColors.backgroundColor = computedStyle.getPropertyValue('--bg-color').trim() || themeColors.backgroundColor;
    themeColors.pointColor = computedStyle.getPropertyValue('--point-color').trim() || themeColors.pointColor;

    console.log(`UI Theme applied: ${isDark ? 'Dark' : 'Light'}`, themeColors);
    return themeColors;
}

function setupInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default to dark unless proven otherwise
    let initialIsDark = true;
    if (savedTheme === 'light') {
        initialIsDark = false;
    } else if (savedTheme === 'dark') {
        initialIsDark = true;
    } else {
         // No saved theme, check OS preference
        initialIsDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
    }

    if (elements.themeToggle) {
        elements.themeToggle.checked = initialIsDark;
    }
    // Apply the theme visually, but the callback to viewer happens in main.js init
    applyTheme(initialIsDark);
}

/** Resets UI elements that depend on loaded data, keeping user preferences like theme/size. */
export function resetUIStateForNewFile() {
    setNormalsToggleState(false); // Disable and uncheck normals toggle
    // Optionally reset color map toggle:
    // if(elements.colorMapToggle) elements.colorMapToggle.checked = false;
    updateInfoPanel(0, null); // Clear info panel
}