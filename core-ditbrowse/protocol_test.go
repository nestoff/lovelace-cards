package main

import "testing"

func TestUniqueCameraNumbers(t *testing.T) {
	cam1 := 1
	cam2 := 2
	camDup := 1
	status := ditBrowseStatus{
		Tabs: []ditBrowseStatusTab{
			{CameraNumber: &cam1, Title: "A"},
			{CameraNumber: &cam2, Title: "B"},
			{CameraNumber: &camDup, Title: "A2"},
			{CameraNumber: nil, Title: "empty"},
		},
	}

	got := uniqueCameraNumbers(status)
	if len(got) != 2 || got[0] != 1 || got[1] != 2 {
		t.Fatalf("uniqueCameraNumbers = %v, want [1 2]", got)
	}
}

func TestSelectedTitle(t *testing.T) {
	tile := "tile-2"
	status := ditBrowseStatus{
		SelectedTileID: &tile,
		Tabs: []ditBrowseStatusTab{
			{TileID: "tile-1", Title: "Cam 1"},
			{TileID: "tile-2", Title: "Cam 2"},
		},
	}
	if selectedTitle(status) != "Cam 2" {
		t.Fatalf("selectedTitle = %q", selectedTitle(status))
	}
}
