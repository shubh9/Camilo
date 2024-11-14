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

async function findSimilarSegments(embedding) {
    const { data, error } = await supabase.rpc('match_segments', {
        query_embedding: embedding,
        match_threshold: 0.2,
        match_count: 4
    });

    if (error) throw error;
    return data;
}

async function generateAnswer(question, articleContent, articleUrl, similarSegments) {
    try {
        // Combine article content with similar segments
        const combinedContext = [
            { content: articleContent, url: articleUrl },
            ...similarSegments
        ];

        const answer = await aiService.createChatCompletion(question, combinedContext);
        return answer;
    } catch (error) {
        console.error('Error generating answer:', error);
        throw error;
    }
}

async function main() {
    try {
        // Read the questions file
        const questionsPath = path.join(__dirname, '..', 'data', 'questions_2024-11-13T23-42-48-884Z.json');
        const questionsContent = await fs.readFile(questionsPath, 'utf8');
        const articlesWithQuestions = JSON.parse(questionsContent);

        console.log(`Processing answers for ${articlesWithQuestions.length} articles...`);

        let totalQuestionsProcessed = 0;
        const questionsAndAnswers = [];

        for (const article of articlesWithQuestions) {
            
            for (const question of article.questions) {
                try {
                    // Generate embedding for the question
                    const embedding = await aiService.generateEmbedding(question);
                    
                    // Find similar segments using RAG
                    const similarSegments = await findSimilarSegments(embedding);
                    
                    // Generate answer using both original content and similar segments
                    const answer = await generateAnswer(
                        question, 
                        article.content, 
                        article.url,
                        similarSegments
                    );

                    questionsAndAnswers.push({
                        question,
                        answer
                    });
                    

                    totalQuestionsProcessed++;
                    console.log(`Processed question ${totalQuestionsProcessed}: ${question}`);

                    // Add delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to process question: ${question}`, error);
                }
            }
        }

        // Save the answered questions
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(__dirname, '..', 'data', `answered_questions_${timestamp}.json`);
        await fs.writeFile(outputPath, JSON.stringify(questionsAndAnswers, null, 2));

        console.log('\nAnswer generation completed successfully!');
        console.log(`Total questions processed: ${totalQuestionsProcessed}`);
        console.log(`Output saved to: ${outputPath}`);

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main(); 