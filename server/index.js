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
      domain: process.env.NODE_ENV === "production" ? ".vercel.app" : undefined,
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
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/blogger"],
    accessType: "offline",
    prompt: "consent",
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${CLIENT_URL}/login`,
  }),
  function (req, res) {
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

app.post("/message", async (req, res) => {
  const { messages } = req.body;
  // Filter to get only user messages
  const userMessages = messages.filter((message) => message.isAI === false);
  // Get the last 4 user messages
  const lastUserMessages = userMessages.slice(-4);

  try {
    // Get relevant context using the new method
    const { allSegments, topSimilarQuestions, topSimilarConversations } =
      await aiService.getRelevantContext(lastUserMessages);

    console.log("Generating response with context...");
    const reply = await aiService.createChatCompletion(
      messages,
      allSegments,
      topSimilarQuestions,
      topSimilarConversations
    );

    console.log("segments:", allSegments);

    // Extract unique segment IDs and URLs from the context segments
    const linkData = allSegments.reduce((acc, segment) => {
      acc[segment.id] = segment.url;
      return acc;
    }, {});

    // Save the message and response to Supabase
    const latestUserMessage = userMessages[userMessages.length - 1];
    const { error: supabaseError } = await supabase
      .from("messagesReceived")
      .insert([
        {
          question: latestUserMessage.content,
          answer: reply,
        },
      ]);

    if (supabaseError) {
      console.error("Error saving to Supabase:", supabaseError);
    }

    console.log("reply:", reply);
    console.log("linkData:", linkData);

    res.json({
      reply,
      linkData,
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
