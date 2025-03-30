import React, { useEffect, useState, useRef } from "react";
import styled from "styled-components";
// import LoadingDots from "./components/LoadingDots";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { updateBlogsFromBlogger } from "./services/blogParser";
import LoadingSnakes from "loading-snakes";
import { v4 as uuidv4 } from "uuid";

// Color variables
const white = "#ffffff";
const black = "#000000";
const inputBorderGrey = "#333333";
const buttonBlue = "#007bff";
const buttonHoverBlue = "#0056b3";

// Gradient colors
const normalGradientStart = "#FFEAD6";
const normalGradientEnd = "#F8B585";
// const unsafeGradientEnd = "#F16D71"; a bit more intense color scheme
// const unsafeGradientEnd = "#4A5E78";
const unsafeGradientStart = "#A7C7E7";
const unsafeGradientEnd = "#093054";

// Styled Components
const AppContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: linear-gradient(
    to bottom,
    ${(props) =>
      props.theme.safeMode ? normalGradientStart : unsafeGradientStart},
    ${(props) => (props.theme.safeMode ? normalGradientEnd : unsafeGradientEnd)}
  );
  * {
    user-select: text;
  }
`;

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  width: 80%;
  margin: 0 auto;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 10px;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const MessageStyle = styled.div`
  padding: 10px 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  max-width: 70%;
  word-wrap: break-word;
  line-height: 1.4;
  position: relative;
  z-index: 2;
  pointer-events: auto;
`;

const InputContainer = styled.form`
  position: relative;
  width: 100%;
`;

const MessageInput = styled.textarea`
  width: calc(100% - 20px);
  height: 24px;
  min-height: 24px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 16px;
  background-color: ${white}33;
  color: ${black};
  resize: none;
  line-height: 1.5;
  overflow: hidden;
  font-family: "Inter", sans-serif;
  border-radius: 20px;
  border-width: 0px;
  &:focus {
    outline: none;
  }
`;

const SendButton = styled.button`
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background-image: url("/arrow_up.png");
  background-color: transparent;
  background-size: 24px;
  background-position: center;
  background-repeat: no-repeat;
  border: none;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0 : 1)};
  transition: opacity 0.5s ease-in-out;

  &:hover {
    background-color: ${buttonHoverBlue};
  }
`;

// Add a new styled component for hyperlinks
const MessageLink = styled.a`
  color: ${black}66;
  text-decoration: underline;
  cursor: pointer;
  position: relative;
  z-index: 3;
  pointer-events: auto;

  &:hover {
    color: ${black};
  }
`;

// Types
interface Message {
  content: string;
  isAI: boolean;
  links?: { [key: number]: string };
}

interface Tool {
  content: string;
  status: "running" | "success" | "error";
  toolName: string;
  isAI: true;
  error?: string;
  timestamp: Date;
}

type ChatSegment = Message | Tool;

// Add a new interface for SSE update events
interface UpdateEvent {
  type: string;
  message: string;
  timestamp: Date;
  content?: string;
  toolName?: string;
  toolArgs?: any;
  error?: any;
  result?: any;
}

// Constants
export const serverUrl =
  process.env.NODE_ENV === "production"
    ? "https://camilo-server.vercel.app"
    : "http://localhost:3001";

console.log("serverUrl:", serverUrl);
const AIMessage = styled(MessageStyle)`
  margin-left: 0;
  background-color: transparent;
  color: ${black};
  z-index: 1;
`;

const UserMessage = styled(MessageStyle)`
  margin-left: auto;
  background-color: ${white}55;
  color: ${black};
  z-index: 1;
`;

// Styled Components
const Title = styled.h1`
  text-align: center;
  color: ${black}88;
  margin-top: 20px;
  user-select: none;
`;

const TitleSpan = styled.span`
  cursor: pointer;
  &:hover {
    color: ${black};
  }
`;

// Add this new styled component after other styled components and before the App function
const LoadingDotsContainer = styled.div`
  margin-left: -25%;
  margin-top: 20px;
  padding: 10px 15px;
  border-radius: 8px;
  max-width: 70%;
  word-wrap: break-word;
  line-height: 1.4;
`;

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
`;

const LoginButton = styled.button`
  padding: 12px 24px;
  background-color: ${white}88;
  border: none;
  border-radius: 24px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${white}cc;
  }
`;

const UserInfo = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10;
`;

const LogoutButton = styled.button`
  padding: 8px 16px;
  background-color: ${white}88;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${white}cc;
  }
`;

const PullBlogButton = styled.button`
  padding: 10px 20px;
  background-color: ${white}88;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${white}cc;
  }
