import { check, sleep} from 'k6';
import http from 'k6/http';
import { randomSeed } from 'k6';

// Configuration
export const options = {
//   stages: [
//     { duration: '10s', target: 3 },  // Ramp up to 10 users
//   ],
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 1000 },
    { duration: '1m', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Test data - same as your bash variables
const DATE_RANGES = [
  { start: "2024-01-01", end: "2024-06-30" },
  { start: "2024-07-01", end: "2024-12-31" }
];
const TAG_SETS = ["Tech", "AI", "Health", "Fitness"];
const AUTHOR_PREFIXES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
  "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "W", "X", "Y", "Z"
];


//const HOST = 'localhost'
// GraphQL endpoint
//const URL = `http://${HOST}:1337/graphql`;

const URL = __ENV.GRAPHQL_ENDPOINT || process.env.GRAPHQL_ENDPOINT

// Uncomment if you need authentication
// const TOKEN = "your_token_here";
// const headers = {
//   'Content-Type': 'application/json',
//   'Authorization': `Bearer ${TOKEN}`
// };

function buildQuery(dateRange, tags, prefix) {
  // Strapi requires tags as separate filter conditions
  //const tagFilters = tags.map(tag => `{ name: { eq: "${tag}" } }`).join(' ');
  const tagFilters = JSON.stringify(tags)

  const prefix2 = String.fromCharCode(prefix.charCodeAt(0) + 1)
  return JSON.stringify({
    query: `
      query GetArticles {
        articles (
          where: {
            #updated_at: { gte: "${dateRange.start}T00:00:00.000Z", lte: "${dateRange.end}T23:59:59.999Z" }
            publish_date_gte: "${dateRange.start}T00:00:00.000Z"
            publish_date_lte: "${dateRange.end}T00:00:00.000Z"
            # simulate startswith by gte and lte
            author: { name_gte: "${prefix}" , name_lt: "${prefix2}"  }
            tags: { name: ${tagFilters} }
          }
        ) {
          #data {
              title
              excerpt
              publish_date
              author {
                    name
              }
              tags {
                    name
              }
          #}
        }
      }
    `
  });
}


export function setup() {
  const ADMIN_EMAIL = 'admin@mail.com';
  const ADMIN_PASSWORD = 'Admin123';


  let payload = {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }

  //console.log('Logging in to Strapi...', payload);
  let token
  for (let i=0; i<10; i++) {
    const response = http.post(
      URL.replace('/graphql', '/admin/login'),
      JSON.stringify(payload),
      {headers: { 'Content-Type': 'application/json' }},
      );
    //console.log('Login successful!', response);
    let data
    try {
      data = JSON.parse(response.body)?.data
    } catch (e) {
      data = null
    }
    if (!data) {
      sleep(1)
      continue
    }
    token = JSON.parse(response.body).data.token;
  }
  return { token }
}


export default function (data) {
  randomSeed(12)

  // Select random test parameters
  const dateRange = DATE_RANGES[Math.floor(Math.random() * DATE_RANGES.length)];
  const tags = TAG_SETS[Math.floor(Math.random() * TAG_SETS.length)];
  const prefix = AUTHOR_PREFIXES[Math.floor(Math.random() * AUTHOR_PREFIXES.length)];

  const payload = buildQuery(dateRange, tags, prefix);

  //console.debug('query is', payload)

  const res = http.post(URL, payload, {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  });

  // Add checks to verify response
  check(res, {
    'is status 200': (r) => r.status === 200,
    'no GraphQL errors': (r) => {
      const body = JSON.parse(r.body);
      return !body.errors;
    },
    'has data': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.articles;
    }
  });

  // Add sleep to simulate think time
  sleep(Math.random() * 1);
}

export function handleSummary(data) {
    const stdout = '==startresults==\n' +
      JSON.stringify(data, null, '\t') +
      '\n==endresults==\n';
    return {
        stdout
    }
}
