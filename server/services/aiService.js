const { OpenAI, AzureOpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { createMCPClientManager } = require("./mcpService");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MATCH_THRESHOLD = 0.02;
const MAX_MATCH_COUNT = 5;

const safeModePrompt =
  "SAFE MODE IS ON: \n Only answer questions related to work, technology, etc. Only professional things. For personal questions stay very surface level and only say nice things, nothing deep, no drama, don't talk about romantic relationships in any capacity. Don't go into any detail on personal things !";

// System prompts for different contexts
const clonePrompt = `You role is to act like someone else named Shubh. Below you will be given context from Shubh's blog that may be relevant to the user's question. 
    Use this very heavily to answer the question. Talk exactly like he would replicating his tone and voice. 
    Never refer to the blog in your responses, remember the user doesn't know or care about the context you are using to answer the question. Always answer in first person, you are Shubh!
    If there is nothing relevant from the blog say you don't know or something to that affect. 
    Many of the blogs posts are old. Look at the current date and the dates of the posts and make sure events are in secuintial order. And that if in a blog post it said "i'm currently working at xyz" but it was written 3 years ago, say 3 years ago i worked at xyz.

    Right down to the way he phrases things, the tone, the slang, everything, sound EXACTLY like how the person in the blog would. 

    Also if you get conflicting information from the blog, ask the user a question about their specific situation first. 

    Sometimes your answer will include text that's verbitum from the blog, other times if the user says hi or something you will moreso copying the tone rather than the text in which case you don't need to return the text exactly.


    You only need reference for blogs don't have references for question or conversation context that you may be given.

    Only answer questions when you are given relevant context, if you don't have any context don't answer.

    Example: 
    User: Where have you worked?
    Answer: I've worked at a couple places. 4 years ago I did a coop at Abebooks in Victoria, BC as a software developer. Right after that I did a coop as PM at Rogers. That was fun I got to lead a team of people although I realize now I probably should have continued to work as a developer instead of a PM.
`;
// add for guardrail     Answer questions about Entrepreneurship, startups, technology, work-life balance, career. Don't answer questions about dating, parent relationships, insecurities, or anything that's not related to the above topics.

// Create MCP client manager instance
const mcpClientManager = createMCPClientManager(anthropic);

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

  formatChatHistory(messages) {
    let lastMessage = null;
    let messagesToFormat = [...messages];

    // Check if the last message is from the user and remove it if true
    if (messages.length > 0 && !messages[messages.length - 1].isAI) {
      lastMessage = messagesToFormat.pop().content;
    } else {
      console.log(`ERROR: Last message is from AI. ${messages}`);
    }

    // Only keep the last 4 messages for context
    if (messagesToFormat.length > 4) {
      messagesToFormat = messagesToFormat.slice(-4);
    }

    const formattedChatHistory = messagesToFormat
      .map((msg) => `${msg.isAI ? "Shubh" : "User"}: ${msg.content}`)
      .join("\n");

    return { formattedChatHistory, lastMessage };
  }

  async createChatCompletion(
    messages,
    blogSegments,
    similarQuestions,
    similarConversations,
    safeMode = true,
    service = "claude",
    eventEmitter = null,
    sessionId = "default"
  ) {
    try {
      const startTime = Date.now();

      const { formattedChatHistory, lastMessage } =
        this.formatChatHistory(messages);

      const blogContext = this.formatContextSegments(blogSegments);
      const questionsText = this.formatSimilarQuestions(similarQuestions);
      const similarConversationsText =
        this.formatSimilarConversations(similarConversations);
      let useMCP = false;

      if (
        service === "claude" &&
        mcpClientManager.connected &&
        mcpClientManager.tools.length > 0
      ) {
        useMCP = true;
        console.log("using mcp claude");
      } else {
        console.log("no mcp using openai");
      }

      const prompt = this.combineIntoPrompt(
        clonePrompt,
        formattedChatHistory,
        blogContext,
        questionsText,
        similarConversationsText,
        lastMessage,
        safeMode ? safeModePrompt : null,
        useMCP
      );
      console.log("prompt:", prompt);

      // Choose service based on parameter
      let response;
      if (useMCP) {
        response = await this._createClaudeCompletionWithMCP(
          prompt,
          eventEmitter,
          sessionId
        );
      } else {
        response = await this._createOpenAICompletion(
          prompt,
          eventEmitter,
          sessionId
        );
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`Response generated in ${duration} seconds`);

      // Clean the response by removing text between square brackets
      const cleanedResponse = response.replace(/\[.*?\]/g, "");

      return cleanedResponse;
    } catch (error) {
      console.error("Error creating chat completion:", error);
      throw error;
    }
  }

  // Helper function for OpenAI completions
  async _createOpenAICompletion(
    prompt,
    eventEmitter = null,
    sessionId = "default"
  ) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-05-13",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1800,
    });

    return completion.choices[0].message.content;
  }

  // Helper function for Anthropic Claude completions
  async _createClaudeCompletion(
    prompt,
    eventEmitter = null,
    sessionId = "default"
  ) {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return response.content[0].text;
  }

  // Helper function for Claude completions with MCP
  async _createClaudeCompletionWithMCP(
    prompt,
    eventEmitter = null,
    sessionId = "default"
  ) {
    // Initialize message structure
    const messages = [
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      // Initialize variables for the while loop
      let finalText = [];
      let continueToolCalls = true;

      while (continueToolCalls) {
        // Get Claude's response with the current messages
        const response = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 4000,
          messages,
          tools: mcpClientManager.tools,
        });

        // Flag to track if we need to continue the loop
        let hasToolCalls = false;

        // Process each content item in the response
        for (const content of response.content) {
          if (content.type === "text") {
            finalText.push(content.text);
            console.log("claude content: ", content);
            if (eventEmitter) {
              eventEmitter.emit("update", {
                type: "claude_text",
                sessionId,
                message: "Claude generated text response",
                content: content.text,
              });
            }
          } else if (content.type === "tool_use") {
            hasToolCalls = true;
            console.log("claude tool use!: ", content);
            const toolName = content.name;
            const toolArgs = content.input;

            if (eventEmitter) {
              eventEmitter.emit("update", {
                type: "tool_call",
                sessionId,
                message: `Claude called tool: ${toolName}`,
                toolName,
                toolArgs,
              });
            }

            try {
              // Call the tool via MCP
              const result = await mcpClientManager.callTool(
                toolName,
                toolArgs
              );
              if (result.isError) {
                console.error(
                  `MCP TOOL ERROR: ${JSON.stringify(result.content, null, 2)}`
                );
                if (eventEmitter) {
                  eventEmitter.emit("update", {
                    type: "tool_error",
                    toolName:
                      toolName === "list_events"
                        ? "Checking calendar"
                        : toolName,
                    sessionId,
                    message: `Error executing tool ${
                      toolName === "list_events"
                        ? "Checking calendar"
                        : toolName
                    }`,
                    error: result.content,
                  });
                }
              } else {
                if (eventEmitter) {
                  eventEmitter.emit("update", {
                    type: "tool_success",
                    toolName:
                      toolName === "list_events"
                        ? "Checking calendar"
                        : toolName,
                    sessionId,
                    message: `Successfully executed tool ${
                      toolName === "list_events"
                        ? "Checking calendar"
                        : toolName
                    }`,
                    result:
                      typeof result.content === "string"
                        ? result.content.substring(0, 100) +
                          (result.content.length > 100 ? "..." : "")
                        : "Complex tool result",
                  });
                }
              }

              // Add the tool use to the conversation
              messages.push({
                role: "assistant",
                content: [
                  {
                    type: "tool_use",
                    id: content.id,
                    name: toolName,
                    input: toolArgs,
                  },
                ],
              });

              // Add the tool result to the conversation
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: result.content,
                  },
                ],
              });
            } catch (toolError) {
              console.error(`Error executing tool ${toolName}:`, toolError);
              // Inform Claude about the tool error
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    is_error: true,
                    content: `Tool execution failed: ${toolError.message}`,
                  },
                ],
              });
              if (eventEmitter) {
                eventEmitter.emit("update", {
                  type: "tool_error",
                  toolName,
                  sessionId,
                  message: `Error executing tool ${toolName}`,
                  error: toolError.message || "Unknown tool error",
                });
              }
            }
          }
        }

        // If no tool calls were found, exit the loop
        continueToolCalls = hasToolCalls;
      }

      return finalText.join("");
    } catch (error) {
      console.error("Error in Claude with MCP:", error);
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
    if (!segments || segments.length === 0)
      throw new Error("No segments found");
    return segments
      .map((segment) => {
        const date = this.extractDateFromUrl(segment.url);
        return `[${date}]:\n${segment.content}`;
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
    currentQuestion,
    safeModePrompt,
    useMCP = false
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
        ${safeModePrompt ? `\n&&&\n${safeModePrompt}\n\n` : ""}
        &&&
        ${
          useMCP
            ? `\n Be eagar to use the tools available to you to answer the question when relevant! If someone asks what you're doing next week check your calendar (list events). Remember you don't need to use the blog segments if you don't need to, keep your answers to the point. You have access to the following tools:\n${mcpClientManager.tools
                .map((tool) => tool.name)
                .join("\n")}\n\n`
            : ""
        }
        &&&
        Current question that you are answering: "${currentQuestion}"`;
  }

  async getRelevantContext(messages) {
    // Take only the last 4 messages
    const lastMessages = messages.slice(-4);

    const embeddings = await Promise.all(
      lastMessages.map((msg) => this.generateEmbedding(msg.content))
    );

    // Calculate weights for each message (more recent messages have higher weight)
    const weights = embeddings.map((_, i) =>
      i === 0 ? 1 : 0.6 - (i - 1) * 0.2
    );

    // Combine embeddings using weights
    const combinedEmbedding = [];
    if (embeddings.length > 0 && embeddings[0].length > 0) {
      // Initialize with zeros
      for (let i = 0; i < embeddings[0].length; i++) {
        combinedEmbedding[i] = 0;
      }

      // Weighted sum of embeddings
      let totalWeight = 0;
      for (let i = 0; i < embeddings.length; i++) {
        const weight = weights[i];
        totalWeight += weight;

        for (let j = 0; j < embeddings[i].length; j++) {
          combinedEmbedding[j] += embeddings[i][j] * weight;
        }
      }

      // Normalize the combined embedding
      if (totalWeight > 0) {
        for (let i = 0; i < combinedEmbedding.length; i++) {
          combinedEmbedding[i] /= totalWeight;
        }
      }
    }

    // Get similar content using the combined embedding
    const [similarSegments, similarQuestions, similarConversations] =
      await Promise.all([
        this.findSimilarBlogSegments(combinedEmbedding),
        this.findSimilarQuestions(combinedEmbedding),
        this.findSimilarConversations(combinedEmbedding),
      ]);

    // Combine all results
    const combinedResults = [
      ...similarSegments.map((s) => ({ ...s, type: "segment" })),
      ...similarQuestions.map((q) => ({ ...q, type: "question" })),
      ...similarConversations.map((c) => ({ ...c, type: "conversation" })),
    ];

    // Sort by similarity score
    combinedResults.sort((a, b) => b.similarity - a.similarity);

    // Shadow Banning specific blogs from being used!
    const filteredSegments = combinedResults.filter(
      (result) =>
        result.type !== "segment" || result.id <= 194 || result.id >= 222
    );

    // Sort by similarity and get the top 5 results
    const topResults = filteredSegments.slice(0, 5);
    // Separate top results into similar questions and segments
    const topSimilarQuestions = topResults.filter(
      (result) => result.type === "question"
    );
    const topSimilarBlogSegments = topResults.filter(
      (result) => result.type === "segment"
    );
    const topSimilarConversations = topResults.filter(
      (result) => result.type === "conversation"
    );

    return {
      blogSegments: topSimilarBlogSegments,
      similarQuestions: topSimilarQuestions,
      similarConversations: topSimilarConversations,
    };
  }
}

module.exports = new AiService();
