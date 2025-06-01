import OBR, {
    buildImageUpload,
    buildSceneUpload,
    type Item,
    type Vector2,
    buildPath,
    type Path,
    type PathCommand,
    Command
} from "@owlbear-rodeo/sdk";


export interface UniversalVTT {
    format: number;
    resolution: {
        map_origin: {
            x: number;
            y: number;
        },
        map_size: {
            x: number;
            y: number;
        },
        pixels_per_grid: number;
    };
    line_of_sight: Vector2[][];
    objects_line_of_sight?: Vector2[][];
    portals?: {
        position: {
            x: number;
            y: number;
        },
        bounds: Vector2[],
        rotation: number;
        closed: boolean;
        freestanding: boolean;
    }[];
    environment?: {
        baked_lighting: boolean;
        ambient_light: string;
    };
    lights?: {
        position: Vector2;
        range: number;
        intensity: number;
        color: string;
        shadows: boolean;
    }[];
    image: string;
}

// Helper function to determine image type from base64 data
function getImageTypeFromBase64(base64Data: string): 'image/png' | 'image/webp' {
    // Check the first few bytes of the base64 data
    const header = atob(base64Data.substring(0, 32));
    const bytes = new Uint8Array(header.length);
    for (let i = 0; i < header.length; i++) {
        bytes[i] = header.charCodeAt(i);
    }

    // Check for PNG signature
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return 'image/png';
    }
    // Check for WebP signature ('RIFF' + 4 bytes + 'WEBP')
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return 'image/webp';
    }

    // Default to PNG if we can't determine the type
    return 'image/png';
}

// Compression options for image optimization
export type CompressionMode = 'none' | 'standard' | 'high';

interface OptimizationOptions {
    compressionMode?: CompressionMode;
    maxSizeInMB?: number;
    maxMegapixels?: number;
}

// Helper function to optimize image data
async function optimizeImage(imageBlob: Blob, options: OptimizationOptions = {}): Promise<Blob> {
    const {
        compressionMode = 'standard',
        maxSizeInMB = 24, // Default to slightly under 25MB for safety
        maxMegapixels = 144 // Owlbear Rodeo's maximum supported megapixels
    } = options;

    // If no compression is requested and the image is under the maximum size, return it as is
    if (compressionMode === 'none' && imageBlob.size <= maxSizeInMB * 1024 * 1024) {
        return imageBlob;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            URL.revokeObjectURL(img.src);

            // Start with original dimensions
            let width = img.width;
            let height = img.height;

            // Check megapixels constraint
            const megapixels = (width * height) / (1024 * 1024);
            if (megapixels > maxMegapixels) {
                const scale = Math.sqrt(maxMegapixels / megapixels);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }

            // Browser maximum dimension check (typically 16384, but we use 8192 for compatibility)
            const MAX_DIMENSION = 8192;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                const scale = MAX_DIMENSION / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }

            canvas.width = width;
            canvas.height = height;

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Set initial quality based on compression mode
            const initialQuality = compressionMode === 'high' ? 0.7 : 0.9;

            // Try different quality settings until we get under maxSizeInMB
            const tryCompress = (currentQuality: number) => {
                // Use WebP for better compression unless no compression is requested
                const mimeType = compressionMode === 'none' ? imageBlob.type : 'image/webp';

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Could not create blob'));
                        return;
                    }

                    if (blob.size > maxSizeInMB * 1024 * 1024 && currentQuality > 0.1 && compressionMode !== 'none') {
                        // Try again with lower quality
                        tryCompress(currentQuality - 0.1);
                    } else {
                        resolve(blob);
                    }
                }, mimeType, compressionMode === 'none' ? undefined : currentQuality);
            };

            tryCompress(initialQuality);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(imageBlob);
    });
}

