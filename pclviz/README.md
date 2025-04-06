# Point Cloud Visualizer App

A web-based application for visualizing 3D point cloud data from .ply and .txt files using Three.js.

## Features

*   Loads `.ply` (ASCII/Binary via THREE.PLYLoader) and `.txt` files.
*   Supports `.txt` files with 3 (x, y, z) or 6 (x, y, z, nx, ny, nz) columns (space or comma separated).
*   Real-time 3D interaction (zoom, pan, rotate) via mouse.
*   Displays point coordinates on hover.
*   Visualizes vertex normals (if available) as lines (toggleable).
*   Displays point count and bounding box dimensions.
*   Option to color points based on Z-height (gradient).
*   Adjustable point size.
*   Dark/Light theme support (syncs with OS preference initially, savable via LocalStorage).
*   File loading via button or Drag and Drop.
*   Responsive UI layout.

## Project Structure