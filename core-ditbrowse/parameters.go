package main

import (
	ib "github.com/SKAARHOJ/ibeam-corelib-go"
	pb "github.com/SKAARHOJ/ibeam-corelib-go/ibeam-core"
	b "github.com/SKAARHOJ/ibeam-corelib-go/paramhelpers"
)

func configureParameters(r *ib.IBeamParameterRegistry) {
	// Parameter 1 (connection) is registered automatically.

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 2},
		Path:          "system",
		Name:          "device_test",
		Label:         "Identify",
		ShortLabel:    "Test",
		Description:   "Requests a fresh status snapshot from DIT Browse.",
		GenericType:   pb.GenericType_TestTrigger,
		ControlStyle:  pb.ControlStyle_Oneshot,
		FeedbackStyle: pb.FeedbackStyle_NoFeedback,
		ValueType:     pb.ValueType_NoValue,
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:             &pb.ModelParameterID{Parameter: 3},
		Path:           "camera",
		Name:           "selected_camera",
		Label:          "Selected Camera",
		ShortLabel:     "Cam",
		Description:    "Focuses the numbered camera in DIT Browse. Use this from Camera Select or Virtual Triggers. Camera numbers match DIT Browse integer camera numbers.",
		ControlStyle:   pb.ControlStyle_Normal,
		FeedbackStyle:  pb.FeedbackStyle_NormalFeedback,
		ValueType:      pb.ValueType_Integer,
		Minimum:        0,
		Maximum:        999,
		RetryCount:     2,
		ControlDelayMs: 50,
		DefaultValue:   b.Int(0),
		DisplaySuffix:  "",
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:             &pb.ModelParameterID{Parameter: 4},
		Path:           "camera",
		Name:           "camera_select",
		Label:          "Camera Select",
		ShortLabel:     "Select",
		Description:    "Dynamic list of cameras currently available in DIT Browse. Setting a value focuses that camera.",
		ControlStyle:   pb.ControlStyle_Normal,
		FeedbackStyle:  pb.FeedbackStyle_NormalFeedback,
		ValueType:      pb.ValueType_Opt,
		OptionListIsDynamic: true,
		OptionList:     ib.GenerateOptionList("None"),
		RetryCount:     2,
		ControlDelayMs: 50,
		DefaultValue:   b.OptIndex(0),
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 5},
		Path:          "camera",
		Name:          "focus_mode",
		Label:         "Focus Mode",
		ShortLabel:    "Focus",
		Description:   "True when DIT Browse is expanded on a single camera.",
		ControlStyle:  pb.ControlStyle_NoControl,
		FeedbackStyle: pb.FeedbackStyle_NormalFeedback,
		ValueType:     pb.ValueType_Binary,
		DefaultValue:  b.Bool(false),
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:             &pb.ModelParameterID{Parameter: 6},
		Path:           "camera",
		Name:           "expansion_enabled",
		Label:          "Expansion Enabled",
		ShortLabel:     "Expand",
		Description:    "When disabled, DIT Browse stays on the full camera grid.",
		ControlStyle:   pb.ControlStyle_Normal,
		FeedbackStyle:  pb.FeedbackStyle_NormalFeedback,
		ValueType:      pb.ValueType_Binary,
		RetryCount:     2,
		ControlDelayMs: 50,
		DefaultValue:   b.Bool(true),
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 7},
		Path:          "camera",
		Name:          "show_grid",
		Label:         "Show Grid",
		ShortLabel:    "Grid",
		Description:   "Returns DIT Browse to the multi-camera grid without changing expansion mode.",
		ControlStyle:  pb.ControlStyle_Oneshot,
		FeedbackStyle: pb.FeedbackStyle_NoFeedback,
		ValueType:     pb.ValueType_NoValue,
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 8},
		Path:          "camera",
		Name:          "toggle_expansion",
		Label:         "Toggle Expansion",
		ShortLabel:    "TogExp",
		Description:   "Toggles single-camera expansion mode in DIT Browse.",
		ControlStyle:  pb.ControlStyle_Oneshot,
		FeedbackStyle: pb.FeedbackStyle_NoFeedback,
		ValueType:     pb.ValueType_NoValue,
	})

	// GenericType_Routing lets this core appear as a Routing Trigger destination
	// in Blue Pill. Dimension 1 = ME/Bus/Aux destination; value = camera/input number.
	r.RegisterParameter(&pb.ParameterDetail{
		Id:             &pb.ModelParameterID{Parameter: 9},
		Path:           "routing",
		Name:           "route",
		Label:          "Route Camera",
		ShortLabel:     "Route",
		Description:    "Blue Pill Routing Trigger target. Setting a destination to camera N focuses camera N in DIT Browse. Pair with a real video router row in Routing Triggers for SDI/NDI switching.",
		GenericType:    pb.GenericType_Routing,
		ControlStyle:   pb.ControlStyle_Normal,
		FeedbackStyle:  pb.FeedbackStyle_NormalFeedback,
		ValueType:      pb.ValueType_Integer,
		Minimum:        0,
		Maximum:        999,
		RetryCount:     2,
		ControlDelayMs: 50,
		DefaultValue:   b.Int(0),
		Dimensions: []*pb.DimensionDetail{
			{
				Name:  "Destination",
				Count: 8,
			},
		},
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:             &pb.ModelParameterID{Parameter: 10},
		Path:           "routing",
		Name:           "route_index",
		Label:          "Route Index",
		ShortLabel:     "RIdx",
		Description:    "Mirrors the currently selected camera number for Virtual Triggers / RoutingSource-style syncing.",
		ControlStyle:   pb.ControlStyle_NoControl,
		FeedbackStyle:  pb.FeedbackStyle_NormalFeedback,
		ValueType:      pb.ValueType_Integer,
		Minimum:        0,
		Maximum:        999,
		DefaultValue:   b.Int(0),
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 11},
		Path:          "status",
		Name:          "camera_count",
		Label:         "Camera Count",
		ShortLabel:    "Cams",
		Description:   "Number of uniquely numbered cameras currently reported by DIT Browse.",
		ControlStyle:  pb.ControlStyle_NoControl,
		FeedbackStyle: pb.FeedbackStyle_NormalFeedback,
		ValueType:     pb.ValueType_Integer,
		Minimum:       0,
		Maximum:       999,
		DefaultValue:  b.Int(0),
	})

	r.RegisterParameter(&pb.ParameterDetail{
		Id:            &pb.ModelParameterID{Parameter: 12},
		Path:          "status",
		Name:          "selected_title",
		Label:         "Selected Title",
		ShortLabel:    "Title",
		Description:   "Title of the currently selected DIT Browse camera tile.",
		ControlStyle:  pb.ControlStyle_NoControl,
		FeedbackStyle: pb.FeedbackStyle_NormalFeedback,
		ValueType:     pb.ValueType_String,
		DefaultValue:  b.String(""),
	})
}
