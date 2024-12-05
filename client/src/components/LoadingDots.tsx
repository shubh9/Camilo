import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";

// Constants
const ANIMATION_DURATION = 2;
const NUM_DOTS = 3;
const GRID_SIZE = 20;
const UPDATE_INTERVAL = 100;
const ANIMATION_DELAY_INCREMENT = 0.15;
const MAX_DISTANCE = 200; // Maximum distance from center for target
const DOT_SIZE = 12; // Slightly larger than regular dots

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
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
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

interface TargetPosition {
  x: number;
  y: number;
}

// Define min and max values for x and y
const MIN_X = -60;
const MAX_X = 700;
const MIN_Y = -60;
const MAX_Y = 600;

const generateRandomTarget = (): TargetPosition => {
  const x = Math.floor(Math.random() * (MAX_X - MIN_X + 1)) + MIN_X;
  const y = Math.floor(Math.random() * (MAX_Y - MIN_Y + 1)) + MIN_Y;

  // Round to the nearest GRID_SIZE
  const roundedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
  const roundedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

  return { x: roundedX, y: roundedY };
};

// Add this helper function to check for collision
const checkCollision = (pos1: Position, pos2: Position): boolean => {
  // Using the dot size to determine collision
  const distance = Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
  );
  return distance < DOT_SIZE;
};

// Modify the component interface
interface LoadingDotsProps {
  initialDotCount: number;
  onDotsCountChange: (count: number) => void;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  initialDotCount,
  onDotsCountChange,
}) => {
  const [numDots, setNumDots] = useState(initialDotCount);
  const directionRef = useRef<Position>({ x: 1, y: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [targetPosition, setTargetPosition] = useState<TargetPosition | null>(
    null
  );

  const [positionHistory, setPositionHistory] = useState<PositionHistory[]>(
    () => {
      const initialPositions = Array(numDots)
        .fill(null)
        .map((_, index) => ({
          x: index * GRID_SIZE,
          y: 0,
        }));
      return [{ positions: initialPositions, direction: { x: 1, y: 0 } }];
    }
  );

  const updatePositions = useCallback(() => {
    if (!isStarted) return;

    setPositionHistory((prev) => {
      const lastHistory = prev[prev.length - 1];
      const newPositions = [...lastHistory.positions];

      // Calculate new head position
      const newHead = {
        x: lastHistory.positions[0].x + directionRef.current.x * GRID_SIZE,
        y: lastHistory.positions[0].y + directionRef.current.y * GRID_SIZE,
      };

      // Check collision with target
      if (targetPosition && checkCollision(newHead, targetPosition)) {
        setTargetPosition(generateRandomTarget());
        updateNumDots(numDots + 1);

        // Add a new dot at the end of the snake
        const lastDot = lastHistory.positions[lastHistory.positions.length - 1];
        newPositions.push({ ...lastDot });
      }

      newPositions[0] = newHead;

      for (let i = 1; i < newPositions.length; i++) {
        const historyIndex = Math.max(0, prev.length - i);
        const historicalPosition = prev[historyIndex].positions[0];
        newPositions[i] = { ...historicalPosition };
      }

      const newHistory = [
        ...prev.slice(-(numDots + 1)),
        { positions: newPositions, direction: directionRef.current },
      ];
      return newHistory;
    });
  }, [isStarted, targetPosition, numDots]);

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
        setTargetPosition(generateRandomTarget());
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

  useEffect(() => {
    if (!isStarted) return;

    const logInterval = setInterval(() => {
      const headPosition =
        positionHistory[positionHistory.length - 1].positions[0];
      console.log("Snake Head Position:", {
        x: headPosition.x,
        y: headPosition.y,
      });
      console.log("Target Position:", targetPosition);
    }, 3000);

    return () => clearInterval(logInterval);
  }, [isStarted, positionHistory, targetPosition]);

  const currentPositions =
    positionHistory[positionHistory.length - 1].positions;

  const headPosition = positionHistory[positionHistory.length - 1].positions[0];
  console.log("targetPosition", targetPosition);
  console.log("Snake Head Position:", {
    x: headPosition.x,
    y: headPosition.y,
  });

  // Modify the setNumDots call to also notify parent
  const updateNumDots = (newCount: number) => {
    setNumDots(newCount);
    onDotsCountChange(newCount);
  };

  return (
    <DotsContainer>
      {targetPosition && (
        <TargetDot $x={targetPosition.x} $y={targetPosition.y} />
      )}
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

const TargetDot = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: 50%;
  background-color: white;
  transform: translate(${(props) => props.$x}px, ${(props) => props.$y}px);
`;

export default LoadingDots;
