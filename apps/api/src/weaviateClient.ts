import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import dotenv from 'dotenv';

dotenv.config();

const weaviateUrl = process.env.WEAVIATE_URL;
const weaviateApiKey = process.env.WEAVIATE_API_KEY;

if (!weaviateUrl || !weaviateApiKey) {
  throw new Error('WEAVIATE_URL and WEAVIATE_API_KEY environment variables are required');
}

const openAIApiKey = process.env.OPENAI_API_KEY;
if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required for Weaviate vectorization');
}

// Determine scheme and host from the full URL
const url = new URL(weaviateUrl.startsWith('http') ? weaviateUrl : `https://${weaviateUrl}`);
const scheme = url.protocol.replace(':', '');
const host = url.host;

if (scheme !== 'https') {
    console.warn("Warning: Connecting to Weaviate with an insecure scheme (http). It's recommended to use https.")
}

export const client: WeaviateClient = weaviate.client({
  scheme: scheme as 'http' | 'https',
  host: host,
  apiKey: new weaviate.ApiKey(weaviateApiKey),
  headers: {
    'X-OpenAI-Api-Key': openAIApiKey,
  },
});

// Define the Note class schema
const NoteSchema = {
  class: 'Note',
  description: 'A class to store voice notes with transcripts, summaries, and tags',
  vectorizer: 'text2vec-openai',
  moduleConfig: {
    'text2vec-openai': {
      model: 'ada', // Or 'text-embedding-3-small', 'text-embedding-3-large'
      type: 'text',
    },
  },
  properties: [
    {
      name: 'transcript',
      dataType: ['text'],
      description: 'The full transcript of the voice note',
      moduleConfig: {
        'text2vec-openai': {
          skip: false, // Vectorize this property
          vectorizePropertyName: false,
        },
      },
    },
    {
      name: 'summary',
      dataType: ['text'],
      description: 'A summary of the voice note',
      moduleConfig: {
        'text2vec-openai': {
          skip: false, // Vectorize this property
          vectorizePropertyName: false,
        },
      },
    },
    {
      name: 'tags',
      dataType: ['text'],
      description: 'Tags associated with the voice note',
      moduleConfig: {
        'text2vec-openai': {
          skip: false, // Vectorize this property
          vectorizePropertyName: false,
        },
      },
    },
    {
      name: 'userId',
      dataType: ['text'],
      description: 'The ID of the user who created the note',
      moduleConfig: {
        'text2vec-openai': {
          skip: true, // Do not vectorize this property
        },
      },
    },
    {
      name: 'createdAt',
      dataType: ['date'],
      description: 'The timestamp when the note was created',
      moduleConfig: {
        'text2vec-openai': {
          skip: true, // Do not vectorize this property
        },
      },
    },
  ],
};

// Function to create schema if it doesn't exist
async function createSchema() {
  const existingClasses = await client.schema.getter().do();
  const classExists = existingClasses.classes?.some(c => c.class === NoteSchema.class);

  if (!classExists) {
    console.log(`Creating Weaviate schema for class: ${NoteSchema.class}`);
    await client.schema.classCreator().withClass(NoteSchema).do();
    console.log(`Schema for class ${NoteSchema.class} created successfully.`);
  } else {
    console.log(`Schema for class ${NoteSchema.class} already exists.`);
  }
}

// Test connection and create schema on startup
(async () => {
  try {
    const ready = await client.misc.liveChecker().do();
    console.log('Weaviate connection is ready:', ready);
    await createSchema(); // Create schema after successful connection
  } catch (err) {
    console.error('Failed to connect to Weaviate or create schema. Please check your WEAVIATE_URL, WEAVIATE_API_KEY, and OPENAI_API_KEY.', err);
    process.exit(1); // Exit if cannot connect or create schema
  }
})();

export default client; 