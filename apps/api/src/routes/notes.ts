import { Router, Request, Response } from 'express';
import client from '../weaviateClient';
import axios from 'axios';

const router: Router = Router();

const DEFAULT_USER_ID = 'user1';

// Helper to call Gemini API
async function getSummaryAndTags(transcript: string): Promise<{ summary: string; tags: string[] }> {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set for summarization and tagging');
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const prompt = `Summarize the following note in a single sentence and suggest 3-5 relevant tags as a JSON array.\nNote: "${transcript}"\nRespond ONLY with a valid JSON object in this format: {\"summary\": \"...\", \"tags\": [\"tag1\", \"tag2\"]}`;

    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
      // Clean the response to get only the JSON part
      const jsonString = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonString);
      return {
        summary: parsed.summary || 'Could not generate summary.',
        tags: parsed.tags || [],
      };
    }
  } catch (error: any) {
    console.error('Error calling Gemini API for summary/tags:', error.response?.data || error.message);
  }
  // Return default values if API call fails
  return { summary: 'Summary not available.', tags: [] };
}


// POST /api/notes - Create a new note
router.post('/', async (req: Request, res: Response) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const { summary, tags } = await getSummaryAndTags(transcript);

  const noteData = {
    transcript,
    summary,
    tags: tags.join(', '), // Join tags into a single string
    userId: DEFAULT_USER_ID,
    createdAt: new Date().toISOString(),
  };




  try {
    const result = await client.data
      .creator()
      .withClassName('Note')
      .withProperties(noteData)
      .do();

    res.status(201).json({
      id: result.id,
      ...noteData,
    });
  } catch (dbError) {
    console.error('Error saving note to Weaviate:', dbError);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// GET /api/notes - Get all notes
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await client.graphql
      .get()
      .withClassName('Note')
      .withFields('_additional { id } transcript summary tags createdAt')
      .withSort([{ path: ['createdAt'], order: 'desc' }])
      .do();

    const notes = result.data.Get.Note.map((note: any) => ({
      id: note._additional.id,
      transcript: note.transcript,
      summary: note.summary,
      tags: note.tags,
      createdAt: note.createdAt,
    }));

    res.json(notes);
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/search - Search notes using RAG
router.get('/search', async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const result = await client.graphql
      .get()
      .withClassName('Note')
      .withFields('transcript summary tags _additional { id score }')
      .withNearText({
        concepts: [query],
      })
      .do();

    const notes = result.data.Get.Note.map((note: any) => ({
      id: note._additional.id,
      score: note._additional.score,
      transcript: note.transcript,
      summary: note.summary,
      tags: note.tags,
    }));

    res.json(notes);
  } catch (error: any) {
    console.error('Error searching notes:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to search notes', details: error.message });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body; // Expecting tags as a comma-separated string

  if (typeof tags !== 'string') {
    return res.status(400).json({ error: 'Tags must be a string' });
  }

  try {
    await client.data
      .updater()
      .withId(id)
      .withClassName('Note')
      .withProperties({
        tags: tags,
      })
      .do();

    res.status(200).json({ message: 'Note updated successfully' });
  } catch (error: any) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note', details: error.message });
  }
});

export default router; 