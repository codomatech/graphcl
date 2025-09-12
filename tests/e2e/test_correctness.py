import pytest
import requests
import json
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from deepdiff import DeepDiff
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class GraphQLEndpoint:
    """Configuration for a GraphQL endpoint"""
    url: str
    headers: Optional[Dict[str, str]] = None
    name: str = ""

@dataclass
class QueryTest:
    """Configuration for a GraphQL query test"""
    query: str
    variables: Optional[Dict[str, Any]] = None
    expected_fields: Optional[List[str]] = None
    description: str = ""
    id: str = ""

class GraphQLClient:
    """Simple GraphQL client for making requests"""

    def __init__(self, endpoint: GraphQLEndpoint):
        self.endpoint = endpoint
        self.session = requests.Session()
        if endpoint.headers:
            self.session.headers.update(endpoint.headers)

    def execute_query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a GraphQL query and return the response"""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            response = self.session.post(
                self.endpoint.url,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed for {self.endpoint.name}: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from {self.endpoint.name}: {e}")
            raise

class SemanticComparator:
    """Handles semantic comparison of GraphQL responses"""

    def __init__(self, ignore_order: bool = True, ignore_keys: List[str] = None):
        self.ignore_order = ignore_order
        self.ignore_keys = ignore_keys or ['__typename', 'id', 'createdAt', 'updatedAt']

    def normalize_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize response data for comparison"""
        if not isinstance(response, dict):
            return response

        # Remove ignored keys
        normalized = {}
        for key, value in response.items():
            if key not in self.ignore_keys:
                if isinstance(value, dict):
                    normalized[key] = self.normalize_response(value)
                elif isinstance(value, list):
                    normalized[key] = [self.normalize_response(item) for item in value]
                else:
                    normalized[key] = value

        return normalized

    def compare_responses(self, response1: Dict[str, Any], response2: Dict[str, Any]) -> Dict[str, Any]:
        """Compare two GraphQL responses semantically"""
        normalized1 = self.normalize_response(response1)
        normalized2 = self.normalize_response(response2)

        diff = DeepDiff(
            normalized1,
            normalized2,
            ignore_order=self.ignore_order,
            verbose_level=2
        )

        return diff

    def are_semantically_equal(self, response1: Dict[str, Any], response2: Dict[str, Any]) -> bool:
        """Check if two responses are semantically equal"""
        diff = self.compare_responses(response1, response2)
        return len(diff) == 0

class QueryLoader:
    """Loads and parses GraphQL queries from JSON file"""

    def __init__(self, queries_file: str = "queries.json"):
        self.queries_file = queries_file

    def load_queries(self) -> List[QueryTest]:
        """Load queries from JSON file"""
        if not os.path.exists(self.queries_file):
            self._create_sample_file()

        with open(self.queries_file, 'r') as f:
            queries_data = json.load(f)
            queries_data = [{'query': query, 'id': i} for i, query in enumerate(queries_data[:])]

        queries = []
        for query_data in queries_data:
            query_test = QueryTest(
                query=query_data["query"],
                variables=query_data.get("variables"),
                expected_fields=query_data.get("expected_fields"),
                description=query_data.get("description", ""),
                id=query_data.get("id", query_data.get("description", "unnamed_query"))
            )
            queries.append(query_test)

        return queries

    def _create_sample_file(self):
        """Create a sample queries.json file"""
        sample_queries = [
            {
                "id": "get_users",
                "description": "Get users with profiles",
                "query": """
                query GetUsers($limit: Int) {
                    users(limit: $limit) {
                        id
                        name
                        email
                        profile {
                            firstName
                            lastName
                        }
                    }
                }
                """,
                "variables": {"limit": 10},
                "expected_fields": ["users"]
            },
            {
                "id": "get_posts",
                "description": "Get posts with authors",
                "query": """
                query GetPosts {
                    posts {
                        title
                        content
                        author {
                            name
                        }
                        tags
                    }
                }
                """,
                "expected_fields": ["posts"]
            },
            {
                "id": "get_user_by_id",
                "description": "Get specific user by ID",
                "query": """
                query GetUserById($userId: ID!) {
                    user(id: $userId) {
                        id
                        name
                        email
                        posts {
                            title
                            createdAt
                        }
                    }
                }
                """,
                "variables": {"userId": "1"},
                "expected_fields": ["user"]
            }
        ]

        with open(self.queries_file, 'w') as f:
            json.dump(sample_queries, f, indent=2)

        print(f"Created sample queries file: {self.queries_file}")

# Load queries from JSON file
def load_test_queries(queries_file: str = None) -> List[QueryTest]:
    """Load queries from JSON file for parametrization"""
    if queries_file is None:
        queries_file = os.getenv("QUERIES_FILE", "queries.json")

    loader = QueryLoader(queries_file)
    return loader.load_queries()

# Test configuration
@pytest.fixture
def api_endpoints():
    """Configure your GraphQL endpoints here"""
    url1 = os.environ['GRAPHQL_API1']
    url2 = os.environ['GRAPHQL_API2']
    return [
        GraphQLEndpoint(
            url=f'{url1}/graphql',
            headers={"Authorization": "Bearer " + admin_token(url1) },
            name="API_1"
        ),
        GraphQLEndpoint(
            url=f'{url2}/graphql',
            headers={"Authorization": "Bearer " + admin_token(url2) },
            name="API_2"
        )
    ]