`;

// Add a new tooltip component for the security question
const Tooltip = styled.div<{ $show: boolean }>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  opacity: ${(props) => (props.$show ? "1" : "0")};
  visibility: ${(props) => (props.$show ? "visible" : "hidden")};
  transition: all 0.3s ease;
  z-index: 100;
  width: 250px;
  text-align: center;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const TooltipTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
`;

const AnswerInput = styled.input`
  width: calc(100% - 24px);
  padding: 10px 12px;
  margin-top: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 16px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  transition: border-color 0.3s, box-shadow 0.3s;

  &:focus {
    outline: none;
    border-color: ${buttonBlue};
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
  }
`;

const SubmitButton = styled.button`
  margin-top: 12px;
  padding: 8px 16px;
  background-color: ${buttonBlue};
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: background-color 0.3s, transform 0.2s;

  &:hover {
    background-color: ${buttonHoverBlue};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

// Simplified processing updates container
const ProcessingUpdatesContainer = styled.div`
  position: fixed;
  bottom: 100px;
  right: 20px;
  width: 350px;
  max-height: 300px;
  overflow-y: auto;
  background-color: ${white}88;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: "Courier New", monospace;
  font-size: 12px;
`;

const UpdateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 5px;
  margin-bottom: 5px;
`;

// Simple update item without complex styling by type
const UpdateEntry = styled.div`
  margin-bottom: 8px;
  padding: 5px;
  border-radius: 5px;
  font-size: 12px;
`;

// New styled components for inline tool updates
const ToolUpdateContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 8px 0;
  padding: 6px 10px;
  font-size: 14px;
  color: ${black}DD;
  background-color: ${white}22;
  border-radius: 8px;
  border-left: 3px solid ${buttonBlue}88;
`;

const ToolIcon = styled.span`
  margin-right: 8px;
  font-size: 18px;
`;

const ToolName = styled.span`
  font-weight: bold;
  margin-right: 8px;
  color: ${black};
`;

const LoadingIcon = styled.span`
  display: inline-block;
  animation: spin 1.2s linear infinite;
  margin-left: 5px;
  color: ${buttonBlue};
  font-size: 16px;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ToolStatusIcon = styled.span`
  margin-left: 5px;
  font-size: 16px;
`;

