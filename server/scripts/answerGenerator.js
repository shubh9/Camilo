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

async function getSegmentsByUrl(url) {
    try {
        const { data, error } = await supabase
            .from('shubhsblogs') // Replace 'segments' with your actual table name
            .select('*')
            .eq('url', url);

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error fetching segments by URL:', error);
        throw error;
    }
}

async function generateAnswer(question, articleUrl) {
    try {
        // Get relevant context using the new method
        const { allSegments, topSimilarQuestions, topSimilarConversations } = await aiService.getRelevantContext(question);
        
        // Add the article content as an additional context
        const currArticleSegments = await getSegmentsByUrl(articleUrl);
        allSegments.unshift(...currArticleSegments);

        // Generate the answer using all available context
        const answer = await aiService.createChatCompletion(
            question, 
            allSegments,
            topSimilarQuestions,
            topSimilarConversations
        );

        // Extract segment references like [n] from the answer
        const ids = [];
        const regex = /\[(\d+)\]/g;
        let match;
        while ((match = regex.exec(answer)) !== null) {
            const id = match[1];
            if (!ids.includes(id)) {
                ids.push(id);
            }
        }

        // Remove the segment references from the answer
        const cleanedAnswer = answer.replace(regex, '');

        return {
            question,
            answer: cleanedAnswer,
            ids
        };
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
            for (const articleQuestion of article.questions) {
                try {
                    console.log(`Processing question: ${articleQuestion}`);
                    
                    const { question, answer, ids } = await generateAnswer(
                        articleQuestion, 
                        article.url
                    );

                    questionsAndAnswers.push({
                        question,
                        answer,
                        ids
                    });

                    totalQuestionsProcessed++;
                    console.log(`Processed question ${totalQuestionsProcessed}: ${question}`);
                } catch (error) {
                    console.error(`Failed to process question: ${articleQuestion}`, error);
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