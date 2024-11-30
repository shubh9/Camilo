import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";

// Constants
const ANIMATION_DURATION = 2;
const NUM_DOTS = 3;
const GRID_SIZE = 20;
const UPDATE_INTERVAL = 100;
const ANIMATION_DELAY_INCREMENT = 0.15;

// Keyframes for the loading animation
const dotAnimation = keyframes`
  0%, 20% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

// Styled component for the loading dots
const DotsContainer = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 20px;
`;

interface StyledDotProps {
  $isAnimating: boolean;
  $x: number;
  $y: number;
  $animationDelay: number;
}

const StyledDot = styled.div<StyledDotProps>`
  position: absolute;
  width: 12px;
  height: 12px;
  margin: 0 2px;
  border-radius: 50%;
  background-color: white;
  transform: translate(
    calc(
      ${(props) => props.$x}px +
        ${(props) => (props.$isAnimating ? "0px" : "0px")}
    ),
    ${(props) => props.$y}px
  );
  transition: transform 0.1s linear;

  ${({ $isAnimating, $animationDelay }) =>
    $isAnimating &&
    css`
      position: relative;
      transform: none;
      animation: ${dotAnimation} ${ANIMATION_DURATION}s infinite;
      animation-delay: ${$animationDelay}s;
    `}
`;

interface Position {
  x: number;
  y: number;
}

interface PositionHistory {
  positions: Position[];
  direction: Position;
}

const LoadingDots: React.FC = () => {
  const [positionHistory, setPositionHistory] = useState<PositionHistory[]>(
    () => {
      const initialPositions = Array(NUM_DOTS)
        .fill(null)
        .map((_, index) => ({
          x: index * GRID_SIZE,
          y: 0,
        }));
      return [{ positions: initialPositions, direction: { x: 1, y: 0 } }];
    }
  );

  const directionRef = useRef<Position>({ x: 1, y: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  const updatePositions = useCallback(() => {
    if (!isStarted) return;

    setPositionHistory((prev) => {
      const lastHistory = prev[prev.length - 1];
      const newPositions = [...lastHistory.positions];

      newPositions[0] = {
        x: lastHistory.positions[0].x + directionRef.current.x * GRID_SIZE,
        y: lastHistory.positions[0].y + directionRef.current.y * GRID_SIZE,
      };

      for (let i = 1; i < newPositions.length; i++) {
        const historyIndex = Math.max(0, prev.length - i);
        const historicalPosition = prev[historyIndex].positions[0];
        newPositions[i] = { ...historicalPosition };
      }

      const newHistory = [
        ...prev.slice(-(NUM_DOTS + 1)),
        { positions: newPositions, direction: directionRef.current },
      ];
      return newHistory;
    });
  }, [isStarted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        return;
      }

      // Prevent default scrolling behavior for up and down arrows
      e.preventDefault();

      setIsAnimating(false);
      if (!isStarted) {
        setIsStarted(true);
      }

      switch (e.key) {
        case "ArrowUp":
          if (directionRef.current.y !== 1) {
            directionRef.current = { x: 0, y: -1 };
          }
          break;
        case "ArrowDown":
          if (directionRef.current.y !== -1) {
            directionRef.current = { x: 0, y: 1 };
          }
          break;
        case "ArrowLeft":
          if (directionRef.current.x !== 1) {
            directionRef.current = { x: -1, y: 0 };
          }
          break;
        case "ArrowRight":
          if (directionRef.current.x !== -1) {
            directionRef.current = { x: 1, y: 0 };
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(updatePositions, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [updatePositions, isStarted]);

  const currentPositions =
    positionHistory[positionHistory.length - 1].positions;

  return (
    <DotsContainer>
      {currentPositions.map((pos, index) => (
        <StyledDot
          key={index}
          $isAnimating={isAnimating}
          $x={pos.x}
          $y={pos.y}
          $animationDelay={index * ANIMATION_DELAY_INCREMENT}
        />
      ))}
    </DotsContainer>
  );
};

export default LoadingDots;
