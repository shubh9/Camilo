// Configuration and constants for the scraper
const SCRAPER_CONFIG = {
    START_DATE: {
        YEAR: 2020,
        MONTH: 3 // March
    },
    END_DATE: {
        YEAR: 2024,
        MONTH: 9 // September
    },
    BASE_URL: 'https://trusttheproce55.blogspot.com',
    TIMEOUT: 10000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    SELECTORS: {
        ARTICLE_CONTAINER: '.post-outer-container',
        READ_MORE_LINK: 'a[title]',
        POST_TITLE: '.post-title',
        POST_CONTENT: '.post-body'
    }
};

module.exports = {
    SCRAPER_CONFIG
}; 