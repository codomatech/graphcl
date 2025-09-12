/*
 * TODO
 * - implement automatic cache life time (using the http response headers)
 * - use a proper, fixed-size cache.
 * - output telemetry stats of cache hit and miss
 * - implement "see other" to utilize cdn
 */
package proxy

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	_ "log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"sort"
	_ "strconv"
	"strings"
	"sync"
	"time"

	//"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/tidwall/gjson"
)

const cachePrefix = "/_gcl/"

type QueryInfo struct {
	Body           []byte
	AuthHeaders    map[string]string
	Entities       []string
	OriginalTarget string
	Expiry         time.Time
}

type Proxy struct {
	target     *url.URL
	proxy      *httputil.ReverseProxy
	cacheTimes map[string]time.Duration
	queries    map[string]*QueryInfo
	mu         sync.RWMutex
}

func New(endpoint string, cacheTimes map[string]time.Duration) (*Proxy, error) {
	target, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("invalid endpoint URL: %w", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	
	p := &Proxy{
		target:     target,
		proxy:      proxy,
		cacheTimes: cacheTimes,
		queries:    make(map[string]*QueryInfo),
	}

	return p, nil
}

func (p *Proxy) Start(port int) error {
	router := mux.NewRouter()
	
	router.PathPrefix(cachePrefix).HandlerFunc(p.handleCachedQuery)
	router.PathPrefix("/").HandlerFunc(p.handleRequest)

	return http.ListenAndServe(fmt.Sprintf(":%d", port), router)
}

func (p *Proxy) handleRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		p.proxy.ServeHTTP(w, r)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}
	r.Body.Close()
	
	contentType := r.Header.Get("Content-Type")
	if !strings.Contains(contentType, "application/json") {
		r.Body = io.NopCloser(bytes.NewReader(body))
		p.proxy.ServeHTTP(w, r)
		return
	}

	graphqlData := gjson.ParseBytes(body)
	
	if !isGraphQLQuery(graphqlData) {
		r.Body = io.NopCloser(bytes.NewReader(body))
		p.proxy.ServeHTTP(w, r)
		return
	}

	query := graphqlData.Get("query").String()
	
	if hasMutations(query) {
		//log.Printf("query has mutations: \n%s", query)
		r.Body = io.NopCloser(bytes.NewReader(body))
		p.proxy.ServeHTTP(w, r)
		return
	}

	entities := extractEntities(query)
	if len(entities) == 0 {
		r.Body = io.NopCloser(bytes.NewReader(body))
		p.proxy.ServeHTTP(w, r)
		return
	}

	//log.Printf("query has entities: %+v", entities)

	authHeaders := extractAuthHeaders(r)
	hash := computeQueryHash(body, authHeaders)

	p.mu.Lock()
	p.queries[hash] = &QueryInfo{
		Body:           body,
		AuthHeaders:    authHeaders,
		Entities:       entities,
		OriginalTarget: r.URL.String(),
	}
	p.mu.Unlock()

	redirectURL := cachePrefix + hash
	w.Header().Set("Location", redirectURL)
	w.WriteHeader(http.StatusSeeOther)
}

func (p *Proxy) handleCachedQuery(w http.ResponseWriter, r *http.Request) {
	hash := path.Base(r.URL.Path)
	
	p.mu.RLock()
	queryInfo, exists := p.queries[hash]
	p.mu.RUnlock()
	
	if !exists {
		http.Error(w, "Cache entry not found", http.StatusNotFound)
		return
	}

	// Handle expiration
	if !queryInfo.Expiry.IsZero() && time.Now().After(queryInfo.Expiry) {
		// Refresh the cached result
		delete(p.queries, hash)
		p.handleCachedQuery(w, r)
		return
	}


	// Create a new request to the target
	/*
	log.Printf("handleCachedQuery: queryInfo.OriginalTarget=%s, Body=\n%s\n\nHeaders=%+v",
			   queryInfo.OriginalTarget, string(queryInfo.Body),
			   r.Header)
	*/
	if queryInfo.OriginalTarget == "/" {
		queryInfo.OriginalTarget = ""
	}
	proxyReq, err := http.NewRequest(http.MethodPost, p.target.String()+queryInfo.OriginalTarget, bytes.NewReader(queryInfo.Body))
	if err != nil {
		http.Error(w, "Failed to create proxy request", http.StatusInternalServerError)
		return
	}

	// Copy the original headers
	proxyReq.Header = r.Header.Clone()
	
	// Add auth headers from the original request
	for k, v := range queryInfo.AuthHeaders {
		proxyReq.Header.Set(k, v)
	}

	proxyReq.Header.Set("Content-Type", "application/json")
	
	// Execute the request
	proxyResp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		http.Error(w, "Failed to execute proxy request", http.StatusBadGateway)
		return
	}
	defer proxyResp.Body.Close()

	// Determine cache duration
	var minCacheDuration time.Duration
	if len(queryInfo.Entities) > 0 {
		minCacheDuration = p.getMinCacheDuration(queryInfo.Entities)
		
		// Set the expiry time for this query
		p.mu.Lock()
		if info, exists := p.queries[hash]; exists {
			info.Expiry = time.Now().Add(minCacheDuration)
		}
		p.mu.Unlock()
		
		// Set caching headers
		w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%d, public", int(minCacheDuration.Seconds())))
		w.Header().Set("Expires", time.Now().Add(minCacheDuration).Format(http.TimeFormat))
	}

	// Copy response headers
	for key, values := range proxyResp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Copy status code
	w.WriteHeader(proxyResp.StatusCode)

	// Copy response body
	io.Copy(w, proxyResp.Body)
}

