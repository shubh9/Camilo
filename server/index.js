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

// Configure CORS with specific options
const corsOptions = {
    origin: ['*'],
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/message', async (req, res) => {
    const { messages } = req.body;
    // Filter to get only user messages
    const userMessages = messages.filter(message => message.isAI === false);
    // Get the last 4 user messages
    const lastUserMessages = userMessages.slice(-4);
    
    try {
        // Get relevant context using the new method
        const { allSegments, topSimilarQuestions, topSimilarConversations } = await aiService.getRelevantContext(lastUserMessages.map(msg => msg.content));
        
        console.log('Generating response with context...');
        const reply = await aiService.createChatCompletion(
            messages,
            allSegments,
            topSimilarQuestions,
            topSimilarConversations
        );

        // Extract unique segment IDs and URLs from the context segments
        const linkData = allSegments.reduce((acc, segment) => {
            acc[segment.id] = segment.url;
            return acc;
        }, {});

        res.json({ 
            reply,
            linkData
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
}

module.exports = app;