// Main Component
function AppContent() {
  const { isAuthenticated, isLoading, user, login, logout, checkAuthStatus } =
    useAuth();
  const [chatSegments, setChatSegments] = useState<ChatSegment[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPullingBlogs, setIsPullingBlogs] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [securityError, setSecurityError] = useState("");
  const sessionIdRef = useRef<string>("");
  const sseRef = useRef<EventSource | null>(null);

  // Helper function to determine if a segment is a Message
  const isMessage = (segment: ChatSegment): segment is Message => {
    return !("toolName" in segment);
  };

  // Helper function to determine if a segment is a Tool
  const isTool = (segment: ChatSegment): segment is Tool => {
    return "toolName" in segment;
  };

  // Check authentication status when component mounts
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Add a function to connect to SSE
  const connectToSSE = () => {
    // Close any existing connection
    if (sseRef.current) {
      sseRef.current.close();
    }

    // Create a new SSE connection with credentials
    const sse = new EventSource(`${serverUrl}/sse-message`, {
      withCredentials: true, // Add this option
    });
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEMessage(data);
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    sse.onerror = (error) => {
      // Check if we're in production
      if (process.env.NODE_ENV === "production") {
        // In production, just log the error without attempting to reconnect
        console.log("SSE connection not available in production");
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
        return;
      }

      console.error("SSE connection error:", error);
      // Only try to reconnect in development
      setTimeout(() => {
        connectToSSE();
      }, 3000);
    };

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  };

  // Connect to SSE when component mounts, but only in development
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      connectToSSE();
    }
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <LoginContainer>
        <LoadingSnakes />
      </LoginContainer>
    );
  }

  if (showLoginPrompt && !isAuthenticated) {
    return (
      <LoginContainer>
        <Title>Greetings OG</Title>
        <LoginButton onClick={login}>Sign in with Google</LoginButton>
      </LoginContainer>
    );
  }

  const handleTitleClick = async (letter: string) => {
    if (letter === "u") {
      await checkAuthStatus();
      setShowLoginPrompt(true);
    } else if (letter === "S") {
      if (safeMode) {
        setShowTooltip(true);
        setSecurityError(""); // Clear any previous errors
      } else {
        // If safe mode is already off, just toggle it on without verification
        setSafeMode(true);
      }
    }
  };

  const renderMessageWithLinks = (
    text: string,
    links?: { [key: number]: string }
  ) => {
    if (!links) {
      return text;
    }
    const parts = text.split(/(\[\d+])/);

    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)]/);
      if (match) {
        const linkNumber = parseInt(match[1]);
        const url = links[linkNumber];
        return (
          <MessageLink
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            [{linkNumber}]
          </MessageLink>
        );
      }
      return part;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() === "" || loading) return;

    // Create a user message segment
    const userMessage: Message = { content: inputMessage, isAI: false };
    setChatSegments((prev) => [...prev, userMessage]);
    setInputMessage("");
    setLoading(true);

    // Generate a new session ID and store in ref
    const newSessionId = uuidv4();
    sessionIdRef.current = newSessionId;
    console.log("Created new session ID:", newSessionId);

    try {
      // Convert chatSegments to messages for the API
      const messagesForAPI = chatSegments.filter(isMessage).map((segment) => ({
        content: segment.content,
        isAI: segment.isAI,
        links: "links" in segment ? segment.links : undefined,
      }));

      const response = await fetch(
        `${serverUrl}/message?sessionId=${newSessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messagesForAPI, userMessage],
            safeMode: safeMode,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json(); // Try to get error details from server
        throw new Error(
          errorData.error || `Server returned ${response.status}`
        );
      }

      // Process the JSON response directly to get the AI reply
      const data = await response.json();

      if (data.reply) {
        const aiMessage: Message = {
          content: data.reply,
          isAI: true,
        };
        setChatSegments((prev) => [...prev, aiMessage]);
      } else {
        // Handle cases where reply might be missing, though ideally server should always send it
        console.warn("No reply received from server in POST response.");
      }

      // Note: SSE is still connected in dev for tool updates, but we no longer rely on it for the main message
    } catch (error: any) {
      console.error("Error:", error);
      // Show error as a new AI message
      setChatSegments((prev) => [
        ...prev,
        {
          content: String("Sorry, something went wrong! " + error),
          isAI: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePullBlogs = async () => {
    try {
      setIsPullingBlogs(true);
      const result = await updateBlogsFromBlogger();
      console.log("Blogs pulled successfully:", result);
    } catch (error) {
      console.error("Failed to pull blogs:", error);
    } finally {
      setIsPullingBlogs(false);
    }
  };

  const handleSecuritySubmit = () => {
    if (securityAnswer.trim() === "Blaze") {
      setSafeMode(false);
      setShowTooltip(false);

      setSecurityAnswer("");
      setSecurityError(""); // Clear any error
    } else {
      // Show error message in the tooltip instead of alert
      setSecurityError("Nice try bud");
      setSecurityAnswer("");
    }
  };

  // New function to render tool segments
  const renderToolSegment = (tool: Tool) => {
    const isRunning = tool.status === "running";
    const isSuccess = tool.status === "success";
    const isError = tool.status === "error";

    // Format tool name for display - convert snake_case to Title Case
    const formattedToolName = tool.toolName
      ? tool.toolName
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Unknown Tool";

    // Create a unique key by combining timestamp with toolName
    const uniqueKey = `${tool.timestamp.toString()}-${tool.toolName}`;

    return (
      <ToolUpdateContainer key={uniqueKey}>
        <ToolIcon>🛠️</ToolIcon>
        <ToolName>{formattedToolName}</ToolName>
        {isRunning && <LoadingIcon>⟳</LoadingIcon>}
        {isSuccess && <ToolStatusIcon>✅</ToolStatusIcon>}
        {isError && <ToolStatusIcon>❌</ToolStatusIcon>}
        {isError && tool.error && (
          <span style={{ color: "red", marginLeft: "8px", fontSize: "12px" }}>
            Error: {tool.error}
          </span>
        )}
        <div style={{ marginLeft: "8px", fontSize: "14px" }}>
          {tool.content}
        </div>
      </ToolUpdateContainer>
    );
  };

  // Modified function to handle the SSE message - each event creates a new message
  const handleSSEMessage = (data: any) => {
    console.log("sse data:", data);
    console.log("Current sessionId:", sessionIdRef.current);
    console.log("data.sessionId:", data.sessionId);
    console.log(
      "Match?",
      data.sessionId === sessionIdRef.current || !data.sessionId
    );

    if (data.sessionId === sessionIdRef.current || !data.sessionId) {
      // Handle different types of updates
      if (data.type === "claude_text") {
        // For claude_text updates, always create a new AI message
        if (data.content) {
          const newMessage: Message = {
            content: data.content,
            isAI: true,
          };
          console.log("newMessage:", newMessage);
          setChatSegments((prev) => [...prev, newMessage]);
        }
      } else if (data.type === "tool_call") {
        // Create a new tool segment with running status
        const toolSegment: Tool = {
          content: data.message || "Running tool...",
          status: "running",
          toolName: data.toolName || "unknown_tool",
          isAI: true,
          timestamp: new Date(),
        };
        console.log("toolSegment:", toolSegment);
        setChatSegments((prev) => [...prev, toolSegment]);
      } else if (data.type === "tool_success") {
        // Find the last matching tool call and update its status
        // or create a new tool segment with success status
        console.log("tool_success:", data);
        setChatSegments((prevSegments) => {
          const newSegments = [...prevSegments];
          let toolUpdated = false;

          // Try to find matching tool call to update
          for (let i = newSegments.length - 1; i >= 0; i--) {
            const segment = newSegments[i];
            if (
              isTool(segment) &&
              segment.toolName === data.toolName &&
              segment.status === "running"
            ) {
              newSegments[i] = {
                ...segment,
                status: "success" as const,
                content: data.message || "Tool completed successfully",
              };
              toolUpdated = true;
              break;
            }
          }

          // If no matching tool found, create a new tool segment
          if (!toolUpdated) {
            newSegments.push({
              content: data.message || "Tool completed successfully",
              status: "success" as const,
              toolName: data.toolName || "unknown_tool",
              isAI: true,
              timestamp: new Date(),
            });
          }

          return newSegments;
        });
      } else if (data.type === "tool_error") {
        // Find the last matching tool call and update its status
        // or create a new tool segment with error status
        console.log("tool_error:", data);
        setChatSegments((prevSegments) => {
          const newSegments = [...prevSegments];
          let toolUpdated = false;

          // Try to find matching tool call to update
          for (let i = newSegments.length - 1; i >= 0; i--) {
            const segment = newSegments[i];
            if (
              isTool(segment) &&
              segment.toolName === data.toolName &&
              segment.status === "running"
            ) {
              newSegments[i] = {
                ...segment,
                status: "error" as const,
                content: data.message || "Tool failed",
                error:
                  typeof data.error === "string"
                    ? data.error
                    : "Execution failed",
              };
              toolUpdated = true;
              break;
            }
          }

          // If no matching tool found, create a new tool segment
          if (!toolUpdated) {
            newSegments.push({
              content: data.message || "Tool failed",
              status: "error" as const,
              toolName: data.toolName || "unknown_tool",
              isAI: true,
              error:
                typeof data.error === "string"
                  ? data.error
                  : "Execution failed",
              timestamp: new Date(),
            });
          }

          return newSegments;
        });
      } else {
        console.error("Error no type found: ", data);
      }
    }
  };

  return (
    <AppContainer theme={{ safeMode }}>
      {isAuthenticated && (
        <>
          <UserInfo>
            <span>{user?.name}</span>
            <LogoutButton onClick={logout}>Logout</LogoutButton>
          </UserInfo>
          <PullBlogButton onClick={handlePullBlogs} disabled={isPullingBlogs}>
            {isPullingBlogs ? "Pulling..." : "Pull Blog"}
          </PullBlogButton>
        </>
      )}
      <ChatContainer>
        <Title>
          Chat with{" "}
          <span style={{ position: "relative" }}>
            <TitleSpan onClick={() => handleTitleClick("S")}>"S</TitleSpan>
            <Tooltip $show={showTooltip}>
              <TooltipTitle>Turn off Safe mode</TooltipTitle>
              <div style={{ marginBottom: "10px", fontSize: "14px" }}>
                What is Shubh's gamer tag?
              </div>
              {securityError && (
                <div
                  style={{
                    color: "red",
                    marginBottom: "10px",
                    fontSize: "14px",
                  }}
                >
                  {securityError}
                </div>
              )}
              <AnswerInput
                type="password"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSecuritySubmit();
                  }
                }}
                placeholder="Enter answer here..."
                autoFocus
              />
              <SubmitButton onClick={handleSecuritySubmit}>Submit</SubmitButton>
            </Tooltip>
          </span>
          h<TitleSpan onClick={() => handleTitleClick("u")}>u</TitleSpan>
          bh"
        </Title>
        <MessagesContainer>
          {chatSegments.map((segment, index) =>
            isMessage(segment) ? (
              segment.isAI ? (
                <AIMessage key={index}>
                  {renderMessageWithLinks(segment.content, segment.links)}
                </AIMessage>
              ) : (
                <UserMessage key={index}>{segment.content}</UserMessage>
              )
            ) : (
              renderToolSegment(segment)
            )
          )}
          {loading && (
            <LoadingDotsContainer>
              <LoadingSnakes />
            </LoadingDotsContainer>
          )}
        </MessagesContainer>
        <InputContainer onSubmit={handleSubmit}>
          <MessageInput
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Message"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (inputMessage.trim()) {
                  handleSubmit(e);
                }
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "24px";
              const newHeight = target.scrollHeight;
              if (newHeight > 48) {
                target.style.height = newHeight + "px";
              }
            }}
          />
          <SendButton type="submit" disabled={!inputMessage.trim()} />
        </InputContainer>
      </ChatContainer>
    </AppContainer>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
