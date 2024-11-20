require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const aiService = require('../services/aiService');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function processInBatches(items, batchSize = 100) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

async function saveToSupabase(conversationData) {
    try {
        const { data, error } = await supabase
            .from('conversations')
            .insert(conversationData);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
    }
}

async function extractUserMessages(conversation) {
    return conversation.conversation
        .filter(msg => !msg.isAI)
        .map(msg => msg.content)
        .join(' ');
}

async function main() {
    try {
        const filePath = path.join(__dirname, '..', 'data', 'conversation2');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const conversations = JSON.parse(fileContent);

        console.log(`Processing ${conversations.length} conversations...`);

        // Process in batches to avoid rate limits and memory issues
        const batches = await processInBatches(conversations);
        let processedCount = 0;

        for (const batch of batches) {
            const conversationData = [];

            // Generate embeddings for each conversation in the batch
            for (const conversation of batch) {
                try {
                    // Concatenate all non-AI messages and generate embedding
                    const userMessages = await extractUserMessages(conversation);
                    const embedding = await aiService.generateEmbedding(userMessages);
                    
                    conversationData.push({
                        content: conversation,
                        embedding: embedding
                    });

                    processedCount++;
                    if (processedCount % 10 === 0) {
                        console.log(`Processed ${processedCount}/${conversations.length} conversations`);
                    }

                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.error('Failed to process conversation:', error);
                }
            }

            // Save batch to Supabase
            if (conversationData.length > 0) {
                await saveToSupabase(conversationData);
                console.log(`Saved batch of ${conversationData.length} conversations to Supabase`);
            }
        }

        console.log('\nProcessing completed successfully!');
        console.log(`Total conversations processed: ${processedCount}`);

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main(); 