require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const aiService = require("./services/aiService");
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const blogRoutes = require("./routes/blogRoutes");
const { google } = require("googleapis");
const {
  DEV_CLIENT_URL,
  PROD_CLIENT_URL,
  CLIENT_URL,
  GOOGLE_CALLBACK_URL,
} = require("./config/urls");

const app = express();
const port = 3001;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Add EventEmitter for SSE implementation
const EventEmitter = require("events");
const messageEventEmitter = new EventEmitter();
// Set higher limit for event listeners
messageEventEmitter.setMaxListeners(100);

// app.use(cors());

// Configure CORS with specific options
const corsOptions = {
  origin: [
    "https://www.shubh.run",
    "https://shubh.run",
    "http://www.shubh.run",
    "http://shubh.run",
    "http://localhost:3000",
  ],
  methods: "*",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Enable pre-flight requests for all routes
app.options("*", cors(corsOptions));

app.use(cors(corsOptions));

app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: process.env.NODE_ENV === "production" ? ".shubh.run" : undefined,
    },
    proxy: process.env.NODE_ENV === "production", // Trust the reverse proxy in production
  })
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/blogger"],
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log("Access Token received:", !!accessToken);
      console.log("Refresh Token received:", !!refreshToken);
      if (refreshToken) {
        console.log("Actual Refresh Token:", refreshToken);
      } else {
        console.log("No refresh token was issued!");
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        scope: ["https://www.googleapis.com/auth/blogger"],
      });

      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        accessToken,
        refreshToken,
      };
      return cb(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Auth Routes
app.get(
  "/auth/google",
  (req, res, next) => {
    console.log("Starting Google auth process...");
    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/blogger"],
    accessType: "offline",
    prompt: "consent",
  })
);

app.get(
  "/auth/google/callback",
  (req, res, next) => {
    console.log("Received callback from Google");
    next();
  },
  passport.authenticate("google", {
    failureRedirect: `${CLIENT_URL}/login`,
  }),
  function (req, res) {
    console.log("Authentication successful, user:", req.user?.email);
    // Successful authentication, redirect home
    res.redirect(CLIENT_URL);
  }
);

app.get("/auth/status", (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect(CLIENT_URL);
  });
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

// Add a new SSE endpoint for streaming message updates
app.get("/sse-message", (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Function to handle SSE events
  const sseHandler = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Register the event handler
  messageEventEmitter.on("update", sseHandler);

  // Handle client disconnect
  req.on("close", () => {
    messageEventEmitter.removeListener("update", sseHandler);
  });
});

// Modify the existing message endpoint
app.post("/message", async (req, res) => {
  const { messages, safeMode } = req.body;
  const sessionId = req.query.sessionId || "default";
  // Filter to get only user messages
  const userMessages = messages.filter((message) => message.isAI === false);
  // Get the last 4 user messages
  const lastUserMessages = userMessages.slice(-4);

  try {
    const { blogSegments, similarQuestions, similarConversations } =
      await aiService.getRelevantContext(lastUserMessages);

    console.log("Generating response with context...");
    // Pass null for eventEmitter if in production to potentially skip SSE emits internally
    const finalReply = await aiService.createChatCompletion(
      messages,
      blogSegments,
      similarQuestions,
      similarConversations,
      safeMode,
      "claude",
      process.env.NODE_ENV === "production" ? null : messageEventEmitter, // Pass null in production
      sessionId
    );

    // Save the message and response to Supabase
    const latestUserMessage = userMessages[userMessages.length - 1];
    // Use the finalReply for saving
    const { error: supabaseError } = await supabase
      .from("messagesReceived")
      .insert([
        {
          question: latestUserMessage.content,
          answer: finalReply,
        },
      ]);

    if (supabaseError) {
      console.error("Error saving to Supabase:", supabaseError);
    }

    console.log("Final reply sent to client:", finalReply);

    // Send the final reply immediately back to the client
    res.json({
      reply: finalReply,
    });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Add this after all the middleware setup (after app.use(passport.session()))
app.use("/blog", blogRoutes);

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

module.exports = app;