func isGraphQLQuery(data gjson.Result) bool {
	return data.Get("query").Exists()
}

func hasMutations(query string) bool {
	return strings.Contains(strings.ToLower(query), "mutation")
}

func extractEntities(query string) []string {
	var entities []string
	entityMap := make(map[string]bool)

	// Simple extraction strategy - get words after "query" or "type" keywords
	fields := []string{"query", "type"}
	words := strings.Fields(query)

	for i, word := range words {
		for _, field := range fields {
			if strings.EqualFold(word, field) && i+1 < len(words) {
				entity := sanitizeEntityName(words[i+1])
				if entity != "" && !entityMap[entity] {
					entityMap[entity] = true
					entities = append(entities, entity)
				}
			}
		}
	}

	// Extract from field selections ({ User { ... } })
	startBraceIndices := findAllIndices(query, '{')
	for _, idx := range startBraceIndices {
		if idx > 0 {
			// Check for word before opening brace
			precedingText := strings.TrimSpace(query[:idx])
			if len(precedingText) > 0 {
				lastSpace := strings.LastIndex(precedingText, " ")
				if lastSpace != -1 {
					entity := sanitizeEntityName(precedingText[lastSpace+1:])
					if entity != "" && !entityMap[entity] {
						entityMap[entity] = true
						entities = append(entities, entity)
					}
				}
			}
		}
	}

	return entities
}

func sanitizeEntityName(name string) string {
	// Remove non-alphanumeric characters and common GraphQL syntax
	name = strings.TrimSpace(name)
	name = strings.Trim(name, "{}(),:\"'")
	
	// Check if it's likely an entity name (first letter uppercase)
	if len(name) > 0 && name[0] >= 'A' && name[0] <= 'Z' {
		return name
	}
	return ""
}

func findAllIndices(s string, char byte) []int {
	var indices []int
	for i := 0; i < len(s); i++ {
		if s[i] == char {
			indices = append(indices, i)
		}
	}
	return indices
}

func extractAuthHeaders(r *http.Request) map[string]string {
	authHeaders := make(map[string]string)
	
	// Common auth header patterns
	authPatterns := []string{
		"Authorization",
		"Auth",
		"X-Auth",
		"Api-Key",
		"X-Api-Key",
		"Bearer",
		"Token",
	}
	
	for key, values := range r.Header {
		keyLower := strings.ToLower(key)
		for _, pattern := range authPatterns {
			if strings.Contains(keyLower, strings.ToLower(pattern)) {
				if len(values) > 0 {
					authHeaders[key] = values[0]
				}
			}
		}
	}
	
	return authHeaders
}

func computeQueryHash(body []byte, authHeaders map[string]string) string {
	h := sha256.New()
	
	// Hash body first
	h.Write(body)
	
	// Sort headers by key for consistent hashing
	var keys []string
	for k := range authHeaders {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	
	// Add auth headers to hash
	for _, k := range keys {
		h.Write([]byte(k))
		h.Write([]byte(":"))
		h.Write([]byte(authHeaders[k]))
		h.Write([]byte("\n"))
	}
	
	return hex.EncodeToString(h.Sum(nil))
}

func (p *Proxy) getMinCacheDuration(entities []string) time.Duration {
	var minDuration time.Duration
	first := true
	
	for _, entity := range entities {
		if duration, exists := p.cacheTimes[entity]; exists {
			if first || duration < minDuration {
				minDuration = duration
				first = false
			}
		}
	}
	
	if first {
		// Default cache time if no matches
		return 60 * time.Second
	}
	
	return minDuration
}
