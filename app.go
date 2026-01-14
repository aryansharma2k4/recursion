package main

import (
	"context"
	"os"
	"path/filepath"
)

type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` 
	Size     int64       `json:"size"`
	Children []*FileNode `json:"children,omitempty"`
}

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) ReadDir(path string) ([]FileNode, error) {
	var nodes []FileNode

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		node := FileNode{
			Name: entry.Name(),
			Path: filepath.Join(path, entry.Name()),
			Type: "file",
		}

		if entry.IsDir() {
			node.Type = "folder"
		} else {
			info, _ := entry.Info()
			node.Size = info.Size()
		}
		nodes = append(nodes, node)
	}
	return nodes, nil
}
