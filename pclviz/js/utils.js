// js/utils.js

/**
 * Formats bounding box coordinates for display.
 * @param {THREE.Vector3} vec - The vector (min or max).
 * @returns {string} Formatted string "(x, y, z)".
 */
export function formatVector3(vec) {
    if (!vec) return 'N/A';
    // Check if x, y, z are valid numbers before formatting
    const x = typeof vec.x === 'number' ? vec.x.toFixed(2) : 'N/A';
    const y = typeof vec.y === 'number' ? vec.y.toFixed(2) : 'N/A';
    const z = typeof vec.z === 'number' ? vec.z.toFixed(2) : 'N/A';
    return `(${x}, ${y}, ${z})`;
}

/**
 * Formats point coordinates for hover display.
 * @param {THREE.Vector3 | {x: number, y: number, z: number}} point - The point coordinates.
 * @returns {string} Formatted string "x: val, y: val, z: val".
 */
export function formatPointCoords(point) {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || typeof point.z !== 'number') return '';
    return `x: ${point.x.toFixed(3)}, y: ${point.y.toFixed(3)}, z: ${point.z.toFixed(3)}`;
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The debounce time in milliseconds.
 * @param {boolean} immediate - Fire immediately on the leading edge.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}