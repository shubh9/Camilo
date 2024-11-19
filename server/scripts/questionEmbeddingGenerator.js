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

async function saveToSupabase(qaData) {
    try {
        const { data, error } = await supabase
            .from('questionanswer')
            .insert(qaData);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
    }
}

async function main() {
    try {

        const filePath = path.join(__dirname, '..', 'data', 'answered_questions_manual.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const questionContent = JSON.parse(fileContent);

        console.log(`Processing ${questionContent.length} questions...`);

        // Process in batches to avoid rate limits and memory issues
        const batches = await processInBatches(questionContent);
        let processedCount = 0;

        for (const batch of batches) {
            const qaData = [];

            // Generate embeddings for each question in the batch
            for (const qaElement of batch) {
                try {
                    const questionVec = await aiService.generateEmbedding(qaElement.question);
                    
                    qaData.push({
                        question: qaElement.question,
                        questionVec: questionVec,
                        answer: qaElement.answer || null,
                        relevantSegments: qaElement.ids || []
                    });

                    processedCount++;
                    if (processedCount % 10 === 0) {
                        console.log(`Processed ${processedCount}/${questionContent.length} questions`);
                    }

                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.error(`Failed to process question: ${qaElement.question}:`, error);
                }
            }

            // Save batch to Supabase
            if (qaData.length > 0) {
                await saveToSupabase(qaData);
                console.log(`Saved batch of ${qaData.length} questions to Supabase`);
            }
        }

        console.log('\nProcessing completed successfully!');
        console.log(`Total questions processed: ${processedCount}`);

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main(); 