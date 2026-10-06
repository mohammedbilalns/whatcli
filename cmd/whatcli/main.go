package main

import (
	"fmt"
	"os"

	"whatcli/pkg/ipc"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: whatcli <command>")
		fmt.Println("Commands: ping, status")
		os.Exit(1)
	}

	cmd := os.Args[1]
	socketPath := "/tmp/whatd.sock"

	client := ipc.NewClient(socketPath)

	res, err := client.Call(cmd, nil)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Result: %v\n", res)
}
