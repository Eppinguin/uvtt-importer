import OBR, {
    buildImageUpload,
    buildSceneUpload,
    type Item,
    type Vector2
} from "@owlbear-rodeo/sdk";
import { type VTTMapData, type UniversalVTT, type FoundryVTTData } from "./vttTypes";
import { createWallItems, createDoorItems } from "./vttItems";

type VTTData = VTTMapData;

export function isFoundryVTTData(data: unknown): data is FoundryVTTData {
    const d = data as Partial<FoundryVTTData>;
    return !!d
        && typeof d.grid === 'number'
        && typeof d.gridDistance === 'number'
        && Array.isArray(d.walls)
        && d.walls.every((w: Partial<FoundryVTTData['walls'][0]>) =>
            Array.isArray(w.c) && w.c.length === 4);
}

function isUniversalVTTData(data: unknown): data is UniversalVTT {
    const d = data as Partial<UniversalVTT>;
    return !!d
        && typeof d.format === 'number'
        && !!d.resolution
        && (Array.isArray(d.line_of_sight) || Array.isArray(d.objects_line_of_sight));
}

// Helper function to detect if VTT data contains an image
export function hasMapImage(data: unknown): boolean {
    return !!(data && typeof data === 'object' && 'image' in data && (data as { image?: string }).image);
}

function convertFoundryToVTTData(foundryData: FoundryVTTData): VTTData {
    const walls: Vector2[][] = foundryData.walls
        .filter(wall => wall.door === 0) // Non-door walls
        .map(wall => [
            { x: wall.c[0] / foundryData.grid, y: wall.c[1] / foundryData.grid },
            { x: wall.c[2] / foundryData.grid, y: wall.c[3] / foundryData.grid }
        ]);

    const doors = foundryData.walls
        .filter(wall => wall.door === 1)
        .map(wall => ({
            position: { x: 0, y: 0 }, // Not used in OBR
            bounds: [
                { x: wall.c[0] / foundryData.grid, y: wall.c[1] / foundryData.grid },
                { x: wall.c[2] / foundryData.grid, y: wall.c[3] / foundryData.grid }
            ],
            rotation: 0,
            closed: true,
            freestanding: false
        }));

    return {
        line_of_sight: walls,
        objects_line_of_sight: [],
        portals: doors,
        resolution: {
            map_origin: { x: 0, y: 0 },
            map_size: { x: foundryData.width, y: foundryData.height },
            pixels_per_grid: foundryData.grid
        }
    };
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
        maxMegapixels = compressionMode === 'standard' ? 67 : 144
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

            canvas.width = width;
            canvas.height = height;

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Set initial quality based on compression mode - start with highest possible quality
            const initialQuality = 1;

            // Try different quality settings until we get under maxSizeInMB
            const tryCompress = (currentQuality: number) => {
                // Always use WebP for better compression unless no compression is requested
                const mimeType = compressionMode === 'none' ? imageBlob.type : 'image/webp';

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Could not create blob'));
                        return;
                    }

                    const currentSize = blob.size / (1024 * 1024);
                    if (blob.size > maxSizeInMB * 1024 * 1024 && currentQuality > 0.1 && compressionMode !== 'none') {
                        // Try again with lower quality, use smaller steps for more precise control
                        tryCompress(currentQuality - 0.05);
                    } else {
                        const finalSize = currentSize.toFixed(2);
                        const quality = (currentQuality * 100).toFixed(0);
                        OBR.notification.show(`Image compressed: ${quality}% quality (${finalSize}MB)`, "INFO");
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
    const parsedJson = JSON.parse(content);

    if (isFoundryVTTData(parsedJson)) {
        throw new Error("FoundryVTT files do not contain map images and cannot be used to create scenes. Use 'Add Walls to Current Scene' for Foundry files.");
    }

    if (!isUniversalVTTData(parsedJson)) {
        throw new Error("Unsupported VTT file format. Please use a valid UVTT file for creating new scenes.");
    }

    // Now we know parsedJson is UniversalVTT
    const data = parsedJson as UniversalVTT;

    if (!data.image) {
        throw new Error("No map image found in UVTT file. A map image is required to create a new scene.");
    }

    OBR.notification.show("Importing scene (map and items)...", "INFO");

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
        maxSizeInMB: compressionMode === 'high' ? 49 : 24, // Using 49MB and 24MB to leave some safety margin
        maxMegapixels: compressionMode === 'standard' ? 67 : 144 // Use 67MP for standard, 144MP for high compression
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

    // Prepare items to add to the scene
    const vttMapDataSource = data as VTTMapData; // data is UniversalVTT which is compatible
    const defaultPosition: Vector2 = { x: 0, y: 0 };
    const defaultScale: Vector2 = { x: 1, y: 1 };

    const wallItems = await createWallItems(vttMapDataSource, defaultPosition, defaultScale);
    let doorItems: Item[] = [];
    if (vttMapDataSource.portals && vttMapDataSource.portals.length > 0) {
        doorItems = await createDoorItems(vttMapDataSource, defaultPosition, defaultScale);
    }
    const allItems = [...wallItems, ...doorItems];

    let sceneBuilder = buildSceneUpload()
        .name(file.name.replace(/\.[^/.]+$/, ""))
        .baseMap(imageUpload)
        .gridType("SQUARE");

    if (allItems.length > 0) {
        sceneBuilder = sceneBuilder.items(allItems);
    }

    const sceneToUpload = sceneBuilder.build();

    await OBR.assets.uploadScenes([sceneToUpload]);
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
    const fileData = JSON.parse(text);

    let processedData: VTTMapData;
    // let fileName = file.name;

    try {
        // Detect file type and convert if necessary
        if (isFoundryVTTData(fileData)) {
            console.log("Detected FoundryVTT format");
            processedData = convertFoundryToVTTData(fileData);
            // fileName = fileData.name || fileName;
        } else if (isUniversalVTTData(fileData)) {
            console.log("Detected UniversalVTT format");
            // Remove the image property to free up memory for UVTT files
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { image: _, ...vttData } = fileData;
            processedData = vttData as VTTMapData;
        } else {
            throw new Error("Unsupported file format. Please use a valid UVTT, DD2VTT, or FoundryVTT JSON file.");
        }
    } catch (error) {
        console.error("Error processing file:", error);
        throw new Error("Failed to process the file. Make sure it's a valid UVTT, DD2VTT, or FoundryVTT JSON file.");
    }

    if (!processedData.resolution?.pixels_per_grid) {
        throw new Error("No valid grid resolution data found in the file");
    }

    let position = { x: 0, y: 0 };
    let scale = { x: 1, y: 1 };
    if (context) {
        const selection = await OBR.player.getSelection();
        if (selection && selection.length > 0) {
            const items = await OBR.scene.items.getItems(selection);
            if (items.length > 0) {
                const selectedItem = items[0];
                position = selectedItem.position;
                // Get scale from the selected item if it exists
                if ('scale' in selectedItem) {
                    scale = selectedItem.scale;
                }
            }
        }
    }

    // Create and add walls in batches
    const walls = await createWallItems(processedData, position, scale);
    if (walls.length > 0) {
        await addItemsInBatches(walls, BATCH_SIZE);
    }

    // Create and add doors in batches
    if (processedData.portals && processedData.portals.length > 0) {
        const doors = await createDoorItems(processedData, position, scale);
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
