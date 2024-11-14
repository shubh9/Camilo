const fs = require('fs').promises;
const path = require('path');

async function analyzeParagraphs() {
    try {
        // Read the JSON file
        const filePath = path.join(__dirname, '..', 'data', 'scraped_articles_2024-11-08T21-59-47-014Z.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const articles = JSON.parse(fileContent);

        // Array to store all paragraphs with their metadata
        const allParagraphs = [];

        // Process each article
        articles.forEach((article, articleIndex) => {
            // Split content into paragraphs (split by double newline or more)
            const paragraphs = article.content.split(/\n\s*\n/);
            
            paragraphs.forEach((paragraph, paragraphIndex) => {
                // Clean the paragraph and check if it's not empty
                const cleanParagraph = paragraph.trim();
                if (cleanParagraph.length > 0) {
                    allParagraphs.push({
                        length: cleanParagraph.length,
                        text: cleanParagraph,
                        articleTitle: article.title,
                        articleUrl: article.url,
                        paragraphIndex
                    });
                }
            });
        });

        // Sort paragraphs by length (descending) and get top 5
        const top5Paragraphs = allParagraphs
            .sort((a, b) => b.length - a.length)
            .slice(0, 50);

        // Print results
        console.log('Top 5 Longest Paragraphs:\n');
        top5Paragraphs.forEach((para, index) => {
            console.log(`#${index + 1} - ${para.length} characters`);
            console.log(`From article: ${para.articleTitle}`);
            console.log(`URL: ${para.articleUrl}`);
            console.log(`Paragraph #${para.paragraphIndex + 1} in the article`);
            console.log('\nExcerpt (first 150 chars):');
            console.log(para.text.substring(0, 150) + '...\n');
            console.log('-'.repeat(80) + '\n');
        });

    } catch (error) {
        console.error('Error analyzing paragraphs:', error);
        process.exit(1);
    }
}

analyzeParagraphs(); 