const axios = require('axios');

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

// Wait for Strapi to be ready
const waitForStrapi = async () => {
  console.log('Waiting for Strapi to be ready...');
  let isReady = false;
  while (!isReady) {
    try {
      await axios.get(`${STRAPI_URL}/admin/init`);
      isReady = true;
      console.log('Strapi is ready!');
    } catch (error) {
      console.log('Strapi not ready yet, retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Create Author content type
const createAuthorContentType = async (jwt) => {
  try {
    console.log('Creating Author content type...');
    
    const authorData = {
      contentType: {
        name: 'author',
        kind: 'collectionType',
        connection: 'default',
        collectionName: 'authors',
        attributes: {
          name: {
            type: 'string',
            required: true
          },
          email: {
            type: 'email',
            required: true,
            unique: true
          },
          bio: {
            type: 'text'
          },
          twitter: {
            type: 'string'
          }
        }
      }
    };
    
    const response = await axios.post(
      `${STRAPI_URL}/content-type-builder/content-types`,
      authorData,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    
    console.log('Author content type created successfully!');
    return response.data;
  } catch (error) {
    console.error('Error creating Author content type:', error.response?.data || error.message);
    throw error;
  }
};

// Create Tag content type
const createTagContentType = async (jwt) => {
  try {
    console.log('Creating Tag content type...');
    
    const tagData = {
      contentType: {
        name: 'tag',
        kind: 'collectionType',
        connection: 'default',
        collectionName: 'tags',
        attributes: {
          name: {
            type: 'string',
            required: true,
            unique: true
          }
        }
      }
    };
    
    const response = await axios.post(
      `${STRAPI_URL}/content-type-builder/content-types`,
      tagData,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    
    console.log('Tag content type created successfully!');
    return response.data;
  } catch (error) {
    console.error('Error creating Tag content type:', error.response?.data || error.message);
    throw error;
  }
};

// Create Article content type
const createArticleContentType = async (jwt) => {
  try {
    console.log('Creating Article content type...');
    
    const articleData = {
      contentType: {
        name: 'article',
        kind: 'collectionType',
        connection: 'default',
        collectionName: 'articles',
        attributes: {
          title: {
            type: 'string',
            required: true
          },
          content: {
            type: 'richtext',
            required: true
          },
          excerpt: {
            type: 'text'
          },
          publish_date: {
            type: 'date'
          },
          // For Strapi 3.6, we need to use model/collection syntax
          author: {
            model: 'author'   // Reference to author model
          },
          tags: {
            collection: 'tag'  // Reference to tag collection
          }
        }
      }
    };
    
    const response = await axios.post(
      `${STRAPI_URL}/content-type-builder/content-types`,
      articleData,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    
    console.log('Article content type created successfully!');
    return response.data;
  } catch (error) {
    console.error('Error creating Article content type:', error.response?.data || error.message);
    throw error;
  }
};

// Update Author content type to add relation to articles
const updateAuthorWithRelation = async (jwt) => {
  try {
    console.log('Updating Author with relation to articles...');
    
    const updateData = {
      contentType: {
        name: 'author',
        kind: 'collectionType',
        connection: 'default',
        collectionName: 'authors',
        attributes: {
          name: {
            type: 'string',
            required: true
          },
          email: {
            type: 'email',
            required: true,
            unique: true
          },
          bio: {
            type: 'text'
          },
          twitter: {
            type: 'string'
          },
          // For Strapi 3.6
          articles: {
            collection: 'article',
            via: 'author'
          }
        }
      }
    };
    
    const response = await axios.put(
      `${STRAPI_URL}/content-type-builder/content-types/application::author.author`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    
    console.log('Author updated with relation to articles!');
    return response.data;
  } catch (error) {
    console.error('Error updating Author:', error.response?.data || error.message);
    throw error;
  }
};

// Update Tag content type to add relation to articles
const updateTagWithRelation = async (jwt) => {
  try {
    console.log('Updating Tag with relation to articles...');
    
    const updateData = {
      contentType: {
        name: 'tag',
        kind: 'collectionType',
        connection: 'default',
        collectionName: 'tags',
        attributes: {
          name: {
            type: 'string',
            required: true,
            unique: true
          },
          // For Strapi 3.6
          articles: {
            collection: 'article',
            via: 'tags'
          }
        }
      }
    };
    
    const response = await axios.put(
      `${STRAPI_URL}/content-type-builder/content-types/application::tag.tag`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    );
    
    console.log('Tag updated with relation to articles!');
    return response.data;
  } catch (error) {
    console.error('Error updating Tag:', error.response?.data || error.message);
    throw error;
  }
};

// Main function
const createContentTypes = async () => {
  try {
    await waitForStrapi();
    const jwt = await login();
    
    // Create content types
    //await createAuthorContentType(jwt);
    //await createTagContentType(jwt);
    await createArticleContentType(jwt);
    
    // Add relations
    await updateAuthorWithRelation(jwt);
    await updateTagWithRelation(jwt);
    
    console.log('All content types created successfully!');
    
  } catch (error) {
    console.error('Error creating content types:', error);
  }
};

createContentTypes();
