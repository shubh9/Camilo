import React, { useState } from 'react';
import styled from 'styled-components';
import VerticalGradient from './components/VerticalGradient';
import HorizontalGradient from './components/HorizontalGradient';
import CircularGradient from './components/CircularGradient';
import LoadingDots from './components/LoadingDots';

// Color variables
const mitRed = '#750014';
const mitGrey = '#8b959e';
const white = '#ffffff';
const black = '#000000';
const darkGrey = '#1a1a1a';
const inputBorderGrey = '#333333';
const inputBackgroundGrey = '#2a2a2a';
const buttonBlue = '#007bff';
const buttonHoverBlue = '#0056b3';
const shadowColor = 'rgba(0, 0, 0, 0.1)';

// Gradient colors
const gradientStartLightOrange = '#FFEAD6';
const gradientEndDarkOrange = '#F8B585';

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
  background: linear-gradient(to bottom, ${gradientStartLightOrange}, ${gradientEndDarkOrange});
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
  padding: 8px 12px;
  font-size: 16px;
  background-color: ${white}33;
  color: ${black};
  resize: none;
  line-height: 1.5;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  border-radius: 20px;
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
  background-image: url('/arrow_up.png');
  background-color: transparent;
  background-size: 24px;
  background-position: center;
  background-repeat: no-repeat;
  border: none;
  cursor: pointer;
  opacity: ${props => props.disabled ? 0 : 1};
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
export const serverUrl = 'https://camilo-server.vercel.app';
// export const serverUrl = 'http://localhost:3001';

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

// Main Component
function App() {
  const [messages, setMessages] = useState<Message[]>([]);  
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const processResponseText = (text: string, linkData: { [key: string]: string }): { processedText: string; links: { [key: number]: string } } => {
    const links: { [key: number]: string } = {};
    let linkCounter = 1;
    const idToNumberMap: { [key: string]: number } = {};
    const urlToNumberMap: { [key: string]: number } = {};

    // Replace segment IDs with sequential numbers
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

  const renderMessageWithLinks = (text: string, links?: { [key: number]: string }) => {
    if (!links) return text;

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
    console.log('Submitting message:', inputMessage);
    if (inputMessage.trim()) {
      // Add user message to chat
      const userMessage = { content: inputMessage, isAI: false };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setLoading(true); // Set loading to true
      
      try {
        const response = await fetch(`${serverUrl}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages: [...messages, userMessage]
          }),
        });
        console.log('Response:', response);
        const data = await response.json();
        
        // Process the response text to replace segment ids with numbered links
        const { processedText, links } = processResponseText(data.reply, data.linkData);
        
        setMessages(prev => [...prev, { 
          content: processedText, 
          isAI: true,
          links 
        }]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false); // Set loading to false after response
      }
    }
  };

  // suggested questions:
  // How did your early experiences with coding shape your approach to problem-solving in your current projects?


  return (
    <AppContainer>
      <VerticalGradient />
      <HorizontalGradient />
      <CircularGradient />
      <Title>Chat with Shubh</Title>
      <ChatContainer>
        <MessagesContainer>
          {messages.map((message, index) => (
            message.isAI ? (
              <AIMessage key={index}>
                {renderMessageWithLinks(message.content, message.links)}
              </AIMessage>
            ) : (
              <UserMessage key={index}>
                {message.content}
              </UserMessage>
            )
          ))}
          {loading && (
            <LoadingDotsContainer>
              <LoadingDots />
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
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputMessage.trim()) {
                  handleSubmit(e);
                }
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '24px';
              const newHeight = target.scrollHeight;
              if (newHeight > 48) {
                target.style.height = newHeight + 'px';
              }
            }}
          />
          <SendButton 
            type="submit"
            disabled={!inputMessage.trim()}
          />
        </InputContainer>
      </ChatContainer>
    </AppContainer>
  );
}

export default App;