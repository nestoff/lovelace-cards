package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	log "github.com/s00500/env_logger"
)

const (
	controlProtocol        = "ditbrowse.control"
	controlProtocolVersion = 1
	controlWebSocketPath   = "/api/ws"
)

type ditBrowseStatusTab struct {
	Index        int     `json:"index"`
	TileID       string  `json:"tileId"`
	CameraID     *string `json:"cameraId"`
	CameraNumber *int    `json:"cameraNumber"`
	Title        string  `json:"title"`
	URL          string  `json:"url"`
}

type ditBrowseStatus struct {
	ExpansionEnabled     bool                 `json:"expansionEnabled"`
	FocusMode            bool                 `json:"focusMode"`
	SelectedCameraNumber *int                 `json:"selectedCameraNumber"`
	SelectedTileID       *string              `json:"selectedTileId"`
	SelectedIndex        *int                 `json:"selectedIndex"`
	Tabs                 []ditBrowseStatusTab `json:"tabs"`
}

type ditBrowseClient struct {
	host string
	port uint16

	mu     sync.Mutex
	conn   *websocket.Conn
	status ditBrowseStatus
	rev    int64

	onStatus func(ditBrowseStatus)
}

func newDitBrowseClient(host string, port uint16) *ditBrowseClient {
	return &ditBrowseClient{host: host, port: port}
}

func (c *ditBrowseClient) wsURL() string {
	return fmt.Sprintf("ws://%s:%d%s", c.host, c.port, controlWebSocketPath)
}

func (c *ditBrowseClient) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}

	dialer := websocket.Dialer{
		Proxy:            http.ProxyFromEnvironment,
		HandshakeTimeout: 5 * time.Second,
	}
	conn, _, err := dialer.Dial(c.wsURL(), nil)
	if err != nil {
		return err
	}

	hello := map[string]any{
		"type":            "hello",
		"protocol":        controlProtocol,
		"protocolVersion": controlProtocolVersion,
		"client": map[string]string{
			"name":    "core-ditbrowse",
			"version": gitTag,
		},
	}
	if err := conn.WriteJSON(hello); err != nil {
		_ = conn.Close()
		return err
	}

	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var response map[string]any
	if err := conn.ReadJSON(&response); err != nil {
		_ = conn.Close()
		return fmt.Errorf("hello response: %w", err)
	}
	_ = conn.SetReadDeadline(time.Time{})

	if response["type"] != "hello" || response["protocol"] != controlProtocol {
		_ = conn.Close()
		return fmt.Errorf("unexpected hello response: %v", response["type"])
	}

	c.conn = conn
	return nil
}

func (c *ditBrowseClient) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
	}
}

func (c *ditBrowseClient) readLoop(onDisconnect func()) {
	for {
		c.mu.Lock()
		conn := c.conn
		c.mu.Unlock()
		if conn == nil {
			onDisconnect()
			return
		}

		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Warnf("DIT Browse read error from %s: %v", c.wsURL(), err)
			c.close()
			onDisconnect()
			return
		}

		var envelope struct {
			Type     string           `json:"type"`
			Event    string           `json:"event"`
			Revision int64            `json:"revision"`
			Status   *ditBrowseStatus `json:"status"`
			Ok       *bool            `json:"ok"`
		}
		if err := json.Unmarshal(data, &envelope); err != nil {
			log.Warnf("DIT Browse invalid JSON: %v", err)
			continue
		}

		if envelope.Type == "event" && envelope.Event == "status" && envelope.Status != nil {
			c.applyStatus(*envelope.Status, envelope.Revision)
			continue
		}

		if envelope.Type == "result" && envelope.Ok != nil && *envelope.Ok && envelope.Status != nil {
			c.applyStatus(*envelope.Status, c.rev)
		}
	}
}

func (c *ditBrowseClient) applyStatus(status ditBrowseStatus, revision int64) {
	c.mu.Lock()
	c.status = status
	if revision > c.rev {
		c.rev = revision
	}
	cb := c.onStatus
	c.mu.Unlock()
	if cb != nil {
		cb(status)
	}
}

func (c *ditBrowseClient) getStatus() ditBrowseStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.status
}

func (c *ditBrowseClient) sendCommand(command map[string]any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}

	requestID := fmt.Sprintf("%d", time.Now().UnixNano())
	message := map[string]any{
		"type":      "command",
		"requestId": requestID,
		"command":   command,
	}
	return c.conn.WriteJSON(message)
}

func (c *ditBrowseClient) focusCamera(cameraNumber int) error {
	if cameraNumber < 1 {
		return fmt.Errorf("camera number must be >= 1")
	}
	return c.sendCommand(map[string]any{
		"type":         "focusCamera",
		"cameraNumber": cameraNumber,
	})
}

func (c *ditBrowseClient) showGrid() error {
	return c.sendCommand(map[string]any{"type": "showGrid"})
}

func (c *ditBrowseClient) toggleExpansion() error {
	return c.sendCommand(map[string]any{"type": "toggleExpansion"})
}

func (c *ditBrowseClient) requestStatus() error {
	return c.sendCommand(map[string]any{"type": "status"})
}

func uniqueCameraNumbers(status ditBrowseStatus) []int {
	seen := map[int]struct{}{}
	out := make([]int, 0)
	for _, tab := range status.Tabs {
		if tab.CameraNumber == nil || *tab.CameraNumber < 1 {
			continue
		}
		n := *tab.CameraNumber
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}

func selectedTitle(status ditBrowseStatus) string {
	if status.SelectedTileID == nil {
		return ""
	}
	for _, tab := range status.Tabs {
		if tab.TileID == *status.SelectedTileID {
			return tab.Title
		}
	}
	return ""
}
