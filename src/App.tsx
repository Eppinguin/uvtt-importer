import { useState, useRef, useEffect } from "react";
import "./App.css";
import {
  uploadSceneFromVTT,
  addItemsFromVTT,
  type CompressionMode,
} from "./importVTT";
import { isFoundryVTTData, hasMapImage } from "./importVTT";
import OBR, { type Theme } from "@owlbear-rodeo/sdk";
import * as React from "react";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFoundryFormat, setIsFoundryFormat] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [compressionMode, setCompressionMode] =
    useState<CompressionMode>("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isGM, setIsGM] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if player is GM
    if (OBR.isReady) {
      OBR.player.getRole().then((role) => {
        setIsGM(role === "GM");
      });

      // Get initial theme
      OBR.theme.getTheme().then(setTheme);
      // Subscribe to theme changes
      return OBR.theme.onChange(setTheme);
    }
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (OBR.isReady) {
        if (containerRef.current) {
          const height = containerRef.current.offsetHeight;
          OBR.action.setHeight(height);
        }
      }
    };

    // Initial height update
    updateHeight();

    // Update height when content changes
    const observer = new ResizeObserver(updateHeight);
    const currentContainer = containerRef.current;

    if (currentContainer) {
      observer.observe(currentContainer);
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
      observer.disconnect();
    };
  }, [selectedFile, hasImage, isLoading, compressionMode]); // Update on all state changes that affect layout

  // Set theme CSS variables when theme changes
  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty("--primary-main", theme.primary.main);
    root.style.setProperty("--primary-light", theme.primary.light);
    root.style.setProperty("--primary-dark", theme.primary.dark);
    root.style.setProperty("--primary-contrast", theme.primary.contrastText);
    root.style.setProperty("--secondary-main", theme.secondary.main);
    root.style.setProperty("--secondary-light", theme.secondary.light);
    root.style.setProperty("--secondary-dark", theme.secondary.dark);
    root.style.setProperty(
      "--secondary-contrast",
      theme.secondary.contrastText
    );
    root.style.setProperty("--background-default", theme.background.default);
    root.style.setProperty("--background-paper", theme.background.paper);

    // Convert background-paper to RGB for transparency
    const paperColor = theme.background.paper;
    const rgb = paperColor.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)?.[1];
    if (rgb) {
      const r = parseInt(
        rgb.length === 3 ? rgb[0].repeat(2) : rgb.slice(0, 2),
        16
      );
      const g = parseInt(
        rgb.length === 3 ? rgb[1].repeat(2) : rgb.slice(2, 4),
        16
      );
      const b = parseInt(
        rgb.length === 3 ? rgb[2].repeat(2) : rgb.slice(4, 6),
        16
      );
      root.style.setProperty("--background-paper-rgb", `${r}, ${g}, ${b}`);
    }

    root.style.setProperty("--text-primary", theme.text.primary);
    root.style.setProperty("--text-secondary", theme.text.secondary);
    root.style.setProperty("--text-disabled", theme.text.disabled);
  }, [theme]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (
      file &&
      (file.name.toLowerCase().endsWith(".uvtt") ||
        file.name.toLowerCase().endsWith(".dd2vtt") ||
        file.name.toLowerCase().endsWith(".json"))
    ) {
      try {
        const content = await file.text();
        const fileData = JSON.parse(content);
        const foundryFormat = isFoundryVTTData(fileData);
        const imageExists = hasMapImage(fileData);
        setIsFoundryFormat(foundryFormat);
        setHasImage(imageExists);
        setSelectedFile(file);
      } catch (error) {
        console.error("Error parsing file:", error);
        await OBR.notification.show(
          "Error reading file. Make sure it's a valid VTT file.",
          "WARNING"
        );
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedFile(null);
        setIsFoundryFormat(false);
        setHasImage(false);
      }
    } else {
      await OBR.notification.show(
        "Please select a valid .uvtt, .dd2vtt, or .json file",
        "WARNING"
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSelectedFile(null);
      setIsFoundryFormat(false);
      setHasImage(false);
    }
  };

  const handleCreateNewScene = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      await uploadSceneFromVTT(selectedFile, compressionMode);
    } catch (error: unknown) {
      console.error(error);
      let errorMessage = "Unknown error";

      if (typeof error === "object" && error !== null) {
        const err = error as { error?: { message: string }; message?: string };
        errorMessage = err.error?.message || err.message || errorMessage;
      }

      console.error("Error creating scene:", errorMessage);
      await OBR.notification.show(
        `Error creating scene: ${errorMessage}`,
        "ERROR"
      );
    }
    setIsLoading(false);
  };

  const handleAddToCurrentScene = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      await addItemsFromVTT(selectedFile, false);
    } catch (error: unknown) {
      console.error(error);
      let errorMessage = "Unknown error";

      if (typeof error === "object" && error !== null) {
        const err = error as { error?: { message: string }; message?: string };
        errorMessage = err.error?.message || err.message || errorMessage;
      }

      await OBR.notification.show(
        `Error adding to scene: ${errorMessage}`,
        "ERROR"
      );
    }
    setIsLoading(false);
  };

  return (
    <div className="container" ref={containerRef}>
      {!isGM ? (
        <p>This extension requires GM privileges to use.</p>
      ) : (
        <>
          <h1>UVTT Importer</h1>

          <div className="file-upload">
            <input
              type="file"
              accept=".uvtt, .dd2vtt, .json"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="file-input"
            />
            {selectedFile && (
              <div>
                <p className="selected-file">Selected: {selectedFile.name}</p>
                <p className="file-info">
                  {(isFoundryFormat || !hasImage) &&
                    "No map image found(walls and doors only)"}
                </p>
              </div>
            )}
          </div>
          {hasImage && (
            <div className="options">
              <h2>Import Options</h2>
              <div className="compression-options">
                <label>Compression Mode:</label>
                <select
                  value={compressionMode}
                  onChange={(e) =>
                    setCompressionMode(e.target.value as CompressionMode)
                  }
                  disabled={isLoading}>
                  <option value="none">None</option>
                  <option value="standard">Standard</option>
                  <option value="high">Bestling</option>
                </select>
                <div className="compression-info">
                  {compressionMode === "none" && (
                    <p>Uploads the image as is, without any compression.</p>
                  )}
                  {compressionMode === "standard" && (
                    <p>
                      Converts to WebP format and optimizes to keep the file
                      under 25MB.
                    </p>
                  )}
                  {compressionMode === "high" && (
                    <p>
                      Converts to WebP format and optimizes to keep the file
                      under 50MB.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="actions">
            <button
              onClick={handleCreateNewScene}
              disabled={
                !selectedFile || isLoading || isFoundryFormat || !hasImage
              }
              className="primary-button">
              {isLoading
                ? "Creating..."
                : isFoundryFormat
                ? "Scene Creation Not Available (Foundry File)"
                : !hasImage
                ? "Scene Creation Not Available (No Image)"
                : "Create New Scene"}
            </button>

            <button
              onClick={handleAddToCurrentScene}
              disabled={!selectedFile || isLoading}
              className="secondary-button">
              {isLoading ? "Adding..." : "Add Walls to Current Scene"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
