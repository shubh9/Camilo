require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateQuestions(content) {
    try {
        const prompt = `
        Based on the following blog post content, generate questions and their detailed answers. 
        Questions should be about focused on the topics of entrepreneurship, mental health, work life balance, finding your meaning in life, how to live your life, staying motivated, how to run a company and the biogragphy of Shubh's life. 
        Very important! The questions should be in interview format!
        Never refer to the blog or say the word Shubh, imagine you are interviewing Shubh! So questions like 
        When did you start your company?
        What are your thoughts on donating to charity?
        What is one of the hardest things you have faced in your life?
        How do you deal with stress?

        In the answer be very mindful of the date of the context. If it's something like where did you work and you're looking at a date of 2020, then the answer should be something like I worked at XYZ company in 2020.

        Format the output as a array of strings, where each string is a question. ["question1", "question2", "question3"]
        Only include questions that can be directly answered from the given content.
        
        Blog content:
        ${content}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: "You are an interviewer generating questions based on blog post content. Generate direct interview-style questions that can be answered from the content."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });
        console.log(`Generated questions ${response.choices[0].message.content}`);


        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
    }
}

async function processInBatches(items, batchSize = 1) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

async function main() {
    try {
        // Read the scraped articles
        const filePath = path.join(__dirname, '..', 'data', 'scraped_articles_2024-11-09T07-00-14-048Z.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const articles = JSON.parse(fileContent);

        console.log(`Processing ${articles.length} articles for question generation...`);

        const batches = await processInBatches(articles);
        let processedCount = 0;
        const allQuestions = [];
        let questionCount = 0;

        for (const batch of batches) {
            console.log("number of questions", questionCount);
            if (questionCount >= 20) {
                break;
            }
            for (const article of batch) {
                try {
                    const questions = await generateQuestions(article.content);
                    console.log(`Generated questions ${questions}`);
                    
                    allQuestions.push({
                        url: article.url,
                        title: article.title,
                        content: article.content,
                        questions: questions
                    });
                    questionCount += questions.length;

                    processedCount++;
                    console.log(`Processed ${processedCount}/${articles.length} articles`);

                    // Add delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to process article ${article.url}:`, error);
                }
            }
        }

        // Save the questions data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(__dirname, '..', 'data', `questions_${timestamp}.json`);
        await fs.writeFile(outputPath, JSON.stringify(allQuestions, null, 2));

        console.log('\nQuestion generation completed successfully!');
        console.log(`Total articles processed: ${processedCount}`);
        console.log(`Output saved to: ${outputPath}`);

    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main(); 