package main

import (
	"flag"
	"fmt"
	"log"
	"strings"
	"time"
	"os"

	"github.com/codomatech/graphcl/proxy"
)

func main() {
	var (
		endpoint string
		port     int
		cacheMap string
	)

	flag.StringVar(&endpoint, "endpoint", "", "Target GraphQL endpoint")
	flag.IntVar(&port, "port", 7370, "Port to listen on")
	flag.StringVar(&cacheMap, "cache", "User:300,Post:600", "Entity cache times in seconds (comma-separated)")
	flag.Parse()

	cacheTimes := make(map[string]time.Duration)
	for _, item := range strings.Split(cacheMap, ",") {
		parts := strings.Split(item, ":")
		if len(parts) != 2 {
			log.Fatalf("Invalid cache time format: %s. Expected format: Entity:Seconds", item)
		}
		entity := strings.TrimSpace(parts[0])
		var seconds int
		if _, err := fmt.Sscanf(strings.TrimSpace(parts[1]), "%d", &seconds); err != nil {
			log.Fatalf("Invalid cache time for entity %s: %v", entity, err)
		}
		cacheTimes[entity] = time.Duration(seconds) * time.Second
	}

	if len(endpoint) == 0 {
		endpoint = os.Getenv("GRAPHCL_ENDPOINT")
	}

	if len(endpoint) == 0 {
		log.Fatalf("Fatal error: endpoint is missing!\nEither provide it by command line argument or via enviroment variable GRAPHCL_ENDPOINT")
	}

	p, err := proxy.New(endpoint, cacheTimes)
	if err != nil {
		log.Fatalf("Failed to create proxy: %v", err)
	}

	log.Printf("Starting GraphQL cache proxy on port %d, forwarding to %s", port, endpoint)
	if err := p.Start(port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
