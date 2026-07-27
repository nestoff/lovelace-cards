package main

import (
	skconfig "github.com/SKAARHOJ/ibeam-lib-config"
)

// CoreConfig is the Reactor-editable configuration for core-ditbrowse.
type CoreConfig struct {
	Devices []DeviceConfig `ibDispatch:"devices" ibDescription:"DIT Browse hosts to control from Blue Pill"`
}

// DeviceConfig describes one DIT Browse instance on the LAN.
type DeviceConfig struct {
	skconfig.BaseDeviceConfig
	IP   string `ibDispatch:"ip" ibValidate:"ip" ibOrder:"1" ibDescription:"IP address of the Mac running DIT Browse" ibRequired:"DIT Browse IP has not been set"`
	Port uint16 `ibDispatch:"port" ibValidate:"port" ibOrder:"2" ibDefault:"52780" ibDescription:"DIT Browse Local API port"`
	// MaxCameras sizes the selected-camera and routing parameter ranges.
	MaxCameras uint32 `ibOrder:"3" ibDefault:"32" ibDescription:"Highest camera number exposed to Reactor (1..N)"`
	// RoutingDestinations is the number of ME/Bus/Aux slots for GenericType_Routing.
	RoutingDestinations uint32 `ibOrder:"4" ibDefault:"8" ibDescription:"Number of routing destinations (ME/Bus/Aux) for Routing Triggers"`
}

func defaultConfig() CoreConfig {
	return CoreConfig{
		Devices: []DeviceConfig{
			{
				BaseDeviceConfig: skconfig.BaseDeviceConfig{
					DeviceID:    1,
					ModelID:     1,
					Description: "DIT Browse on DIT station",
					Active:      true,
				},
				IP:                  "127.0.0.1",
				Port:                52780,
				MaxCameras:          32,
				RoutingDestinations: 8,
			},
		},
	}
}
