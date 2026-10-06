package ipc

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"sync"
)

type Server struct {
	SocketPath string
	mu         sync.Mutex
	Handlers   map[string]func(json.RawMessage) (interface{}, error)
}

type Request struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type Response struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func NewServer(socketPath string) *Server {
	return &Server{
		SocketPath: socketPath,
		Handlers:   make(map[string]func(json.RawMessage) (interface{}, error)),
	}
}

func (s *Server) Register(method string, handler func(json.RawMessage) (interface{}, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Handlers[method] = handler
}

func (s *Server) handleRPC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(Response{Error: "Invalid JSON"})
		return
	}

	s.mu.Lock()
	handler, ok := s.Handlers[req.Method]
	s.mu.Unlock()

	if !ok {
		json.NewEncoder(w).Encode(Response{Error: "Method not found"})
		return
	}

	res, err := handler(req.Params)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	json.NewEncoder(w).Encode(Response{Result: res})
}

func (s *Server) Start() error {
	_ = os.Remove(s.SocketPath)
	listener, err := net.Listen("unix", s.SocketPath)
	if err != nil {
		return err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", s.handleRPC)

	fmt.Printf("IPC Server listening on %s\n", s.SocketPath)
	return http.Serve(listener, mux)
}
