import OBR, {
    buildPath,
    type PathCommand,
    type Item,
    type Path,
    type Vector2,
    Command,
} from "@owlbear-rodeo/sdk";
import type { VTTMapData } from "./vttTypes";

// Create wall items for the scene
export async function createWallItems(data: VTTMapData, position: Vector2 = { x: 0, y: 0 }, scale: Vector2 = { x: 1, y: 1 }): Promise<Item[]> {
    const walls = [...(data.line_of_sight || [])];
    if (data.objects_line_of_sight) {
        walls.push(...data.objects_line_of_sight);
    }

    if (walls.length === 0) {
        console.warn("No wall data found in the file");
        return [];
    }
    const dpi = await OBR.scene.grid.getDpi();

    const wallItems = [];

    for (const wall of walls) {
        if (wall.length < 2) continue;

        // Scale the wall points based on DPI and map scale
        const points = wall.map(point => ({
            x: point.x * dpi * scale.x,
            y: point.y * dpi * scale.y
        }));

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
export async function createDoorItems(data: VTTMapData, position: Vector2 = { x: 0, y: 0 }, scale: Vector2 = { x: 1, y: 1 }): Promise<Path[]> {
    if (!data.portals || data.portals.length === 0) return [];

    const doorItems = [];
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
                        distance: Math.sqrt(
                            Math.pow(points[points.length - 1].x - points[0].x, 2) +
                            Math.pow(points[points.length - 1].y - points[0].y, 2)
                        ),
                        index: 0
                    }
                }]
            })
            .build();

        doorItems.push(doorItem);
    }

    return doorItems;
}