// Create a new scene with just the map image
export async function uploadSceneFromVTT(file: File, compressionMode: CompressionMode = 'standard'): Promise<void> {
    const content = await readFileAsText(file);
    const data: UniversalVTT = JSON.parse(content);

    if (!data.image) {
        throw new Error("No map image found in UVTT file");
    }

    // Convert base64 to Blob/File
    const imageData = atob(data.image);
    const arrayBuffer = new ArrayBuffer(imageData.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < imageData.length; i++) {
        uint8Array[i] = imageData.charCodeAt(i);
    }

    // Determine the image type from the base64 data
    const imageType = getImageTypeFromBase64(data.image);
    const imageBlob = new Blob([arrayBuffer], { type: imageType });

    // Configure optimization based on compression mode
    const optimizationOptions: OptimizationOptions = {
        compressionMode,
        maxSizeInMB: compressionMode === 'high' ? 50 : 24,
        maxMegapixels: 144
    };

    // Optimize the image
    const optimizedBlob = await optimizeImage(imageBlob, optimizationOptions);
    const fileExtension = compressionMode === 'none' ?
        (imageType === 'image/webp' ? 'webp' : 'png') :
        'webp';
    const imageFile = new File([optimizedBlob], `map.${fileExtension}`, { type: optimizedBlob.type });

    // Create and upload just the map as a scene
    const imageUpload = buildImageUpload(imageFile)
        .dpi(data.resolution.pixels_per_grid)
        .name("Imported Map")
        .build();

    const sceneUpload = buildSceneUpload()
        .name(file.name.replace(/\.[^/.]+$/, ""))
        .baseMap(imageUpload)
        .gridType("SQUARE")
        .gridScale(data.resolution.pixels_per_grid.toString())
        .build();

    await OBR.assets.uploadScenes([sceneUpload]);
}

const BATCH_SIZE = 50;

// Helper function to process items in batches
async function addItemsInBatches(items: Item[], batchSize: number): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await OBR.scene.items.addItems(batch);
    }
}

// Add items from VTT file to the current scene
export async function addItemsFromVTT(file: File, context: boolean): Promise<void> {
    if (!await OBR.scene.isReady()) {
        console.error("Scene is not ready. Please wait until the scene is fully loaded.");
        return;
    }

    // Read and parse the file
    const text = await readFileAsText(file);
    const fullData = JSON.parse(text);

    // Remove the image property to free up memory
    delete fullData.image;

    // Use the data without the image
    const data = fullData as VTTData;

    if (!data.resolution?.pixels_per_grid) {
        throw new Error("No resolution data found in UVTT file");
    }

    let position = { x: 0, y: 0 };
    if (context) {
        const selection = await OBR.player.getSelection();
        if (selection && selection.length > 0) {
            const items = await OBR.scene.items.getItems(selection);
            if (items.length > 0) {
                position = items[0].position;
            }
        }
    }

    // Create and add walls in batches
    const walls = await createWallItems(data, position);
    if (walls.length > 0) {
        await addItemsInBatches(walls, BATCH_SIZE);
    }

    // Create and add doors in batches
    if (data.portals && data.portals.length > 0) {
        const doors = await createDoorItems(data, position);
        if (doors.length > 0) {
            await addItemsInBatches(doors, BATCH_SIZE);
        }
    }

    await OBR.scene.fog.setFilled(true);
    await OBR.notification.show("Import complete!", "SUCCESS");
}

// Helper function to read file as text
function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

type VTTData = {
    line_of_sight: Vector2[][],
    objects_line_of_sight: Vector2[][],
    portals?: {
        position: { x: number, y: number },
        bounds: Vector2[],
        rotation: number,
        closed: boolean,
        freestanding: boolean
    }[],
    resolution: UniversalVTT['resolution']
};

