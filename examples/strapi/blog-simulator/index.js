import axios from 'axios';
import faker from 'faker';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123';

// Login to Strapi and get JWT token
const login = async () => {
  try {
    console.log('Logging in to Strapi...');
    const response = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('Login successful!');
    return response.data.data.token;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw new Error('Failed to login to Strapi');
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Wait for Strapi to be fully up and running
const waitForStrapi = async () => {
  console.log('Waiting for Strapi to be ready...');
  let isReady = false;
  while (!isReady) {
    try {
      await axios.get(`${STRAPI_URL}/_health`);
      isReady = true;
      console.log('Strapi is ready!');
    } catch (error) {
      console.log('Strapi not ready yet, retrying in 5 seconds...');
      await sleep(5000);
    }
  }
};

// Create a set of authors
const createAuthors = async (jwt) => {
  console.log('Creating authors...');
  const authors = [];

  for (let i = 0; i < 50; i++) {
    const authorData = {
      name: faker.name.findName(),
      email: faker.internet.email(),
      bio: faker.lorem.paragraph(),
      twitter: `@${faker.internet.userName()}`
    };

    try {
      const response = await axios.post(
        `${STRAPI_URL}/authors`,
        authorData,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      authors.push(response.data);
      console.log(`Created author: ${authorData.name}`);
    } catch (error) {
      console.error('Error creating author:', error.response?.data || error.message);
    }
  }

  return authors;
};

// Create a set of tags
const createTags = async (jwt) => {
  console.log('Creating tags...');
  const tagNames = ['Technology', 'Programming', 'Design', 'AI', 'Web Development',
                    'DevOps', 'Cloud', 'Security', 'Mobile', 'Data Science'];
  const tags = [];

  for (const name of tagNames) {
    try {
      const response = await axios.post(
        `${STRAPI_URL}/tags`,
        { name },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      tags.push(response.data);
      console.log(`Created tag: ${name}`);
    } catch (error) {
      console.error(`Error creating tag ${name}:`, error.response?.data || error.message);
    }
  }

  return tags;
};

// Create blog posts
const createBlogPosts = async (jwt, authors, tags) => {
  console.log('Creating blog posts...');

  for (let i = 0; i < 500; i++) {
    // Select a random author and 1-3 random tags
    const author = authors[Math.floor(Math.random() * authors.length)];
    const numTags = Math.floor(Math.random() * 3) + 1;
    const selectedTags = [41, 42, 43, 44, 45, 46, 47, 48, 49].sort((a,b) => Math.random() > 0.5?1: -1).slice(0, numTags)

    /*
    const selectedTags = [];

    const tagsCopy = [...tags];
    for (let j = 0; j < numTags; j++) {
      if (tagsCopy.length === 0) break;
      const randomIndex = Math.floor(Math.random() * tagsCopy.length);
      selectedTags.push(tagsCopy[randomIndex].id);
      tagsCopy.splice(randomIndex, 1);
    }
    */

    const postData = {
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(5),
      excerpt: faker.lorem.paragraph(),
      publish_date: faker.date.past(1),
      author: author.id,
      tags: selectedTags
    };

    try {
      const response = await axios.post(
        `${STRAPI_URL}/articles`,
        postData,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      console.log(`Created blog post: ${postData.title}`, selectedTags);
    } catch (error) {
      console.error('Error creating blog post:', error.response?.data || error.message);
    }
  }
};

// Main execution function
const run = async () => {
  try {
    await waitForStrapi();

    // Get JWT token through login
    const jwt = await login();
    if (!jwt) {
      console.error('Failed to get JWT token');
      return;
    }

    //const authors = await createAuthors(jwt);
    //const tags = await createTags(jwt);

    const authors = [{"id":286},{"id":287},{"id":288},{"id":289},{"id":290},{"id":291},{"id":292},{"id":293},{"id":294},{"id":295},{"id":296},{"id":297},{"id":298},{"id":299},{"id":300},{"id":301},{"id":302},{"id":303},{"id":304},{"id":305},{"id":306},{"id":307},{"id":308},{"id":309},{"id":310},{"id":311},{"id":312},{"id":313},{"id":314},{"id":315},{"id":316},{"id":317},{"id":318},{"id":319},{"id":320},{"id":321},{"id":322},{"id":323},{"id":324},{"id":325},{"id":326},{"id":327},{"id":328},{"id":329},{"id":330},{"id":331},{"id":332},{"id":333},{"id":334},{"id":335}]

    await createBlogPosts(jwt, authors, /*tags*/ undefined);

    console.log('Blog simulation complete!');
  } catch (error) {
    console.error('Error in blog simulation:', error);
  }
};

run();
