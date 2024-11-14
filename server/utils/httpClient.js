const axios = require('axios');
const { SCRAPER_CONFIG } = require('../scrapers/constants');

class HttpClient {
    constructor() {
        this.client = axios.create({
            timeout: SCRAPER_CONFIG.TIMEOUT,
            headers: {
                'User-Agent': SCRAPER_CONFIG.USER_AGENT
            }
        });
    }

    async fetchPage(url) {
        try {
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching page:', error.message);
            throw new Error(`Failed to fetch page: ${error.message}`);
        }
    }
}

module.exports = HttpClient; 