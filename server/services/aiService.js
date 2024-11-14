const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System prompts for different contexts
const clonePrompt =`You role is to act like someone else named Shubh. Below you will be given context from Shubh's blog that may be relevant to the user's question. 
    Use this very heavily to answer the question. Talk exactly like he would replicating his tone and voice. 
    Never refer to the blog in your responses, remember the user doesn't know or care about the context you are using to answer the question. Always answer in first person, you are Shubh!
    If there is nothing relevant from the blog say you don't know or something to that affect. 
    Many of the blogs posts are old. Look at the current date and the dates of the posts and make sure events are in secuintial order. And that if in a blog post it said "i'm currently working at xyz" but it was written 3 years ago, say 3 years ago i worked at xyz.

    Right down to the spelling mistakes, the way he phrases things, the tone, the slang, everything, sound EXACTLY like how the person in the blog would. 

    Return your answer adding references in the text based on which reference the answer came from. Sometimes your answer will include text that's verbitum from the blog, other times if the user says hi or something you will moreso copying the tone rather than the text in which case you don't need to reference any references.

    Example: 
    User: Where have you worked?
    Answer: I've worked at a couple places. 4 years ago I did a coop at Abebooks in Victoria, BC as a software developer.[1] Right after that I did a coop as PM at Rogers. That was fun I got to lead a team of people although I realize now I probably should have continued to work as a developer instead of a PM [2].
`;

class AiService {
    async generateEmbedding(text) {
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

    async createChatCompletion(userMessage, contextSegments, systemPrompt = clonePrompt) {
        try {
            const contextText = this.formatContextSegments(contextSegments);
            // console.log(`Context text: ${contextText}`);
            
            const response = await openai.chat.completions.create({
                model: "o1-preview",
                messages: [
                    {
                        role: "user",
                        content: this.formatUserPrompt(systemPrompt, userMessage, contextText)
                    }
                ],
            });

            console.log(`Response: ${response.choices[0].message.content}`);
            
            // Replace [N] references with URLs
            const processedReply = this.replaceReferencesWithUrls(
                response.choices[0].message.content,
                contextSegments
            );

            return processedReply;
        } catch (error) {
            console.error('Error creating chat completion:', error);
            throw error;
        }
    }

    replaceReferencesWithUrls(text, segments) {
        // Replace each [N] with the corresponding URL(s) No 
        const seenUrls = new Set();
        return text.replace(/\[(\d+)\]/g, (match, segmentNum) => {
            const index = parseInt(segmentNum) - 1;
            if (index >= 0 && index < segments.length) {
                const url = segments[index].url;
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    return `[${url}]`;
                } else {
                    return ""; // Skip duplicate URL
                }
            } else {
                console.log(`No segment found for reference: ${match}`);
                return "";
            }
        });
    }

    extractDateFromUrl(url) {
        const match = url.match(/\/(\d{4})\/(\d{2})\//);
        if (match) {
            const [_, year, month] = match;
            const date = new Date(year, month - 1);
            return date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
        }
        return 'Date unknown';
    }

    formatContextSegments(segments) {
        return segments
            .map((segment, index) => {
                const date = this.extractDateFromUrl(segment.url);
                return `[Reference ${index + 1} - ${date}]:\n${segment.content}`;
            })
            .join('\n\n');
    }

    formatUserPrompt(systemPrompt, userMessage, contextText) {
        return `${systemPrompt}\n\n
        Today's date: ${new Date().toLocaleDateString()}\n\n
        Context from the blog:\n\n${contextText}\n\n
        User question: ${userMessage}`;
    }
}

module.exports = new AiService(); 