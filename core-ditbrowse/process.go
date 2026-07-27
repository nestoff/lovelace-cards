package main

import (
	"fmt"
	"sort"
	"time"

	ib "github.com/SKAARHOJ/ibeam-corelib-go"
	pb "github.com/SKAARHOJ/ibeam-corelib-go/ibeam-core"
	b "github.com/SKAARHOJ/ibeam-corelib-go/paramhelpers"
	"github.com/jpillora/backoff"
	log "github.com/s00500/env_logger"
)

func processDevices(r *ib.IBeamParameterRegistry, config CoreConfig, fromManager <-chan *pb.Parameter, toManager chan<- *pb.Parameter) {
	stateChannels := make(map[uint32]chan *pb.Parameter)

	for _, deviceConfig := range config.Devices {
		if !deviceConfig.Active {
			continue
		}
		if _, err := r.RegisterDevice(deviceConfig.DeviceID, deviceConfig.ModelID); log.Should(err) {
			continue
		}
	}

	for _, deviceConfig := range config.Devices {
		if !deviceConfig.Active {
			continue
		}
		stateChan := make(chan *pb.Parameter, 32)
		stateChannels[deviceConfig.DeviceID] = stateChan
		go handleDevice(deviceConfig, stateChan, toManager, r)
	}

	for parameter := range fromManager {
		ch, ok := stateChannels[parameter.Id.Device]
		if !ok {
			continue
		}
		select {
		case ch <- parameter:
		default:
			log.Errorf("Device %d: parameter channel is full", parameter.Id.Device)
		}
	}
}

func handleDevice(config DeviceConfig, fromManager <-chan *pb.Parameter, toManager chan<- *pb.Parameter, r *ib.IBeamParameterRegistry) {
	did := config.DeviceID
	port := config.Port
	if port == 0 {
		port = 52780
	}

	reconnTimer := &backoff.Backoff{
		Min:    200 * time.Millisecond,
		Max:    5 * time.Second,
		Factor: 2,
		Jitter: true,
	}

	toManager <- b.Param(r.PID("connection"), did, b.Bool(false))

	client := newDitBrowseClient(config.IP, port)
	client.onStatus = func(status ditBrowseStatus) {
		publishStatus(r, did, status, toManager)
	}

	for {
		if err := client.connect(); err != nil {
			log.Errorf("DIT Browse %s:%d connect failed: %v", config.IP, port, err)
			toManager <- b.Param(r.PID("connection"), did, b.Bool(false))
			time.Sleep(reconnTimer.Duration())
			continue
		}

		reconnTimer.Reset()
		log.Infof("Connected to DIT Browse at %s:%d as device %d", config.IP, port, did)
		toManager <- b.Param(r.PID("connection"), did, b.Bool(true))

		disconnected := make(chan struct{})
		go client.readLoop(func() { close(disconnected) })

		if err := client.requestStatus(); err != nil {
			log.Warnf("Initial status request failed: %v", err)
		}

		running := true
		for running {
			select {
			case parameter := <-fromManager:
				handleParameter(client, parameter, r, did, toManager)
			case <-disconnected:
				running = false
			}
		}

		client.close()
		toManager <- b.Param(r.PID("connection"), did, b.Bool(false))
		retryIn := reconnTimer.Duration()
		log.Warnf("DIT Browse %s:%d disconnected; retry in %s", config.IP, port, retryIn)
		time.Sleep(retryIn)
	}
}

