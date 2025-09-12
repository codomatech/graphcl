const fs = require('fs');
const path = require('path');

// Schema definitions
const authorSchema = {
  "kind": "collectionType",
  "collectionName": "authors",
  "info": {
    "singularName": "author",
    "pluralName": "authors",
    "displayName": "Author",
    "description": "Content authors for the blog"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "email",
      "required": true,
      "unique": true
    },
    "bio": {
      "type": "text"
    },
    "twitter": {
      "type": "string"
    },
    "articles": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::article.article",
      "mappedBy": "author"
    }
  }
};

const tagSchema = {
  "kind": "collectionType",
  "collectionName": "tags",
  "info": {
    "singularName": "tag",
    "pluralName": "tags",
    "displayName": "Tag",
    "description": "Category tags for articles"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "articles": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::article.article",
      "mappedBy": "tags"
    }
  }
};

const articleSchema = {
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article",
    "description": "Blog posts and articles"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "content": {
      "type": "richtext",
      "required": true
    },
    "excerpt": {
      "type": "text"
    },
    "published_at": {
      "type": "datetime"
    },
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::author.author",
      "inversedBy": "articles"
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::tag.tag",
      "inversedBy": "articles"
    }
  }
};

// Directory paths
const contentTypes = [
  {
    name: 'author',
    schema: authorSchema
  },
  {
    name: 'tag',
    schema: tagSchema
  },
  {
    name: 'article',
    schema: articleSchema
  }
];

// Function to create directory recursively if it doesn't exist
const mkdirRecursive = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

// Function to create schema file
const createSchemaFile = (contentType, schema) => {
  const dirPath = path.join( 'api', contentType, 'content-types', contentType);
  const filePath = path.join(dirPath, 'schema.json');
  
  mkdirRecursive(dirPath);
  
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
  console.log(`Created schema file: ${filePath}`);
};

// Main function to install schemas
const installSchemas = () => {
  console.log('Installing Strapi schemas...');
  
  // Determine base path
  const basePath = process.cwd();
  console.log(`Working in directory: ${basePath}`);
  
  // Create schemas
  contentTypes.forEach(ct => {
    createSchemaFile(ct.name, ct.schema);
  });
  
  console.log('Schema installation complete!');
  console.log('Please restart your Strapi server to apply these changes.');
};

// Run the installer
installSchemas();
