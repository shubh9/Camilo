const fs = require('fs').promises;
const path = require('path');

const MAX_SEGMENT_LENGTH = 800;
const MIN_PARAGRAPH_LENGTH = 100;

function splitIntoSentences(text) {
    return text.match(/[^.!?]+[.!?]+\s*/g) || [text];
}

function combineShortParagraphs(paragraphs) {
    const combinedParagraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        
        if (currentParagraph) {
            // We have a stored paragraph, decide whether to combine
            if (paragraph.length < MIN_PARAGRAPH_LENGTH || currentParagraph.length < MIN_PARAGRAPH_LENGTH) {
                currentParagraph = `${currentParagraph}\n\n${paragraph}`;
            } else {
                combinedParagraphs.push(currentParagraph);
                currentParagraph = paragraph;
            }
        } else {
            currentParagraph = paragraph;
        }
    }

    // Don't forget the last paragraph
    if (currentParagraph) {
        combinedParagraphs.push(currentParagraph);
    }

    return combinedParagraphs;
}

function createOverlappingSegments(paragraph, depth) {
    if (paragraph.length <= MAX_SEGMENT_LENGTH) {
        return [{
            content: paragraph,
            segment: depth
        }];
    }

    // Split into sentences first
    const sentences = splitIntoSentences(paragraph);
    if (sentences.length <= 1) {
        return [{
            content: paragraph,
            segment: depth
        }];
    }

    const midPoint = Math.floor(sentences.length / 2);
    let segments = [];

    if (sentences.length > 4) {
        // First half includes one sentence from second half
        const firstHalf = sentences.slice(0, midPoint + 1).join('').trim();
        
        // Second half includes one sentence from first half
        const secondHalf = sentences.slice(midPoint - 1).join('').trim();

        if (firstHalf.length > MAX_SEGMENT_LENGTH) {
            // If first half needs further splitting, process it
            const firstHalfSegments = createOverlappingSegments(firstHalf, depth + 1);
            segments.push(...firstHalfSegments);
        } else {
            segments.push({ content: firstHalf, segment: depth });
        }

        if (secondHalf.length > MAX_SEGMENT_LENGTH) {
            // If second half needs further splitting, process it and adjust segment numbers
            const secondHalfSegments = createOverlappingSegments(secondHalf);
            secondHalfSegments.forEach(seg => {
                segments.push({
                    ...seg,
                    segment: depth + 1
                });
            });
        } else {
            segments.push({ content: secondHalf, segment: depth + 1 });
        }
    } else {
        // If 4 or fewer sentences, simple split in half
        const firstHalf = sentences.slice(0, Math.ceil(sentences.length / 2)).join('').trim();
        const secondHalf = sentences.slice(Math.floor(sentences.length / 2)).join('').trim();

        segments.push({ content: firstHalf, segment: depth });
        segments.push({ content: secondHalf, segment: depth + 1 });
    }

    return segments;
}

async function processArticles() {
    try {
        const filePath = path.join(__dirname, '..', 'data', 'scraped_articles_2024-11-09T07-00-14-048Z.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        const articles = JSON.parse(fileContent);

        const processedContent = [];

        articles.forEach(article => {
            // Split content into paragraphs and combine short ones
            const paragraphs = article.content.split(/\n\s*\n/).filter(p => p.trim());
            const combinedParagraphs = combineShortParagraphs(paragraphs);
            
            let currentSegment = 1; // Track segment number across the entire article
            
            combinedParagraphs.forEach(paragraph => {
                const cleanParagraph = paragraph.trim();
                
                if (cleanParagraph.length > MAX_SEGMENT_LENGTH) {
                    // Split long paragraph
                    const segments = createOverlappingSegments(cleanParagraph, currentSegment);
                    
                    segments.forEach(segment => {
                        processedContent.push({
                            url: article.url,
                            title: article.title,
                            content: segment.content,
                            segment: currentSegment++
                        });
                    });
                } else {
                    // Keep short paragraph as is
                    processedContent.push({
                        url: article.url,
                        title: article.title,
                        content: cleanParagraph,
                        segment: currentSegment++
                    });
                }
            });
        });

        // Save to new file
        const timestamp = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/Los_Angeles' // Change this to your local timezone if needed
        }).format(new Date()).replace(/, /g, '-').replace(/:/g, '-');
        
        const outputPath = path.join(__dirname, '..', 'data', `processed_segments_${timestamp}.json`);
        
        await fs.writeFile(
            outputPath,
            JSON.stringify(processedContent, null, 2),
            'utf8'
        );

        // Print summary with additional statistics
        console.log('\nProcessing completed successfully!');
        console.log(`Total segments created: ${processedContent.length}`);
        console.log(`Output saved to: ${outputPath}`);

        // Print segment length statistics
        const lengthStats = processedContent.reduce((acc, item) => {
            acc.total += item.content.length;
            acc.min = Math.min(acc.min, item.content.length);
            acc.max = Math.max(acc.max, item.content.length);
            return acc;
        }, { total: 0, min: Infinity, max: 0 });

        console.log('\nSegment length statistics:');
        console.log(`Average length: ${Math.round(lengthStats.total / processedContent.length)} characters`);
        console.log(`Minimum length: ${lengthStats.min} characters`);
        console.log(`Maximum length: ${lengthStats.max} characters`);

        // Print segment distribution
        const segmentCounts = {};
        processedContent.forEach(item => {
            segmentCounts[item.segment] = (segmentCounts[item.segment] || 0) + 1;
        });

        console.log('\nSegment distribution:');
        Object.entries(segmentCounts)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .forEach(([segment, count]) => {
                console.log(`Segment ${segment}: ${count} pieces`);
            });

        // Print a few examples
        console.log('\nExample segments:');
        processedContent.slice(0, 3).forEach(segment => {
            console.log(`\nSegment ${segment.segment}:`);
            console.log(`Length: ${segment.content.length} characters`);
            console.log(`Preview: ${segment.content.substring(0, 150)}...`);
        });

    } catch (error) {
        console.error('Error processing articles:', error);
        process.exit(1);
    }
}

processArticles();