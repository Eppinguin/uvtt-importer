import OBR from "@owlbear-rodeo/sdk";
const ID = "com.eppinguin.uvtt-importer";

export function setupContextMenu() {
    OBR.contextMenu.create({
        id: `${ID}/context-menu`,
        icons: [
            {
                icon: "/Icon.svg",
                label: "Import Walls",
                filter: {
                    every: [{ key: "layer", value: "MAP" }],
                    permissions: ["FOG_CREATE"],
                },
            },
        ],
        embed: {
            url: "./contextMenu.html",
            height: 60
        }
    });
}


