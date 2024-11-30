const { OpenAI, AzureOpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Initialize both OpenAI clients
const azure_client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: "2024-02-15-preview",
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MATCH_THRESHOLD = 0.02;
const MAX_MATCH_COUNT = 5;

// System prompts for different contexts
const clonePrompt = `You role is to act like someone else named Shubh. Below you will be given context from Shubh's blog that may be relevant to the user's question. 
    Use this very heavily to answer the question. Talk exactly like he would replicating his tone and voice. 
    Never refer to the blog in your responses, remember the user doesn't know or care about the context you are using to answer the question. Always answer in first person, you are Shubh!
    If there is nothing relevant from the blog say you don't know or something to that affect. 
    Many of the blogs posts are old. Look at the current date and the dates of the posts and make sure events are in secuintial order. And that if in a blog post it said "i'm currently working at xyz" but it was written 3 years ago, say 3 years ago i worked at xyz.

    Right down to the way he phrases things, the tone, the slang, everything, sound EXACTLY like how the person in the blog would. 

    Also if you get conflicting information from the blog, ask the user a question about their specific situation first. 

    Return your answer adding references in the text based on which reference the answer came from. Sometimes your answer will include text that's verbitum from the blog, other times if the user says hi or something you will moreso copying the tone rather than the text in which case you don't need to reference any references.
    Also if you use a reference multiple times, only reference it the first time.
    Make sure references are always in the format [N] where N is the reference number. 
    NOT Reference 134
    NOT [^801]
    NOT [Reference 234 - March 2021]
    NOT [Reference 642]

    You only need reference for blogs don't have references for question or conversation context that you may be given.

    Only answer questions when you are given relevant context, if you don't have any context don't answer.

    Example: 
    User: Where have you worked?
    Answer: I've worked at a couple places. 4 years ago I did a coop at Abebooks in Victoria, BC as a software developer.[34] Right after that I did a coop as PM at Rogers. That was fun I got to lead a team of people although I realize now I probably should have continued to work as a developer instead of a PM [25].
`;
// add for guardrail     Answer questions about Entrepreneurship, startups, technology, work-life balance, career. Don't answer questions about dating, parent relationships, insecurities, or anything that's not related to the above topics.

class AiService {
  async generateEmbedding(text) {
    console.log("Generating embedding:", text);
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  async findSimilarBlogSegments(embedding) {
    console.log("Finding similar blog segments...");
    const { data, error } = await supabase.rpc("match_segments_blog", {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MAX_MATCH_COUNT,
    });

    if (error) throw error;
    return data;
  }

  async findSimilarQuestions(embedding) {
    console.log("Finding similar questions...");
    const { data, error } = await supabase.rpc("match_questions", {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MAX_MATCH_COUNT,
    });

    if (error) throw error;
    return data;
  }

  async findSimilarConversations(embedding) {
    console.log("Finding similar conversations...");
    const { data, error } = await supabase.rpc("match_conversations", {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MAX_MATCH_COUNT,
    });

    if (error) throw error;
    return data;
  }

  async getBlogContentBySegmentId(segmentIds) {
    if (!segmentIds || segmentIds.length === 0) return [];

    const { data, error } = await supabase
      .from("shubhsblogs")
      .select("*")
      .in("id", segmentIds);

    if (error) throw error;
    return data;
  }

  formatChatHistory(messages) {
    let lastMessage = null;

    // Check if the last message is from the user and remove it if true
    if (messages.length > 0 && !messages[messages.length - 1].isAI) {
      lastMessage = messages.pop().content;
    } else {
      console.log(`ERROR: Last message is from AI. ${messages}`);
    }

    const formattedChatHistory = messages
      .map((msg) => `${msg.isAI ? "Shubh" : "User"}: ${msg.content}`)
      .join("\n");

    return { formattedChatHistory, lastMessage };
  }

  async createChatCompletion(
    messages,
    contextSegments,
    similarQuestions,
    similarConversations
  ) {
    try {
      const startTime = Date.now();

      const { formattedChatHistory, lastMessage } =
        this.formatChatHistory(messages);
      const blogContext = this.formatContextSegments(contextSegments);
      const questionsText = this.formatSimilarQuestions(similarQuestions);
      const similarConversationsText =
        this.formatSimilarConversations(similarConversations);

      const prompt = this.combineIntoPrompt(
        clonePrompt,
        formattedChatHistory,
        blogContext,
        questionsText,
        similarConversationsText,
        lastMessage
      );

      const response = await azure_client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`Response generated in ${duration} seconds`);
      console.log("response:", response.choices[0].message.content);

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error creating chat completion:", error);
      throw error;
    }
  }

  extractDateFromUrl(url) {
    const match = url.match(/\/(\d{4})\/(\d{2})\//);
    if (match) {
      const [_, year, month] = match;
      const date = new Date(year, month - 1);
      return date.toLocaleString("en-US", { year: "numeric", month: "long" });
    }
    return "Date unknown";
  }

  formatContextSegments(segments) {
    return segments
      .map((segment) => {
        const date = this.extractDateFromUrl(segment.url);
        return `[Reference ${segment.id} - ${date}]:\n${segment.content}`;
      })
      .join("\n\n");
  }

  formatSimilarQuestions(questions) {
    if (!questions || questions.length === 0) return "";

    return questions
      .map((q, index) => {
        return `[Similar Q&A ${index + 1}]:\nQuestion: ${q.question}\nAnswer: ${
          q.answer
        }`;
      })
      .join("\n\n");
  }

  formatSimilarConversations(conversations) {
    if (!conversations || conversations.length === 0) return "";

    return conversations
      .map((conv, index) => {
        // Format the conversation in a more readable way
        const formattedConversation = conv.content.conversation
          .map((msg) => {
            const role = msg.isAI ? "Shubh" : "User";
            // Add indentation and line breaks for readability
            return `    ${role}:\n    "${msg.content}"`;
          })
          .join("\n\n");
        return `[Similar Conversation ${index + 1}]:\n${formattedConversation}`;
      })
      .join("\n\n");
  }

  combineIntoPrompt(
    systemPrompt,
    formattedChatHistory,
    blogContext,
    questionsText,
    similarConversationsText,
    currentQuestion
  ) {
    return `${systemPrompt}\n\n
        &&&
        Today's date: ${new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}\n\n
        &&&
        Context from the blog:\n${blogContext}\n\n
        ${
          questionsText
            ? `\n&&&\nSimilar Questions and Answers. If a question is very close to the current question, replicate the answer very closely as relevant:\n${questionsText}\n\n`
            : ""
        }
        ${
          formattedChatHistory
            ? `\n&&&\nHere is the conversation history so far:\n${formattedChatHistory}\n\n`
            : ""
        }
        ${
          similarConversationsText
            ? `\n&&&\nWe found a similar conversation that the real Shubh has had that might be relevant. If the content is similar follow this conversation history very closely. Espically focus on how Shubh asks the user questions to clarify the situation before making his response:\n${similarConversationsText}\n\n`
            : ""
        }
        &&&
        Current question that you are answering: "${currentQuestion}"`;
  }

  async getRelevantContext(messages) {
    const embeddings = await Promise.all(
      messages.map((msg) => this.generateEmbedding(msg.content))
    );

    let combinedResults = [];

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const weight = 1 - i * 0.2; // Calculate weight based on message position

      const [similarSegments, similarQuestions, similarConversations] =
        await Promise.all([
          this.findSimilarBlogSegments(embedding),
          this.findSimilarQuestions(embedding),
          this.findSimilarConversations(embedding),
        ]);

      // Adjust similarity scores based on weight
      similarSegments.forEach((segment) => (segment.similarity *= weight));
      similarQuestions.forEach((question) => (question.similarity *= weight));
      similarConversations.forEach(
        (conversation) => (conversation.similarity *= weight)
      );

      combinedResults = combinedResults.concat(
        similarSegments.map((s) => ({ ...s, type: "segment" })),
        similarQuestions.map((q) => ({ ...q, type: "question" })),
        similarConversations.map((c) => ({ ...c, type: "conversation" }))
      );
    }

    // Shadow Banning specific blogs from being used!
    const filteredSegments = combinedResults.filter(
      (result) =>
        result.type !== "segment" || result.id <= 194 || result.id >= 222
    );

    // Sort by similarity and get the top 5 results
    filteredSegments.sort((a, b) => b.similarity - a.similarity);
    const topResults = filteredSegments.slice(0, 5);
    // Separate top results into similar questions and segments
    const topSimilarQuestions = topResults.filter(
      (result) => result.type === "question"
    );
    const topSimilarSegments = topResults.filter(
      (result) => result.type === "segment"
    );
    const topSimilarConversations = topResults.filter(
      (result) => result.type === "conversation"
    );

    // 3. Get blog content for question's attached links
    console.log("Getting blog content for question links...");
    const relevantSegmentIds = [
      ...new Set(topSimilarQuestions.flatMap((q) => q.relevantSegments || [])),
    ];

    // const additionalSegments = await this.getBlogContentBySegmentId(relevantSegmentIds);

    // 4. Combine all unique segments
    const allSegments = [...topSimilarSegments];
    // additionalSegments.forEach(segment => {
    //     if (!allSegments.some(s => s.url === segment.url)) {
    //         allSegments.push(segment);
    //     }
    // });

    return {
      allSegments,
      topSimilarQuestions,
      topSimilarConversations,
    };
  }
}

module.exports = new AiService();
