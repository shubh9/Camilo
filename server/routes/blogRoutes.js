const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");
const { convert } = require("html-to-text");
const OAuthService = require("../services/oauthService");
const {
  processAndSaveArticles,
} = require("../scripts/splitArticlesToParagraphs");

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function filterSkipAiContent(content) {
  const skipAiIndex = content.toLowerCase().indexOf("#skipai");
  return skipAiIndex !== -1
    ? content.substring(0, skipAiIndex).trim()
    : content;
}

function convertHtmlToText(html) {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  });
}

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// Update blogs route
router.get("/update", isAuthenticated, async (req, res) => {
  try {
    // Get configured OAuth2 client from service
    const oauth2Client = OAuthService.getConfiguredClient(
      req.user.accessToken,
      req.user.refreshToken
    );

    // Use the OAuth2 client
    const blogger = google.blogger({
      version: "v3",
      auth: oauth2Client,
    });

    const blogId = process.env.BLOGGER_BLOG_ID;

    // Fetch all posts from the blog
    const response = await blogger.posts.list({
      blogId: blogId,
      maxResults: 500,
    });

    console.log("Total blogs returned:", response.data.items.length);

    // Get the most recent segment from Supabase
    const { data: segments, error } = await supabase
      .from("shubhsblogs")
      .select("url")
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching from Supabase:", error);
      throw error;
    }

    const mostRecentUrl = segments?.[0]?.url;
    let newBlogs = [];

    console.log("Most recent URL:", mostRecentUrl);

    if (mostRecentUrl) {
      // Get new blogs until we find the most recent URL
      for (const post of response.data.items) {
        const mostRecentPath = mostRecentUrl.replace(/^https?:\/\//, "");
        const postPath = post.url.replace(/^https?:\/\//, "");
        if (postPath === mostRecentPath) {
          break;
        }
        newBlogs.push({
          url: post.url,
          title: post.title,
          content: convertHtmlToText(post.content),
        });
      }
      console.log("New blogs found:", newBlogs.length);
    } else {
      console.log("No existing segments found in Supabase");
      newBlogs = response.data.items.map((post) => ({
        url: post.url,
        title: post.title,
        content: convertHtmlToText(post.content),
      }));
    }

    if (newBlogs.length > 0) {
      // Reverse the array so latest blogs are first
      newBlogs.reverse();
      // Filter out #skipai content
      newBlogs = newBlogs.map((blog) => ({
        ...blog,
        content: filterSkipAiContent(blog.content),
      }));
      // Process and save new blogs
      await processAndSaveArticles(newBlogs);
    }

    res.json({
      message: "Successfully pulled and saved blog posts",
      newBlogsProcessed: newBlogs.length,
    });
  } catch (error) {
    console.error("Error pulling blogs:", error);
    res.status(500).json({ error: "Failed to pull blogs" });
  }
});

module.exports = router;
