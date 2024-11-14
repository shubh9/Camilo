const BlogScraper = require('../scrapers/blogScraper');
const fs = require('fs').promises;
const path = require('path');

async function saveArticlesToFile(articles) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scraped_articles_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'data', filename);

    // Ensure the data directory exists
    await fs.mkdir(path.join(__dirname, '..', 'data'), { recursive: true });

    // Save articles to file
    await fs.writeFile(
        filepath,
        JSON.stringify(articles, null, 2),
        'utf8'
    );

    return filepath;
}

async function main() {
    try {
        const scraper = new BlogScraper();
        console.log('Starting scraping process...');
        
        const articles = await scraper.scrape();
        
        console.log('\nScraping completed successfully!');
        console.log(`Total articles found: ${articles.length}`);

        // Save articles to file
        const filepath = await saveArticlesToFile(articles);
        console.log(`\nArticles saved to: ${filepath}`);
        
        // Print summary
        console.log('\nSummary of articles:');
        articles.forEach((article, index) => {
            console.log(`\n=== Article ${index + 1} ===`);
            console.log('URL:', article.url);
            console.log('Title:', article.title);
            console.log('Content Length:', article.content.length);
            console.log('-'.repeat(50));
        });
    } catch (error) {
        console.error('Scraping failed:', error.message);
        process.exit(1);
    }
}

main(); 