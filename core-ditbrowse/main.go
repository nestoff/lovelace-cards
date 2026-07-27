package main

//go:generate sh injectGitVars.sh

import (
	"embed"

	log "github.com/s00500/env_logger"

	ib "github.com/SKAARHOJ/ibeam-corelib-go"
	pb "github.com/SKAARHOJ/ibeam-corelib-go/ibeam-core"
)

//go:embed model_images
var modelsFS embed.FS

// Populated by go:generate / injectGitVars.sh; safe defaults for local builds.
var (
	gitTag      = "0.1.0-dev"
	gitRevision = "local"
	gitBranch   = "main"
)

func main() {
	ib.ReloadHook()
	ib.SetImageFS(&modelsFS)

	branch := ""
	if gitBranch != "master" && gitBranch != "main" {
		branch = " branch: " + gitBranch
	}

	log.Infof("core-ditbrowse started, version %s (%s)%s", gitTag, gitRevision, branch)

	coreInfo := &pb.CoreInfo{
		CoreVersion:    gitTag,
		Description:    "Select DIT Browse cameras from SKAARHOJ Blue Pill / Reactor and use camera select as a routing trigger.",
		Label:          "DIT Browse",
		DeviceCategory: pb.DeviceCategory_ClassicCamera,
		Name:           "core-ditbrowse",
		MaxDevices:     0,
		ConnectionType: pb.ConnectionType_Network,
	}

	config := defaultConfig()
	manager, registry, toManager, fromManager := ib.CreateServerWithConfig(coreInfo, &config)

	registry.RegisterModel(&pb.ModelInfo{
		Id:          1,
		Name:        "DIT Browse Host",
		Description: "One DIT Browse app instance. Camera select and routing destination for Blue Pill.",
	})

	configureParameters(registry)

	go processDevices(registry, config, fromManager, toManager)

	manager.StartWithServer(":8517")
}
