#!/bin/bash

# GraphQL endpoint
URL="http://localhost:1337/graphql"

# Optional Auth
# TOKEN="your_token_here"
# AUTH_HEADER="Authorization: Bearer $TOKEN"

# Array of parameter sets
declare -a DATE_RANGES=("2024-01-01,2024-06-30" "2024-07-01,2024-12-31")
declare -a TAG_SETS=("Tech,AI" "Health,Fitness")
declare -a AUTHOR_PREFIXES=("A" "B")

# Loop through each combination
for DATE_RANGE in "${DATE_RANGES[@]}"; do
  for TAG_SET in "${TAG_SETS[@]}"; do
    for PREFIX in "${AUTHOR_PREFIXES[@]}"; do

      START_DATE=$(echo $DATE_RANGE | cut -d',' -f1)
      END_DATE=$(echo $DATE_RANGE | cut -d',' -f2)
      TAGS=$(echo $TAG_SET | sed 's/,/","/g')

      echo "Querying: Date $START_DATE to $END_DATE | Tags: $TAG_SET | Author starts with: $PREFIX"

      read -r -d '' QUERY << EOM
      query {
        articles (
          filters: {
            publish_date: {
              gte: "$START_DATE"T00:00:00.000Z,
              lte: "$END_DATE"T23:59:59.999Z
            },
            tags: {
              name: {
                in: ["$TAGS"]
              }
            },
            author: {
              name: {
                startsWith: "$PREFIX"
              }
            },
            and: [
              { title: { contains: "GraphQL" } },
              {
                or: [
                  { excerpt: { contains: "Strapi" } },
                  { excerpt: { contains: "CMS" } }
                ]
              }
            ]
          }
        ) {
          data {
            id
            attributes {
              title
              excerpt
              publish_date
              author {
                data {
                  attributes {
                    name
                  }
                }
              }
              tags {
                data {
                  attributes {
                    name
                  }
                }
              }
            }
          }
        }
      }
EOM

      echo $QUERY
      curl -s -X POST "$URL" \
        -H "Content-Type: application/json" \
        # -H "$AUTH_HEADER" \
        -d "{\"query\":\"$(echo "$QUERY" | sed 's/"/\\"/g' | tr -d '\n')\"}"

      echo -e "\n---\n"
      exit 0
    done
  done
done
