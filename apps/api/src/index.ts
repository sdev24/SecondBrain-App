import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import notesRouter from './routes/notes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware
app.use(cors()); // Allow all origins for simplicity
app.use(express.json());

// API routes
app.use('/api/notes', notesRouter);

// Serve the HTML frontend
const projectRoot = path.join(__dirname, '..', '..', '..'); // Navigate up to the project root
app.use(express.static(projectRoot));
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'voice_notes_fixed.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}); 