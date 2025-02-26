import React, { useEffect, useState } from "react";
import styled from "styled-components";
import VerticalGradient from "./components/VerticalGradient";
import HorizontalGradient from "./components/HorizontalGradient";
import CircularGradient from "./components/CircularGradient";
import LoadingDots from "./components/LoadingDots";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { updateBlogsFromBlogger } from "./services/blogParser";

// Color variables
const mitRed = "#750014";
const mitGrey = "#8b959e";
const white = "#ffffff";
const black = "#000000";
const darkGrey = "#1a1a1a";
const inputBorderGrey = "#333333";
const inputBackgroundGrey = "#2a2a2a";
const buttonBlue = "#007bff";
const buttonHoverBlue = "#0056b3";
const shadowColor = "rgba(0, 0, 0, 0.1)";

// Gradient colors
const gradientStartLightOrange = "#FFEAD6";
const gradientEndDarkOrange = "#F8B585";

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
    ${gradientStartLightOrange},
    ${gradientEndDarkOrange}
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

const Message = styled.div`
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

// Constants
export const serverUrl =
  process.env.NODE_ENV === "production"
    ? "https://camilo-server.vercel.app"
    : "http://localhost:3001";

console.log("serverUrl:", serverUrl);
const AIMessage = styled(Message)`
  margin-left: 0;
  background-color: transparent;
  color: ${black};
  z-index: 1;
`;

const UserMessage = styled(Message)`
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

// Add this styled component with your other styled components
const SimulateButton = styled.button`
  padding: 10px 20px;
  margin: 20px auto;
  display: block;
  background-color: ${white};
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-family: "Inter", sans-serif;
  color: ${black};
  z-index: 1;

  &:hover {
    background-color: ${white}77;
  }
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

// Main Component
function AppContent() {
  const { isAuthenticated, isLoading, user, login, logout, checkAuthStatus } =
    useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDotsCount, setLoadingDotsCount] = useState(3);
  const [isPullingBlogs, setIsPullingBlogs] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  if (isLoading) {
    return (
      <LoginContainer>
        <LoadingDots
          initialDotCount={3}
          onDotsCountChange={setLoadingDotsCount}
        />
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
    }
  };

  const processResponseText = (
    text: string,
    linkData: { [key: string]: string }
  ): { processedText: string; links: { [key: number]: string } } => {
    const links: { [key: number]: string } = {};
    let linkCounter = 1;
    const idToNumberMap: { [key: string]: number } = {};
    const urlToNumberMap: { [key: string]: number } = {};

    // Replace segment IDs with sequential numbers
    console.log("linkData:", linkData);
    console.log("text:", text);
    const processedText = text.replace(/\[(\d+)]/g, (match, segmentId) => {
      const url = linkData[segmentId];

      // Check if this URL has already been assigned a number
      if (urlToNumberMap[url]) {
        idToNumberMap[segmentId] = urlToNumberMap[url];
        return `[${urlToNumberMap[url]}]`;
      }

      // Otherwise, assign a new number and store the URL
      idToNumberMap[segmentId] = linkCounter;
      urlToNumberMap[url] = linkCounter;
      links[linkCounter] = url;
      linkCounter++;

      return `[${idToNumberMap[segmentId]}]`;
    });

    return { processedText, links };
  };

  const renderMessageWithLinks = (
    text: string,
    links?: { [key: number]: string }
  ) => {
    if (!links) {
      return text;
    }
    console.log("Text:", text);
    console.log("Links:", links);

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

  const startSimulation = async () => {
    console.log("Starting simulation...");
    simulateConversation([]);
  };

  const simulateConversation = async (currentMessages: Message[]) => {
    if (currentMessages.length > 20) {
      console.log("Max simulation length reached");
      return;
    }

    setLoading(true);
    try {
      const isUser = currentMessages.length % 2 === 0;

      console.log("messages:", currentMessages);
      console.log("isUser:", isUser);

      const response = await fetch(`${serverUrl}/simulateMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: currentMessages,
          isUser: isUser,
        }),
      });

      const data = await response.json();
      console.log("data:", data);

      const newMessage = {
        content: data.reply,
        isAI: !isUser,
        links: undefined,
      };

      setMessages((prev) => [...prev, newMessage]);

      // Continue the conversation after a short delay
      simulateConversation([...currentMessages, newMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          content: String("Sorry it seems like somethings wrong! " + error),
          isAI: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const userMessage = { content: inputMessage, isAI: false };
      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");
      setLoading(true);

      try {
        const response = await fetch(`${serverUrl}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
          }),
        });
        console.log("Response:", response);
        if (!response.ok) {
          throw new Error("Server returned " + response.status);
        }

        const data = await response.json();
        console.log("data:", data);

        let processedText = data.reply;
        let links = undefined;
        if (data.reply) {
          const { processedText, links } = processResponseText(
            data.reply,
            data.linkData
          );
        } else {
          throw new Error("Got empty server response");
        }

        const aiMessage = {
          content: processedText,
          isAI: true,
          links,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            content: String("Sorry it seems like somethings wrong!  " + error),
            isAI: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
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

  // suggested questions:
  // How did your early experiences with coding shape your approach to problem-solving in your current projects?

  return (
    <AppContainer>
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
          Chat with Sh
          <TitleSpan onClick={() => handleTitleClick("u")}>u</TitleSpan>
          bh
        </Title>
        <MessagesContainer>
          {messages.map((message, index) =>
            message.isAI ? (
              <AIMessage key={index}>
                {renderMessageWithLinks(message.content, message.links)}
              </AIMessage>
            ) : (
              <UserMessage key={index}>{message.content}</UserMessage>
            )
          )}
          {loading && (
            <LoadingDotsContainer>
              <LoadingDots
                initialDotCount={loadingDotsCount}
                onDotsCountChange={setLoadingDotsCount}
              />
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
