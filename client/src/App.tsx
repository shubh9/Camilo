import React, { useState } from 'react';
import styled from 'styled-components';

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

// Styled Components
const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${black};
`;

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: 20px;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 20px;
  background-color: ${darkGrey};
  border-radius: 8px;
`;

const Message = styled.div`
  padding: 10px 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  max-width: 70%;
  word-wrap: break-word;
  box-shadow: 0 1px 2px ${shadowColor};
`;

const InputContainer = styled.form`
  display: flex;
  gap: 10px;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px;
  border: 1px solid ${inputBorderGrey};
  border-radius: 4px;
  font-size: 16px;
  background-color: ${inputBackgroundGrey};
  color: ${white};
`;

const SendButton = styled.button`
  padding: 12px 24px;
  background-color: ${mitGrey};
  color: ${white};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background-color: ${buttonHoverBlue};
  }
`;

// Add a new styled component for hyperlinks
const MessageLink = styled.a`
  color: ${mitGrey};
  text-decoration: underline;
  cursor: pointer;
  
  &:hover {
    color: ${white};
  }
`;

// Types
interface Message {
  text: string;
  isBot: boolean;
  links?: { [key: number]: string }; // Map of reference numbers to URLs
}

// Constants
export const serverUrl = 'http://localhost:3001';

// Main Component
function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  const processResponseText = (text: string): { processedText: string; links: { [key: number]: string } } => {
    const links: { [key: number]: string } = {};
    let linkCounter = 1;
    const urlToNumberMap: { [key: string]: number } = {};

    // Replace URLs in brackets with numbered links
    const processedText = text.replace(/\[([^\]]+)]/g, (match, url) => {
      // Skip if it's not a URL
      if (!url.startsWith('http')) return match;

      // If we've seen this URL before, use its existing number
      if (urlToNumberMap[url]) {
        return `[${urlToNumberMap[url]}]`;
      }

      // Otherwise, assign a new number
      urlToNumberMap[url] = linkCounter;
      links[linkCounter] = url;
      linkCounter++;

      return `[${urlToNumberMap[url]}]`;
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
    if (inputMessage.trim()) {
      setMessages(prev => [...prev, { text: inputMessage, isBot: false }]);
      setInputMessage('');
      
      try {
        const response = await fetch(`${serverUrl}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: inputMessage }),
        });
        
        const data = await response.json();
        
        // Process the response text to replace URLs with numbered links
        const { processedText, links } = processResponseText(data.reply);
        
        setMessages(prev => [...prev, { 
          text: processedText, 
          isBot: true,
          links 
        }]);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  return (
    <AppContainer>
      <ChatContainer>
        <MessagesContainer>
          {messages.map((message, index) => (
            <Message 
              key={index}
              style={{
                marginLeft: message.isBot ? '0' : 'auto',
                backgroundColor: message.isBot ? mitRed : mitGrey,
                color: message.isBot ? white : black,
              }}
            >
              {message.isBot 
                ? renderMessageWithLinks(message.text, message.links)
                : message.text}
            </Message>
          ))}
        </MessagesContainer>
        <InputContainer onSubmit={handleSubmit}>
          <MessageInput
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <SendButton type="submit">
            Send
          </SendButton>
        </InputContainer>
      </ChatContainer>
    </AppContainer>
  );
}

export default App;