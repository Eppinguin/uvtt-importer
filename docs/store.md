---
title: UVTT Importer
description: Import Universal VTT files with walls and doors for Dynamic Fog
author: Eppinguin
image: https://raw.githubusercontent.com/Eppinguin/uvtt-importer/main/docs/header.webp
icon: https://uvtt-importer.pages.dev/Logo.webp
tags:
  - fog
manifest: https://uvtt-importer.pages.dev/manifest.json
learn-more: https://github.com/Eppinguin/uvtt-importer
---

# UVTT Importer

Import walls and doors from Universal VTT (.uvtt), DD2VTT (.dd2vtt), and FoundryVTT scene (.json) files directly for [Dynamic Fog](https://extensions.owlbear.rodeo/dynamic-fog). Perfect for bringing in maps from Dungeondraft, Dungeon Alchemist, and other VTT map creation tools.

This importer is designed to work with the Dynamic Fog Extension, providing an easy way to import walls and doors from your existing maps. For users seeking advanced features like dynamic lighting and custom fog backgrounds, check out the excellent [Smoke & Spectre Extension](https://extensions.owlbear.rodeo/smoke).

![add walls from menu](https://raw.githubusercontent.com/Eppinguin/uvtt-importer/main/docs/import-walls-from-menu.gif)

## Import a New Map with Walls and Doors

This will create a new scene, complete with the map image, walls, and doors from your VTT file.

1. Click the UVTT Importer icon in the top left corner.
2. Select your .uvtt or .dd2vtt file. (FoundryVTT .json files are not supported for new scene creation as they typically don't include a map image).
3. Choose your compression mode ([see below](#compression-modes)).
4. Click "Create New Scene". This can take a moment, depending on the image size and compression.
5. Once the process is complete, a new scene with your map and all its walls and doors will be available in your scenes list.

_Note: If your UVTT file does not contain a map image, you will not be able to use the "Create New Scene" option. In this case, you should first set up your scene with a map image manually, and then use the "Add Walls to Current Scene" feature._

## Add Walls and Doors to an Existing Scene or Map

This option is for adding walls and doors to a scene that already exists or to a specific map image you've already placed.

### Using the Importer Window:

1. Open the scene where you want to add walls/doors.
2. Click the UVTT Importer button in the toolbar.
3. Select your .uvtt, .dd2vtt, or .json file.
4. Click "Add Walls to Current Scene".
5. The walls and doors will be added to the current scene.

### Using the Map's Context Menu (for existing maps):

For existing maps, you can add Walls and Doors using the Map's Context Menu (right-click menu). This method will automatically position the Walls relative to the Map's current location and scale. This is particularly useful when you have already positioned or resized the Map in your Scene, or when working with multiple Maps in a single Scene.

1. Select the Map you want to Import Walls for.
2. Right Click it.
3. Click "Import UVTT/DD2VTT File".
4. Select a File.
5. Wait for Walls and Doors to be added to the Map.

![add walls from context menu](https://raw.githubusercontent.com/Eppinguin/uvtt-importer/main/docs/import-walls-from-context-menu.gif)

## Compression Modes

When importing maps, you can choose from three compression modes:

| Mode     | Description                                           |
| -------- | ----------------------------------------------------- |
| Standard | Best for most maps (optimizes to ~24MB)               |
| Bestling | Better quality for detailed maps (optimizes to ~49MB) |
| None     | Uses original image format                            |

The two compressions will first convert the image to WebP and then incrementally reduce the quality of the image to fit the constraints.

## Acknowledgments

The map featured in the header image and demonstration GIFs are from [mbround18's VTT Maps repository](https://github.com/mbround18/vtt-maps?tab=readme-ov-file) and is available under the [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) license.

## Support

For questions, bug reports, or feature requests, please visit the [GitHub repository issues page](https://github.com/Eppinguin/uvtt-importer/issues).
