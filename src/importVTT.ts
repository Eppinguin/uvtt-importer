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
    const data: UniversalVTT = JSON.parse(content);

    if (!data.image) {
        throw new Error("No map image found in UVTT file");
    }

    OBR.notification.show("Importing map...", "INFO");

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
    const walls = await createWallItems(data, position, scale);
    if (walls.length > 0) {
        await addItemsInBatches(walls, BATCH_SIZE);
    }

    // Create and add doors in batches
    if (data.portals && data.portals.length > 0) {
        const doors = await createDoorItems(data, position, scale);
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
async function createWallItems(data: VTTData, position: Vector2 = { x: 0, y: 0 }, scale: Vector2 = { x: 1, y: 1 }): Promise<Item[]> {
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

        // Scale the wall points based on DPI and map scale
        const points = wall.map(point => {
            const x = point.x;
            const y = point.y;
            return {
                x: x * dpi * scale.x,
                y: y * dpi * scale.y
            };
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
async function createDoorItems(data: VTTData, position: Vector2 = { x: 0, y: 0 }, scale: Vector2 = { x: 1, y: 1 }): Promise<Path[]> {
    if (!data.portals || data.portals.length === 0) return [];

    const doorItems: Path[] = [];
    const dpi = await OBR.scene.grid.getDpi();

    for (const portal of data.portals) {
        if (portal.bounds.length < 2) continue;

        // Scale the portal points based on DPI and map scale
        const points = portal.bounds.map(point => ({
            x: point.x * dpi * scale.x,
            y: point.y * dpi * scale.y
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