// Create wall items for the scene
async function createWallItems(data: VTTData, position: Vector2 = { x: 0, y: 0 }): Promise<Item[]> {
    const walls = [...(data.line_of_sight || [])];
    if (data.objects_line_of_sight) {
        walls.push(...data.objects_line_of_sight);
    }

    if (walls.length === 0) {
        console.warn("No wall data found in the UVTT file");
        return [];
    }
    const dpi = await OBR.scene.grid.getDpi();

    const wallItems: Item[] = [];

    for (const wall of walls) {
        if (wall.length < 2) continue;

        // Scale the wall points based on DPI
        const points = wall.map(point => {
            // Handle potential nested coordinate objects
            const x = point.x;
            const y = point.y;
            return { x: x * dpi, y: y * dpi };
        });

        // Create the wall item using buildPath
        const commands: PathCommand[] = [
            [Command.MOVE, points[0].x, points[0].y],
            ...points.slice(1).map(p => [Command.LINE, p.x, p.y] as PathCommand)
        ];

        const wallItem = buildPath()
            .position(position)
            .strokeColor("#000000")
            .fillOpacity(0)
            .strokeOpacity(1)
            .strokeWidth(2)
            .commands(commands)
            .layer("FOG")
            .name("Wall")
            .visible(true)
            .build();

        wallItems.push(wallItem);
    }

    return wallItems;
}

// Create door items for the scene
async function createDoorItems(data: VTTData, position: Vector2 = { x: 0, y: 0 }): Promise<Path[]> {
    if (!data.portals || data.portals.length === 0) return [];

    const doorItems: Path[] = [];
    const dpi = await OBR.scene.grid.getDpi();

    for (const portal of data.portals) {
        if (portal.bounds.length < 2) continue;

        // Scale the portal points
        const points = portal.bounds.map(point => ({
            x: point.x * dpi,
            y: point.y * dpi
        }));

        // Create the door as a path
        const doorCommands: PathCommand[] = [
            [Command.MOVE, points[0].x, points[0].y],
            [Command.LINE, points[points.length - 1].x, points[points.length - 1].y]
        ];

        const doorItem = buildPath()
            .name("Door")
            .fillRule("nonzero")
            .position(position)
            .style({
                fillColor: "black",
                fillOpacity: 0,
                strokeColor: "#FF0000",
                strokeOpacity: 1,
                strokeWidth: 5,
                strokeDash: []
            })
            .commands(doorCommands)
            .layer("FOG")
            .metadata({
                "rodeo.owlbear.dynamic-fog/doors": [{
                    open: !portal.closed,
                    start: {
                        distance: 0,
                        index: 0
                    },
                    end: {
                        distance: Math.sqrt(Math.pow(points[points.length - 1].x - points[0].x, 2) + Math.pow(points[points.length - 1].y - points[0].y, 2)),
                        index: 0
                    }
                }]
            })
            .build();

        doorItems.push(doorItem);
    }

    return doorItems;
}

// Create light items for the scene
// async function createLightItems(data: UniversalVTT): Promise<Item[]> {
//     if (!data.lights || data.lights.length === 0) return [];

//     const gridDpi = await OBR.scene.grid.getDpi();
//     const lightItems: Item[] = [];

//     for (const light of data.lights) {
//         // Scale the light position and adjust for origin offset
//         const position = {
//             x: light.position.x,
//             y: light.position.y
//         };

//         // Scale the light range
//         const scaledRange = light.range * gridDpi;

//         // Create a light item with metadata
//         const lightItem: Item = {
//             type: "BASIC", // Basic item type
//             id: crypto.randomUUID(),
//             name: "Light",
//             createdUserId: OBR.player.id,
//             lastModified: new Date().toISOString(),
//             lastModifiedUserId: OBR.player.id,
//             locked: false,
//             visible: true,
//             layer: "CHARACTER", // Keep on character layer so it's visible
//             position: position,
//             rotation: 0,
//             scale: { x: 1, y: 1 },
//             zIndex: 0,
//             metadata: {
//                 [getPluginId("light")]: {
//                     attenuationRadius: scaledRange,
//                     sourceRadius: 25, // Default value
//                     falloff: 0.2, // Default value
//                     lightType: "PRIMARY"
//                 }
//             }
//         };

//         lightItems.push(lightItem);
//     }

//     return lightItems;
// }
