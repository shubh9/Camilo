import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";

// Constants
const ANIMATION_DURATION = 2;
const GRID_SIZE = 20;
const UPDATE_INTERVAL = 100;
const ANIMATION_DELAY_INCREMENT = 0.15;
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
  position: fixed;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  margin: 0 2px;
  border-radius: 50%;
  background-color: white;
  transform: translate(${(props) => props.$x}px, ${(props) => props.$y}px);
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
  // For grid-based movement, we can just check if positions are the same
  return pos1.x === pos2.x && pos1.y === pos2.y;
};

// Modify the component interface
interface LoadingDotsProps {
  initialDotCount: number;
  onDotsCountChange: (count: number) => void;
}

interface ScreenDimensions {
  width: number;
  height: number;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  initialDotCount,
  onDotsCountChange,
}) => {
  const [numDots, setNumDots] = useState(initialDotCount);
  const directionRef = useRef<Position>({ x: 1, y: 0 });
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [targetPosition, setTargetPosition] = useState<TargetPosition | null>(
    null
  );
  const [screenDimensions, setScreenDimensions] = useState<ScreenDimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Replace positionHistory with simple positions array
  const [positions, setPositions] = useState<Position[]>(() => {
    return Array(numDots)
      .fill(null)
      .map((_, index) => ({
        x: index * GRID_SIZE,
        y: 0,
      }));
  });

  // Add effect to track screen dimensions
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const updatePositions = useCallback(() => {
    if (!hasGameStarted) return;

    setPositions((prevPositions) => {
      // Create copy for modification
      const newPositions = [...prevPositions];

      // Save the last position in case we need to grow
      const lastPosition = { ...newPositions[newPositions.length - 1] };

      // Calculate new head position
      const newHead = {
        x: newPositions[0].x + directionRef.current.x * GRID_SIZE,
        y: newPositions[0].y + directionRef.current.y * GRID_SIZE,
      };

      // Move body segments - each segment takes the position of the segment in front of it
      for (let i = newPositions.length - 1; i > 0; i--) {
        newPositions[i] = { ...newPositions[i - 1] };
      }

      // Set new head position
      newPositions[0] = newHead;

      if (targetPosition && checkCollision(newHead, targetPosition)) {
        setTargetPosition(generateRandomTarget());
        setNumDots(numDots + 1);
        newPositions.push(lastPosition);
      }

      return newPositions;
    });
  }, [hasGameStarted, targetPosition, numDots]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        return;
      }

      // Prevent default scrolling behavior for up and down arrows
      e.preventDefault();

      if (!hasGameStarted) {
        setHasGameStarted(true);
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
  }, [hasGameStarted]);

  useEffect(() => {
    if (!hasGameStarted) return;

    const interval = setInterval(updatePositions, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [updatePositions, hasGameStarted]);

  useEffect(() => {
    return () => {
      // This will run when the component unmounts
      onDotsCountChange(numDots);
    };
  }, [onDotsCountChange, numDots]);

  console.log("Screen Dimensions width:", screenDimensions.width);
  console.log("Screen Dimensions height:", screenDimensions.height);
  const headX = positions[0].x;
  const headY = positions[0].y;
  if (
    headX < 0 ||
    headX > screenDimensions.width ||
    headY < 0 ||
    headY > screenDimensions.height
  ) {
    console.log("Snake off screen");
  }
  // Update to use the new positions state directly
  const headPosition = positions[0];
  console.log("Snake Head Position:", {
    x: headPosition.x,
    y: headPosition.y,
  });
  console.log("Target Position:", targetPosition);

  return (
    <DotsContainer>
      {targetPosition && (
        <TargetDot $x={targetPosition.x} $y={targetPosition.y} />
      )}
      {positions.map((pos, index) => (
        <StyledDot
          key={index}
          $isAnimating={!hasGameStarted}
          $x={pos.x}
          $y={pos.y}
          $animationDelay={index * ANIMATION_DELAY_INCREMENT}
        />
      ))}
    </DotsContainer>
  );
};

const TargetDot = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: 50%;
  background-color: white;
  transform: translate(${(props) => props.$x}px, ${(props) => props.$y}px);
`;

export default LoadingDots;