func handleParameter(client *ditBrowseClient, parameter *pb.Parameter, r *ib.IBeamParameterRegistry, did uint32, toManager chan<- *pb.Parameter) {
	name := r.ParameterNameByID(parameter.Id.Parameter)
	for _, val := range parameter.Value {
		switch name {
		case "device_test":
			if err := client.requestStatus(); err != nil {
				log.Error(err)
			}
		case "selected_camera":
			camera := int(val.GetInteger())
			if camera < 1 {
				publishSelected(r, did, client.getStatus(), toManager)
				continue
			}
			if err := client.focusCamera(camera); err != nil {
				log.Errorf("focusCamera(%d): %v", camera, err)
				continue
			}
			// Optimistic feedback so Routing Triggers / panel state feel snappy.
			toManager <- b.Param(r.PID("selected_camera"), did, b.Int(camera))
			toManager <- b.Param(r.PID("route_index"), did, b.Int(camera))
		case "camera_select":
			idx := int(val.GetCurrentOption())
			status := client.getStatus()
			cameras := uniqueCameraNumbers(status)
			sort.Ints(cameras)
			// Option 0 is "None"
			if idx <= 0 || idx > len(cameras) {
				continue
			}
			camera := cameras[idx-1]
			if err := client.focusCamera(camera); err != nil {
				log.Errorf("camera_select focusCamera(%d): %v", camera, err)
			} else {
				toManager <- b.Param(r.PID("selected_camera"), did, b.Int(camera))
				toManager <- b.Param(r.PID("route_index"), did, b.Int(camera))
			}
		case "expansion_enabled":
			want := val.GetBinary()
			status := client.getStatus()
			if status.ExpansionEnabled == want {
				toManager <- b.Param(r.PID("expansion_enabled"), did, b.Bool(want))
				continue
			}
			if err := client.toggleExpansion(); err != nil {
				log.Errorf("toggleExpansion: %v", err)
			}
		case "show_grid":
			if err := client.showGrid(); err != nil {
				log.Errorf("showGrid: %v", err)
			}
		case "toggle_expansion":
			if err := client.toggleExpansion(); err != nil {
				log.Errorf("toggleExpansion: %v", err)
			}
		case "route":
			// Dimension[0] is Destination (ME/Bus/Aux). Value is the camera/input number.
			camera := int(val.GetInteger())
			dest := uint32(0)
			if len(val.DimensionID) > 0 {
				dest = val.DimensionID[0]
			}
			log.Infof("Routing trigger dest=%d camera=%d", dest, camera)
			if camera < 1 {
				toManager <- b.Param(r.PID("route"), did, b.Int(0, dest))
				continue
			}
			if err := client.focusCamera(camera); err != nil {
				log.Errorf("route focusCamera(%d): %v", camera, err)
				continue
			}
			toManager <- b.Param(r.PID("route"), did, b.Int(camera, dest))
			toManager <- b.Param(r.PID("selected_camera"), did, b.Int(camera))
			toManager <- b.Param(r.PID("route_index"), did, b.Int(camera))
		case "connection", "focus_mode", "route_index", "camera_count", "selected_title":
			// feedback-only / system
		default:
			if name != "" {
				log.Debugf("Unhandled parameter %s", name)
			}
		}
	}
}

func publishStatus(r *ib.IBeamParameterRegistry, did uint32, status ditBrowseStatus, toManager chan<- *pb.Parameter) {
	publishSelected(r, did, status, toManager)
	toManager <- b.Param(r.PID("focus_mode"), did, b.Bool(status.FocusMode))
	toManager <- b.Param(r.PID("expansion_enabled"), did, b.Bool(status.ExpansionEnabled))
	toManager <- b.Param(r.PID("selected_title"), did, b.String(selectedTitle(status)))

	cameras := uniqueCameraNumbers(status)
	sort.Ints(cameras)
	toManager <- b.Param(r.PID("camera_count"), did, b.Int(len(cameras)))

	options := []*pb.ParameterOption{{Id: 0, Name: "None"}}
	for i, camera := range cameras {
		title := fmt.Sprintf("Camera %d", camera)
		for _, tab := range status.Tabs {
			if tab.CameraNumber != nil && *tab.CameraNumber == camera && tab.Title != "" {
				title = fmt.Sprintf("%d: %s", camera, tab.Title)
				break
			}
		}
		options = append(options, &pb.ParameterOption{
			Id:   uint32(i + 1),
			Name: title,
		})
	}
	toManager <- b.Param(r.PID("camera_select"), did, b.NewOptList(&pb.OptionList{Options: options}))

	selectedOpt := 0
	if status.SelectedCameraNumber != nil {
		for i, camera := range cameras {
			if camera == *status.SelectedCameraNumber {
				selectedOpt = i + 1
				break
			}
		}
	}
	toManager <- b.Param(r.PID("camera_select"), did, b.OptIndex(selectedOpt))
}

func publishSelected(r *ib.IBeamParameterRegistry, did uint32, status ditBrowseStatus, toManager chan<- *pb.Parameter) {
	selected := 0
	if status.SelectedCameraNumber != nil {
		selected = *status.SelectedCameraNumber
	}
	toManager <- b.Param(r.PID("selected_camera"), did, b.Int(selected))
	toManager <- b.Param(r.PID("route_index"), did, b.Int(selected))
}
