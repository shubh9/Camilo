require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export async function generateEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-large",
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

async function processInBatches(items, batchSize = 100) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

async function saveToSupabase(paragraphs) {
    try {
        const { data, error } = await supabase
            .from('shubhswords')
            .insert(paragraphs);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
    }
}

async function main() {
    try {
        // Read the processed articles
        const filePath = path.join(__dirname, '..', 'data', 'processed_segments_2024-11-08-23-40.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const segments = JSON.parse(fileContent);

        console.log(`Processing ${segments.length} segments...`);

        // Process in batches to avoid rate limits and memory issues
        const batches = await processInBatches(segments);
        let processedCount = 0;

        for (const batch of batches) {
            const embeddingsData = [];

            // Generate embeddings for each segment in the batch
            for (const segment of batch) {
                try {
                    const embedding = await generateEmbedding(segment.content);
                    
                    embeddingsData.push({
                        url: segment.url,
                        title: segment.title,
                        content: segment.content,
                        segment: segment.segment,
                        embedding
                    });

                    processedCount++;
                    if (processedCount % 10 === 0) {
                        console.log(`Processed ${processedCount}/${segment.length} segments`);
                    }

                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.error(`Failed to process segment ${segment.segment} from ${segment.url}:`, error);
                }
            }

            // Save batch to Supabase
            if (embeddingsData.length > 0) {
                await saveToSupabase(embeddingsData);
                console.log(`Saved batch of ${embeddingsData.length} embeddings to Supabase`);
            }
        }

        console.log('\nProcessing completed successfully!');
        console.log(`Total segments processed: ${processedCount}`);

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main(); 