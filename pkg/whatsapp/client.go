package whatsapp

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
	_ "github.com/mattn/go-sqlite3"
)

type Client struct {
	WAClient *whatsmeow.Client
}

func NewClient(dbPath string) (*Client, error) {
	dbLog := waLog.Stdout("Database", "DEBUG", true)
	container, err := sqlstore.New(context.Background(), "sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on", dbPath), dbLog)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get device store: %w", err)
	}

	clientLog := waLog.Stdout("Client", "DEBUG", true)
	waClient := whatsmeow.NewClient(deviceStore, clientLog)

	return &Client{
		WAClient: waClient,
	}, nil
}

func (c *Client) Connect() error {
	if c.WAClient.Store.ID == nil {
		// No ID stored, new login
		qrChan, _ := c.WAClient.GetQRChannel(context.Background())
		err := c.WAClient.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
		for evt := range qrChan {
			if evt.Event == "code" {
				// In a real app we'd send this over IPC or to stdout
				fmt.Printf("QR code: %v\n", evt.Code)
			} else {
				fmt.Printf("Login event: %v\n", evt.Event)
			}
		}
	} else {
		// Already logged in, just connect
		err := c.WAClient.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
	}
	return nil
}
