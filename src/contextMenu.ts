import OBR from "@owlbear-rodeo/sdk";
const ID = "com.eppinguin.uvtt-importer";

export function setupContextMenu() {
    OBR.contextMenu.create({
        id: `${ID}/context-menu`,
        icons: [
            {
                icon: "/img_2.png",
                label: "Import Walls",
                filter: {
                    every: [{ key: "layer", value: "MAP" }],
                },
            },
        ],
        embed: {
            url: "/importer.html",
            height: 60
        }
    });
}


