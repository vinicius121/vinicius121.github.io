// js/fileParser.js

// Access THREE globally, assuming it's loaded in index.html
const THREE = window.THREE;

/**
 * Parses the content of a file based on its name.
 * @param {string|ArrayBuffer} data - The file content.
 * @param {string} fileName - The name of the file (to determine type).
 * @returns {Promise<object>} A promise resolving to { positions, normals, boundingBox, hasNormals, pointCount }
 * @throws {Error} If parsing fails or format is unsupported.
 */
export function parseFile(data, fileName) {
    return new Promise((resolve, reject) => {
        // Ensure THREE is loaded before attempting to parse
        if (!THREE) {
            return reject(new Error("THREE.js library not loaded before file parsing."));
        }

        const fileNameLower = fileName.toLowerCase();
        try {
            let result;
            if (fileNameLower.endsWith('.ply')) {
                result = parsePLY(data); // Needs THREE.PLYLoader
            } else if (fileNameLower.endsWith('.txt')) {
                result = parseTXT(data); // Needs THREE.Box3, THREE.Vector3
            } else {
                throw new Error(`Unsupported file format: ${fileNameLower.split('.').pop()}. Please use .ply or .txt`);
            }
            resolve(result);
        } catch (error) {
            console.error(`Parsing Error for ${fileName}:`, error);
            reject(new Error(`Failed to parse ${fileName}: ${error.message}`));
        }
    });
}

// --- Private Helper Functions ---

function parsePLY(data) {
    if (!(data instanceof ArrayBuffer)) {
        throw new Error("PLY parsing requires ArrayBuffer data.");
    }
    if (!THREE.PLYLoader) {
         throw new Error("THREE.PLYLoader is not available. Check script loading order in HTML.");
    }
    const loader = new THREE.PLYLoader();
    const geometry = loader.parse(data);

    if (!geometry || !geometry.attributes.position) {
        throw new Error("PLY file parsing failed or file is missing vertex positions.");
    }

    const positions = geometry.attributes.position.array;
    let normals = null;
    let hasNormals = false;

    if (geometry.attributes.normal) {
        normals = geometry.attributes.normal.array;
        hasNormals = true;
    }

    // Crucial: Compute bounding box AFTER parsing
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) {
        // Fallback if computeBoundingBox failed somehow (unlikely)
         console.warn("PLY geometry bounding box calculation failed. Creating manual bounds.");
         geometry.boundingBox = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    }


    return {
        positions: positions,
        normals: hasNormals ? normals : null,
        boundingBox: geometry.boundingBox,
        hasNormals: hasNormals,
        pointCount: positions.length / 3
    };
}

function parseTXT(data) {
    if (typeof data !== 'string') {
        throw new Error("TXT parsing requires string data.");
    }

    const lines = data.split('\n');
    const positions = [];
    const normalsData = [];
    let detectedColumns = 0;
    let hasNormals = false;
    const boundingBox = new THREE.Box3(); // Calculate during parsing

    for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip empty lines and common comment prefixes
        if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('//') || trimmedLine.startsWith('%')) {
            continue;
        }

        let parts = trimmedLine.split(/\s+/); // Try space first
        if (parts.length < 3) {
            parts = trimmedLine.split(','); // Try comma if space fails
        }

        // Attempt to parse numeric values, filter out non-numeric results
        const values = parts.map(val => parseFloat(val)).filter(v => !isNaN(v));

        // Skip lines that don't yield at least 3 valid numbers
        if (values.length < 3) continue;

        // Detect column structure on the first valid data line
        if (detectedColumns === 0) {
            if (values.length === 3) {
                detectedColumns = 3;
                hasNormals = false;
            } else if (values.length >= 6) { // Allow extra columns, only use first 6
                detectedColumns = 6;
                hasNormals = true;
            } else {
                // Should not happen due to values.length < 3 check, but good safeguard
                console.warn(`Skipping line with unexpected number of values (<3 or 4,5): "${trimmedLine}"`);
                continue;
            }
        }

        // Check consistency with detected structure
        if ((detectedColumns === 3 && values.length !== 3) || (detectedColumns === 6 && values.length < 6)) {
            console.warn(`Skipping line with inconsistent column count: "${trimmedLine}" (expected ${detectedColumns})`);
            continue;
        }

        // Extract data
        const x = values[0], y = values[1], z = values[2];
        positions.push(x, y, z);
        boundingBox.expandByPoint(new THREE.Vector3(x, y, z)); // Update bounding box

        if (hasNormals) {
            normalsData.push(values[3], values[4], values[5]);
        }
    }

    if (positions.length === 0) {
        // Return an empty structure if no valid points found
         console.warn("No valid point data found in the TXT file.");
        return {
            positions: new Float32Array(),
            normals: null,
            boundingBox: boundingBox.makeEmpty(), // Ensure it's empty
            hasNormals: false,
            pointCount: 0
        };
    }

    return {
        positions: new Float32Array(positions),
        normals: hasNormals ? new Float32Array(normalsData) : null,
        boundingBox: boundingBox,
        hasNormals: hasNormals,
        pointCount: positions.length / 3
    };
}