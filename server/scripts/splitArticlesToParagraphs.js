const { createClient } = require("@supabase/supabase-js");
const aiService = require("../services/aiService");
const cliProgress = require("cli-progress");

const MAX_SEGMENT_LENGTH = 900;
const MIN_PARAGRAPH_LENGTH = 400;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function splitIntoSentences(text) {
  return text.match(/[^.!?]+[.!?]+\s*/g) || [text];
}

function combineShortParagraphs(paragraphs) {
  const combinedParagraphs = [];
  let currentParagraph = "";

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();

    if (currentParagraph) {
      // We have a stored paragraph, decide whether to combine
      if (
        paragraph.length < MIN_PARAGRAPH_LENGTH ||
        currentParagraph.length < MIN_PARAGRAPH_LENGTH
      ) {
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
    return [
      {
        content: paragraph,
        segment: depth,
      },
    ];
  }

  // Split into sentences first
  const sentences = splitIntoSentences(paragraph);
  if (sentences.length <= 1) {
    return [
      {
        content: paragraph,
        segment: depth,
      },
    ];
  }

  const midPoint = Math.floor(sentences.length / 2);
  let segments = [];

  if (sentences.length > 4) {
    // First half includes one sentence from second half
    const firstHalf = sentences
      .slice(0, midPoint + 1)
      .join("")
      .trim();

    // Second half includes one sentence from first half
    const secondHalf = sentences
      .slice(midPoint - 1)
      .join("")
      .trim();

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
      secondHalfSegments.forEach((seg) => {
        segments.push({
          ...seg,
          segment: depth + 1,
        });
      });
    } else {
      segments.push({ content: secondHalf, segment: depth + 1 });
    }
  } else {
    // If 4 or fewer sentences, simple split in half
    const firstHalf = sentences
      .slice(0, Math.ceil(sentences.length / 2))
      .join("")
      .trim();
    const secondHalf = sentences
      .slice(Math.floor(sentences.length / 2))
      .join("")
      .trim();

    segments.push({ content: firstHalf, segment: depth });
    segments.push({ content: secondHalf, segment: depth + 1 });
  }

  return segments;
}

async function saveSegmentToSupabase(segment) {
  try {
    const embedding = await aiService.generateEmbedding(segment.content);

    console.log("Saving segment to Supabase:", segment);

    const { data, error } = await supabase.from("shubhsblogs").insert([
      {
        url: segment.url,
        title: segment.title,
        content: segment.content,
        segment: segment.segment,
        embedding,
      },
    ]);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving segment:", error);
    throw error;
  }
}

async function processAndSaveArticles(articles) {
  try {
    const processedContent = [];

    // Create a multibar container
    const multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format: "{bar} {percentage}% | {value}/{total} | {title}",
      },
      cliProgress.Presets.shades_grey
    );

    // Create the main progress bar for articles
    const mainBar = multibar.create(articles.length, 0, { title: "Articles" });

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      // Split content into paragraphs and combine short ones
      const paragraphs = article.content
        .split(/\n\s*\n/)
        .filter((p) => p.trim());
      const combinedParagraphs = combineShortParagraphs(paragraphs);

      // Create a progress bar for segments within this article
      const segmentBar = multibar.create(combinedParagraphs.length, 0, {
        title: `Article ${i + 1} Segments`,
      });

      let currentSegment = 1; // Track segment number across the entire article

      for (let j = 0; j < combinedParagraphs.length; j++) {
        const paragraph = combinedParagraphs[j];
        const cleanParagraph = paragraph.trim();

        if (cleanParagraph.length > MAX_SEGMENT_LENGTH) {
          // Split long paragraph
          const segments = createOverlappingSegments(
            cleanParagraph,
            currentSegment
          );

          for (const segment of segments) {
            const segmentData = {
              url: article.url,
              title: article.title,
              content: segment.content,
              segment: currentSegment++,
            };
            await saveSegmentToSupabase(segmentData);
            processedContent.push(segmentData);
          }
        } else {
          // Keep short paragraph as is
          const segmentData = {
            url: article.url,
            title: article.title,
            content: cleanParagraph,
            segment: currentSegment++,
          };
          await saveSegmentToSupabase(segmentData);
          processedContent.push(segmentData);
        }
        segmentBar.increment();
      }

      segmentBar.stop();
      mainBar.increment();
    }

    multibar.stop(); // Stop all progress bars

    // Print detailed statistics
    console.log("\nProcessing completed successfully!");
    console.log(`Total segments created: ${processedContent.length}`);

    // Print segment length statistics
    const lengthStats = processedContent.reduce(
      (acc, item) => {
        acc.total += item.content.length;
        acc.min = Math.min(acc.min, item.content.length);
        acc.max = Math.max(acc.max, item.content.length);
        return acc;
      },
      { total: 0, min: Infinity, max: 0 }
    );

    console.log("\nSegment length statistics:");
    console.log(
      `Average length: ${Math.round(
        lengthStats.total / processedContent.length
      )} characters`
    );
    console.log(`Minimum length: ${lengthStats.min} characters`);
    console.log(`Maximum length: ${lengthStats.max} characters`);

    // Print segment distribution
    const segmentCounts = {};
    processedContent.forEach((item) => {
      segmentCounts[item.segment] = (segmentCounts[item.segment] || 0) + 1;
    });

    console.log("\nSegment distribution:");
    Object.entries(segmentCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([segment, count]) => {
        console.log(`Segment ${segment}: ${count} pieces`);
      });

    // Print a few examples
    console.log("\nExample segments:");
    processedContent.slice(0, 3).forEach((segment) => {
      console.log(`\nSegment ${segment.segment}:`);
      console.log(`Length: ${segment.content.length} characters`);
      console.log(`Preview: ${segment.content.substring(0, 150)}...`);
    });

    return processedContent;
  } catch (error) {
    console.error("Error processing articles:", error);
    throw error;
  }
}

module.exports = {
  processAndSaveArticles,
};
