package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// FileNode represents a file or folder
// We use int64 for Size because standard OS calls return bytes as int64
type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "folder"
	Size     int64       `json:"size"`
	Children []*FileNode `json:"children,omitempty"`
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ReadDir scans a specific folder (Depth = 1)
func (a *App) ReadDir(path string) ([]FileNode, error) {
	var nodes []FileNode

	// 1. Read the directory
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		// 2. Initialize the node struct
		node := FileNode{
			Name: entry.Name(),
			Path: filepath.Join(path, entry.Name()),
			Type: "file",
		}

		// 3. Check if it's a folder or file
		if entry.IsDir() {
			node.Type = "folder"
		} else {
			// Get file size
			info, _ := entry.Info()
			node.Size = info.Size()
		}

		// 4. Add to list
		nodes = append(nodes, node)
	}

	return nodes, nil
}