// Test data
const DATE_RANGES = [
  { start: "2024-01-01", end: "2024-06-30" },
  { start: "2024-07-01", end: "2024-12-31" }
];
const TAG_SETS = ["Tech", "AI", "Health", "Fitness"]; // Separate tags for Strapi's format
const AUTHOR_PREFIXES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
  "J", "K", "L", "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "W", "X", "Y", "Z"
];


// GraphQL endpoint
//const URL = "http://localhost:1337/graphql";
const URL = "http://localhost:3000";

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

const http = {
  post: async function(url, payload, extra) {
    const res = await fetch(url, {
      method: 'POST',
      body: payload,
      ...extra
    })

    return await res.json()
  }
}


const ADMIN_EMAIL = 'admin@mail.com';
const ADMIN_PASSWORD = 'Admin123';

const login = async () => {
  try {
    let payload = {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }

    console.log('Logging in to Strapi...', payload);
    const response = await http.post(
      `http://localhost:1337/admin/login`,
      JSON.stringify(payload),
      {headers: { 'Content-Type': 'application/json' }},
      );
    console.log('Login successful!', response);
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw new Error('Failed to login to Strapi');
  }
};



async function main(createCaseOnly) {
  let token
  if (createCaseOnly !== true) {
    // login
    token = await login()
    console.debug('token=', token)
  }
  // Select random test parameters
  const dateRange = DATE_RANGES[Math.floor(Math.random() * DATE_RANGES.length)];
  const selectedTags = [];

  // Select 1-2 random tags
  const tagCount = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < tagCount; i++) {
    const randomTag = TAG_SETS[Math.floor(Math.random() * TAG_SETS.length)];
    if (!selectedTags.includes(randomTag)) {
      selectedTags.push(randomTag);
    }
  }

  const prefix = AUTHOR_PREFIXES[Math.floor(Math.random() * AUTHOR_PREFIXES.length)];

  const payload = buildQuery(dateRange, selectedTags, prefix);

  if (createCaseOnly === true) {
    return payload
  }

  console.debug('query is', JSON.parse(payload).query)

  const res = await http.post(URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
  });

  console.debug('result=', res/*.data.articles[0]*/)

//   // Add checks to verify response
//   check(res, {
//     'is status 200': (r) => r.status === 200,
//     'no GraphQL errors': (r) => {
//       const body = JSON.parse(r.body);
//       return !body.errors;
//     },
//     'has data': (r) => {
//       const body = JSON.parse(r.body);
//       return body.data && body.data.articles;
//     }
//   });
//
//   // Add sleep to simulate think time
//   sleep(Math.random() * 3);
}

async function createTestSuite() {
  const cases = []
  for (let i=0; i<10000; i++) {
    const tcase = await main(true)
    cases.push(JSON.parse(tcase).query)
  }
  const fs = require('fs')
  const fname = 'test-cases.json'
  fs.writeFileSync(fname, JSON.stringify(cases, null, '\t'))
  console.info('testcases written to', fname)

}

console.debug('args=', process.argv)
if (process.argv[2] === 'create-tests') {
  createTestSuite()
} else {
  main()
}
