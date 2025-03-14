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

// Create a forwardRef wrapper for the StyledDot component
const ForwardedDot = React.forwardRef<
  HTMLDivElement,
  StyledDotProps & React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <StyledDot {...props} ref={ref} />);

interface Position {
  x: number;
  y: number;
}

interface TargetPosition {
  x: number;
  y: number;
}

const generateRandomTarget = (
  screenWidth: number,
  screenHeight: number
): TargetPosition => {
  // Use screen dimensions for bounds instead of constants
  const x = Math.floor(Math.random() * screenWidth);
  const y = Math.floor(Math.random() * screenHeight);

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

// Define TargetDot styled component first
const TargetDot = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: 50%;
  background-color: white;
  transform: translate(${(props) => props.$x}px, ${(props) => props.$y}px);
`;

// Create forwardRef wrapper for the TargetDot component
const ForwardedTarget = React.forwardRef<
  HTMLDivElement,
  { $x: number; $y: number } & React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <TargetDot {...props} ref={ref} />);

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
  // Add refs for the head dot and target dot elements
  const headDotRef = useRef<HTMLDivElement | null>(null);
  const targetDotRef = useRef<HTMLDivElement | null>(null);

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
        setTargetPosition(
          generateRandomTarget(screenDimensions.width, screenDimensions.height)
        );
        setNumDots(numDots + 1);
        newPositions.push(lastPosition);
      }

      return newPositions;
    });
  }, [hasGameStarted, targetPosition, numDots, screenDimensions]);

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
        setTargetPosition(
          generateRandomTarget(screenDimensions.width, screenDimensions.height)
        );
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
  }, [hasGameStarted, screenDimensions]);

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

  // Calculate actual screen coordinates for the head dot
  const getActualScreenCoordinates = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      return {
        screenX: rect.left + rect.width / 2, // Center X of the dot
        screenY: rect.top + rect.height / 2, // Center Y of the dot
      };
    }
    return { screenX: null, screenY: null };
  };

  const headActualCoords = getActualScreenCoordinates(headDotRef);
  const targetActualCoords = getActualScreenCoordinates(targetDotRef);

  // console.log("Snake Head Position (Relative):", {
  //   x: headPosition.x,
  //   y: headPosition.y,
  // });
  console.log(
    "Snake Head Position (Actual Screen Coordinates):",
    headActualCoords
  );
  // console.log("Target Position (Relative):", targetPosition);
  // console.log(
  //   "Target Position (Actual Screen Coordinates):",
  //   targetActualCoords
  // );

  // Validate target position is within screen bounds
  useEffect(() => {
    if (targetPosition && targetDotRef.current) {
      const rect = targetDotRef.current.getBoundingClientRect();

      // Check if target is outside visible area
      if (
        rect.right > screenDimensions.width ||
        rect.left < 0 ||
        rect.bottom > screenDimensions.height ||
        rect.top < 0
      ) {
        console.log("Target outside visible area resetting");
        // Generate a new position that's safely within bounds
        setTargetPosition(
          generateRandomTarget(screenDimensions.width, screenDimensions.height)
        );
      }
    }
  }, [targetPosition, screenDimensions]);

  return (
    <DotsContainer>
      {targetPosition && (
        <ForwardedTarget
          ref={targetDotRef}
          $x={targetPosition.x}
          $y={targetPosition.y}
        />
      )}
      {positions.map((pos, index) => (
        <ForwardedDot
          key={index}
          ref={index === 0 ? headDotRef : null}
          $isAnimating={!hasGameStarted}
          $x={pos.x}
          $y={pos.y}
          $animationDelay={index * ANIMATION_DELAY_INCREMENT}
        />
      ))}
    </DotsContainer>
  );
};

export default LoadingDots;
