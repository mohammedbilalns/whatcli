package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"whatcli/pkg/ipc"
	"whatcli/pkg/whatsapp"
)

func main() {
	dbPath := "whatd.db"
	socketPath := "/tmp/whatd.sock"

	fmt.Println("Starting whatd daemon...")

	waClient, err := whatsapp.NewClient(dbPath)
	if err != nil {
		fmt.Printf("Failed to init whatsapp client: %v\n", err)
		os.Exit(1)
	}

	err = waClient.Connect()
	if err != nil {
		fmt.Printf("Failed to connect: %v\n", err)
		os.Exit(1)
	}

	ipcServer := ipc.NewServer(socketPath)

	ipcServer.Register("ping", func(params json.RawMessage) (interface{}, error) {
		return "pong", nil
	})

	ipcServer.Register("status", func(params json.RawMessage) (interface{}, error) {
		isConnected := waClient.WAClient.IsConnected()
		isLoggedIn := waClient.WAClient.IsLoggedIn()
		return map[string]interface{}{
			"connected": isConnected,
			"loggedIn":  isLoggedIn,
		}, nil
	})

	go func() {
		if err := ipcServer.Start(); err != nil {
			fmt.Printf("IPC server error: %v\n", err)
		}
	}()

	// Wait for termination signal
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	fmt.Println("Shutting down...")
	waClient.WAClient.Disconnect()
	os.Remove(socketPath)
}
