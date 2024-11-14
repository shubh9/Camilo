require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const aiService = require('./services/aiService');

const app = express();
const port = 3001;

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());

async function findSimilarSegments(embedding) {
    const { data, error } = await supabase.rpc('match_segments', {
        query_embedding: embedding,
        match_threshold: 0.2,
        match_count: 5
    });

    if (error) throw error;
    return data;
}

app.post('/message', async (req, res) => {
    const { message } = req.body;
    
    try {
        // 1. Generate embedding for the user's message
        console.log('Generating embedding for:', message);
        const embedding = await aiService.generateEmbedding(message);

        // 2. Find similar segments in Supabase
        console.log('Finding similar segments...');
        const similarSegments = await findSimilarSegments(embedding);

        // 3. Generate response using OpenAI with context
        console.log('Generating response with context...');
        const reply = await aiService.createChatCompletion(message, similarSegments);
        console.log(`Complete: ${reply}`);

        // 4. Send response
        res.json({ 
            reply,
            context: similarSegments.map(seg => ({
                content: seg.content.substring(0, 150) + '...',
                similarity: seg.similarity
            }))
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
