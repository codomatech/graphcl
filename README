# GraphCL

A lightweight caching proxy for GraphQL endpoints. GraphCL reduces server load and improves response times by storing frequently accessed data.

## How It Works

GraphCL sits between your application and your GraphQL API (like Strapi), temporarily storing query results. When identical requests are made, GraphCL returns the cached response instead of querying the server again. Note that GraphCL only caches queries which do not contain mutations, i.e. it is limited to read-only queries.

Cached data expires after a specified time. By default, all entities are cached for 1 minute. You can specify caching duration per entity using command line argument. E.g.: the following caches the entity User for 5 minutes and Post for 10 minutes:

`--cache="User:300,Post:600"`



## Benefits

-   **Faster Responses**: Reduces HTTP request duration by ~50%
-   **Higher Capacity**: Effectively doubles your endpoint's throughput
-   **Energy Efficient**: Can reduce energy consumption by ~20%
-   **Simple Integration**: Works with existing GraphQL endpoints without code changes

## Use Cases

-   Content management systems (Strapi, Contentful, etc.)
-   APIs with frequently accessed data
-   Applications needing improved response times
-   Environments where reducing server load is beneficial


## How to Use

GraphCL can be easily used via the docker image. E.g. in Compose:

```compose
  graphcl:
    image: codomatech/graphcl
    environment:
      - GRAPHCL_ENDPOINT=https://example.com/graphql
    ports:
      - "7370:7370"
```


---
`GraphCL` is a work of :heart: by [Codoma.tech](https://www.codoma.tech/).
