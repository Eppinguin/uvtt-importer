# UVTT Importer for Owlbear Rodeo

A Virtual Tabletop (VTT) map importer extension for [Owlbear Rodeo](https://www.owlbear.rodeo/). It imports maps with walls and doors from:

- Universal VTT (.uvtt) files
- DD2VTT (.dd2vtt) files
- FoundryVTT scene JSON files

Designed for use with the [Dynamic Fog Extension](https://extensions.owlbear.rodeo/dynamic-fog) for basic wall and door functionality. For advanced features, consider the [Smoke & Spectre Extension](https://extensions.owlbear.rodeo/smoke).

## Features

- Import maps from UVTT/DD2VTT files
- Automatic wall and door creation from the imported data
- Smart image optimization with multiple compression modes
- Support for placing walls and doors relative to selected items
- Automatic DPI adjustment based on grid size

## Compression Modes

- **Standard**: Optimizes images to around 24MB with good quality
- **High**: Optimizes images to around 49MB with better quality
- **None**: No compression, uses original image format (may fail for very large files)

## Installing

The extension can be installed from https://uvtt-importer.pages.dev/manifest.json

## Development

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Start development server:
   ```
   pnpm dev
   ```
4. Build for production:
   ```
   pnpm build
   ```

## Credits

Built with React, TypeScript, and Vite for Owlbear Rodeo's extension platform.
