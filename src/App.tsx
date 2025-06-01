import { useState, useRef, useEffect } from 'react'
import './App.css'
import { uploadSceneFromVTT, addItemsFromVTT } from './importVTT'
import type { CompressionMode } from './importVTT'
import OBR, {type Theme} from "@owlbear-rodeo/sdk";
import * as React from "react";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('standard')
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState<Theme | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Get initial theme
    OBR.theme.getTheme().then(setTheme);
    // Subscribe to theme changes
    return OBR.theme.onChange(setTheme);
  }, []);

  // Set theme CSS variables when theme changes
  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty('--primary-main', theme.primary.main);
    root.style.setProperty('--primary-light', theme.primary.light);
    root.style.setProperty('--primary-dark', theme.primary.dark);
    root.style.setProperty('--primary-contrast', theme.primary.contrastText);
    root.style.setProperty('--secondary-main', theme.secondary.main);
    root.style.setProperty('--secondary-light', theme.secondary.light);
    root.style.setProperty('--secondary-dark', theme.secondary.dark);
    root.style.setProperty('--secondary-contrast', theme.secondary.contrastText);
    root.style.setProperty('--background-default', theme.background.default);
    root.style.setProperty('--background-paper', theme.background.paper);

    // Convert background-paper to RGB for transparency
    const paperColor = theme.background.paper;
    const rgb = paperColor.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)?.[1];
    if (rgb) {
      const r = parseInt(rgb.length === 3 ? rgb[0].repeat(2) : rgb.slice(0, 2), 16);
      const g = parseInt(rgb.length === 3 ? rgb[1].repeat(2) : rgb.slice(2, 4), 16);
      const b = parseInt(rgb.length === 3 ? rgb[2].repeat(2) : rgb.slice(4, 6), 16);
      root.style.setProperty('--background-paper-rgb', `${r}, ${g}, ${b}`);
    }

    root.style.setProperty('--text-primary', theme.text.primary);
    root.style.setProperty('--text-secondary', theme.text.secondary);
    root.style.setProperty('--text-disabled', theme.text.disabled);
  }, [theme]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.name.toLowerCase().endsWith('.uvtt') || file.name.toLowerCase().endsWith('.dd2vtt'))) {
      setSelectedFile(file)
    } else {
        await OBR.notification.show('Please select a valid .uvtt or .dd2vtt file', "WARNING")
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFile(null)
    }
  }

  const handleCreateNewScene = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    try {
      await uploadSceneFromVTT(selectedFile, compressionMode)
    } catch (error) {
      console.error(error)
        await OBR.notification.show('Error creating scene: ' + (error instanceof Error ? error.message : 'Unknown error'), "ERROR")
    }
    setIsLoading(false)
  }

  const handleAddToCurrentScene = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    try {
      await addItemsFromVTT(selectedFile, false)
    } catch (error) {
      console.error(error)
        await OBR.notification.show('Error adding to scene: ' + (error instanceof Error ? error.message : 'Unknown error'), "ERROR")
    }
    setIsLoading(false)
  }

  return (
    <div className="container">
      <h1>UVTT Importer</h1>

      <div className="file-upload">
        <input
          type="file"
          accept=".uvtt, .dd2vtt"
          onChange={handleFileSelect}
          ref={fileInputRef}
          className="file-input"
        />
        {selectedFile && (
          <p className="selected-file">Selected: {selectedFile.name}</p>
        )}
      </div>

      <div className="options">
        <h2>Import Options</h2>
        <div className="compression-options">
          <label>Compression Mode:</label>
          <select
            value={compressionMode}
            onChange={(e) => setCompressionMode(e.target.value as CompressionMode)}
            disabled={isLoading}
          >
            <option value="none">None</option>
            <option value="standard">Standard</option>
            <option value="high">Bestling</option>
          </select>
          <div className="compression-info">
            {compressionMode === 'none' && <p>Uploads the image as is, without any compression.</p>}
            {compressionMode === 'standard' && <p>Converts to WebP format and optimizes to keep the file under 25MB.</p>}
            {compressionMode === 'high' && <p>Converts to WebP format and optimizes to keep the file under 50MB.</p>}
          </div>
        </div>
      </div>

      <div className="actions">
        <button
          onClick={handleCreateNewScene}
          disabled={!selectedFile || isLoading}
          className="primary-button"
        >
          {isLoading ? 'Creating...' : 'Create New Scene'}
        </button>

        <button
          onClick={handleAddToCurrentScene}
          disabled={!selectedFile || isLoading}
          className="secondary-button"
        >
          {isLoading ? 'Adding...' : 'Add Walls to Current Scene'}
        </button>
      </div>
    </div>
  )
}

export default App
