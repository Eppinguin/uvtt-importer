import React from 'react';
import { addItemsFromVTT } from '../importVTT';

const ContextMenuEmbed: React.FC = () => {
    const handleClick = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".dd2vtt,.uvtt";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.onchange = async (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                try {
                    await addItemsFromVTT(file);
                } catch (error) {
                    console.error("Error importing file:", error);
                }
                document.body.removeChild(fileInput);
            }
        };

        fileInput.click();
    };

    return (
        <div style={{ padding: '8px', display: 'flex', justifyContent: 'center' }}>
            <button
                onClick={handleClick}
                style={{
                    backgroundColor: '#4a4a4a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '14px'
                }}
            >
                Import UVTT/DD2VTT File
            </button>
        </div>
    );
};

export default ContextMenuEmbed;
