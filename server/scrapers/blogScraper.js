const cheerio = require('cheerio');
const HttpClient = require('../utils/httpClient');
const { SCRAPER_CONFIG } = require('./constants');

class BlogScraper {
    constructor() {
        this.httpClient = new HttpClient();
        this.allArticles = [];
    }

    async scrape() {
        try {
            const monthUrls = this.generateMonthUrls();
            
            for (const monthUrl of monthUrls) {
                console.log(`\nProcessing month: ${monthUrl}`);
                try {
                    const archiveHtml = await this.httpClient.fetchPage(monthUrl);
                    const articleUrls = this.extractArticleUrls(archiveHtml);
                    
                    if (articleUrls.length === 0) {
                        console.log(`No articles found for ${monthUrl}`);
                        continue;
                    }

                    console.log(`Found ${articleUrls.length} articles`);
                    const articles = await this.scrapeArticles(articleUrls);
                    this.allArticles.push(...articles);
                    
                    // Add a delay between months to be extra polite
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Failed to process month ${monthUrl}:`, error.message);
                }
            }

            return this.allArticles;
        } catch (error) {
            console.error('Scraping failed:', error.message);
            throw error;
        }
    }

    generateMonthUrls() {
        const urls = [];
        let currentYear = SCRAPER_CONFIG.START_DATE.YEAR;
        let currentMonth = SCRAPER_CONFIG.START_DATE.MONTH;
        const endYear = SCRAPER_CONFIG.END_DATE.YEAR;
        const endMonth = SCRAPER_CONFIG.END_DATE.MONTH;

        while (
            currentYear < endYear || 
            (currentYear === endYear && currentMonth <= endMonth)
        ) {
            const monthStr = currentMonth.toString().padStart(2, '0');
            urls.push(`${SCRAPER_CONFIG.BASE_URL}/${currentYear}/${monthStr}/`);

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        return urls;
    }

    extractArticleUrls(html) {
        const $ = cheerio.load(html);
        const urls = [];

        $(SCRAPER_CONFIG.SELECTORS.ARTICLE_CONTAINER).each((_, article) => {
            const readMoreLink = $(article).find(SCRAPER_CONFIG.SELECTORS.READ_MORE_LINK);
            const url = readMoreLink.attr('href');
            if (url) {
                urls.push(url);
            }
        });

        return urls;
    }

    async scrapeArticles(urls) {
        const articles = [];

        for (const url of urls) {
            try {
                console.log(`Scraping article: ${url}`);
                const html = await this.httpClient.fetchPage(url);
                const articleData = this.parseArticle(html);
                articles.push({
                    url,
                    ...articleData,
                });

                // Add a small delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to scrape article ${url}:`, error.message);
            }
        }

        return articles;
    }

    parseArticle(html) {
        const $ = cheerio.load(html);
        
        return {
            title: $(SCRAPER_CONFIG.SELECTORS.POST_TITLE).first().text().trim(),
            content: $(SCRAPER_CONFIG.SELECTORS.POST_CONTENT).first().text().trim()
        };
    }
}

module.exports = BlogScraper; 