@pytest.fixture
def semantic_comparator():
    """Configure semantic comparison settings"""
    return SemanticComparator(
        ignore_order=True,
        ignore_keys=['__typename', 'id', 'createdAt', 'updatedAt', 'timestamp']
    )

@pytest.fixture
def graphql_clients(api_endpoints):
    """Create GraphQL clients for each endpoint"""
    return [GraphQLClient(endpoint) for endpoint in api_endpoints]


def admin_token(url):
    """Fixture to authenticate as admin and return the token"""
    ADMIN_EMAIL = 'admin@mail.com'
    ADMIN_PASSWORD = 'Admin123'
    HOST = 'localhost'  # or your actual host

    payload = {
        'email': ADMIN_EMAIL,
        'password': ADMIN_PASSWORD
    }

    headers = {
        'Content-Type': 'application/json'
    }

    token = None
    max_attempts = 10

    for _ in range(max_attempts):
        try:
            response = requests.post(
                f'{url}/admin/login',
                data=json.dumps(payload),
                headers=headers
            )
            response_data = response.json()

            if response_data.get('data'):
                token = response_data['data']['token']
                break
        except (requests.exceptions.RequestException, json.JSONDecodeError):
            pass

        time.sleep(1)

    if not token:
        pytest.fail(f"Failed to obtain admin token after multiple attempts: {url}")

    return token

# Main test function with parametrize decorator
@pytest.mark.parametrize(
    "query_test",
    load_test_queries(),
    ids=lambda q: q.id
)
def test_graphql_semantic_equality(graphql_clients, semantic_comparator, query_test):
    """Test that two GraphQL APIs return semantically equivalent results"""

    if len(graphql_clients) != 2:
        pytest.skip("Test requires exactly 2 GraphQL endpoints")

    client1, client2 = graphql_clients

    # Execute query on both APIs
    logger.info(f"Executing query: {query_test.description} (ID: {query_test.id})")

    response1 = client1.execute_query(query_test.query, query_test.variables)
    response2 = client2.execute_query(query_test.query, query_test.variables)

    # Check for GraphQL errors
    assert "errors" not in response1 or not response1["errors"], f"API 1 returned errors: {response1.get('errors')}"
    assert "errors" not in response2 or not response2["errors"], f"API 2 returned errors: {response2.get('errors')}"

    # Extract data from responses
    data1 = response1.get("data", {})
    data2 = response2.get("data", {})

    # Check expected fields are present
    if query_test.expected_fields:
        for field in query_test.expected_fields:
            assert field in data1, f"Expected field '{field}' not found in API 1 response"
            assert field in data2, f"Expected field '{field}' not found in API 2 response"

    # Perform semantic comparison
    logger.info("Comparing responses semantically...")

    are_equal = semantic_comparator.are_semantically_equal(data1, data2)

    if not are_equal:
        diff = semantic_comparator.compare_responses(data1, data2)
        logger.error(f"Semantic differences found: {diff}")

        # Pretty print the differences for debugging
        print("\n" + "="*50)
        print(f"SEMANTIC DIFFERENCES DETECTED - Query: {query_test.id}")
        print("="*50)
        print(f"Differences: {diff}")
        print("\nAPI 1 Response:")
        print(json.dumps(data1, indent=2))
        print("\nAPI 2 Response:")
        print(json.dumps(data2, indent=2))
        print("="*50)

    assert are_equal, f"APIs returned semantically different results for query '{query_test.id}'. See logs for details."
    from random import random
    if are_equal: # and random() < 0.01:
        with open(f'sample-output-{query_test.id}.json', 'w+') as f:
            json.dump(data1, f, indent='\t')


# Test schema compatibility
def test_schema_compatibility(graphql_clients):
    """Test that both APIs have compatible schemas"""
    introspection_query = """
    query IntrospectionQuery {
        __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
                kind
                name
                description
                fields(includeDeprecated: true) {
                    name
                    description
                    type {
                        kind
                        name
                        ofType {
                            kind
                            name
                        }
                    }
                    isDeprecated
                    deprecationReason
                }
            }
        }
    }
    """

    if len(graphql_clients) != 2:
        pytest.skip("Schema compatibility test requires exactly 2 endpoints")

    client1, client2 = graphql_clients

    schema1 = client1.execute_query(introspection_query)
    schema2 = client2.execute_query(introspection_query)

    assert "errors" not in schema1 or not schema1["errors"], "API 1 schema introspection failed"
    assert "errors" not in schema2 or not schema2["errors"], "API 2 schema introspection failed"

    # Extract type names for basic compatibility check
    types1 = {t["name"] for t in schema1["data"]["__schema"]["types"] if not t["name"].startswith("__")}
    types2 = {t["name"] for t in schema2["data"]["__schema"]["types"] if not t["name"].startswith("__")}

    common_types = types1 & types2
    assert len(common_types) > 0, "APIs have no common types"

    logger.info(f"Found {len(common_types)} common types between APIs")


if __name__ == "__main__":
    # Run tests with: python -m pytest test_graphql_semantic.py -v
    pytest.main([__file__, "-v"])
