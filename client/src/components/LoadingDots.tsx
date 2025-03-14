import React, { useState, useEffect, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";

// Constants
const ANIMATION_DURATION = 2;
const GRID_SIZE = 20;
const UPDATE_INTERVAL = 100;
const ANIMATION_DELAY_INCREMENT = 0.15;
const DOT_SIZE = 12; // Slightly larger than regular dots
const STORAGE_KEY = "loadingDotsCount"; // Key for localStorage
const DEFAULT_DOT_COUNT = 3; // Default starting dot count

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
  $left: number;
  $top: number;
  $animationDelay: number;
  $isTeleporting?: boolean;
}

const StyledDot = styled.div<StyledDotProps>`
  position: fixed;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  margin: 0 2px;
  border-radius: 50%;
  background-color: white;
  left: ${(props) => props.$left}px;
  top: ${(props) => props.$top}px;
  transition: ${(props) =>
    props.$isTeleporting ? "none" : "left 0.1s linear, top 0.1s linear"};

  ${({ $isAnimating, $animationDelay }) =>
    $isAnimating &&
    css`
      position: relative; /* Back to relative for animation */
      left: auto; /* Let the flex container handle positioning */
      top: auto;
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
  isTeleporting?: boolean;
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
const checkCollision = (snakeHead: Position, target: Position): boolean => {
  // Create hit boxes based on dot size
  const hitBoxSize = DOT_SIZE;

  // Calculate distances between centers
  const distanceX = Math.abs(snakeHead.x - target.x);
  const distanceY = Math.abs(snakeHead.y - target.y);

  // Check if the distance is less than or equal to the combined hit box sizes
  // We consider it a hit if the distance between centers is less than the hitBoxSize
  return distanceX <= hitBoxSize && distanceY <= hitBoxSize;
};

// Helper function to get the dot count from localStorage
const getSavedDotCount = (): number => {
  try {
    const savedCount = localStorage.getItem(STORAGE_KEY);
    return savedCount ? parseInt(savedCount, 10) : DEFAULT_DOT_COUNT;
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return DEFAULT_DOT_COUNT;
  }
};

// Helper function to save the dot count to localStorage
const saveDotCount = (count: number): void => {
  try {
    localStorage.setItem(STORAGE_KEY, count.toString());
  } catch (error) {
    console.error("Error writing to localStorage:", error);
  }
};

// Keep the interface for TypeScript compatibility, but make all props optional
interface LoadingDotsProps {
  initialDotCount?: number;
  onDotsCountChange?: (count: number) => void;
}

interface ScreenDimensions {
  width: number;
  height: number;
}

const TargetDot = styled.div<{ $left: number; $top: number }>`
  position: fixed;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: 50%;
  background-color: white;
  left: ${(props) => props.$left}px;
  top: ${(props) => props.$top}px;
`;

const ForwardedTarget = React.forwardRef<
  HTMLDivElement,
  { x: number; y: number } & React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { x, y, ...rest } = props;
  return <TargetDot $left={x} $top={y} ref={ref} {...rest} />;
});

const LoadingDots: React.FC<LoadingDotsProps> = ({
  initialDotCount,
  onDotsCountChange,
}) => {
  // Use saved count from localStorage, fallback to passed prop, or use default
  const [numDots, setNumDots] = useState(() => {
    const savedCount = getSavedDotCount();
    return initialDotCount || savedCount;
  });

  const directionRef = useRef<Position>({ x: -1, y: 0 });
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [targetPosition, setTargetPosition] = useState<TargetPosition | null>(
    null
  );
  const [screenDimensions, setScreenDimensions] = useState<ScreenDimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const headDotRef = useRef<HTMLDivElement | null>(null);
  const targetDotRef = useRef<HTMLDivElement | null>(null);
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);

  // Initial dummy positions - will be updated with calculated positions when game starts
  const getDefaultPositions = useCallback(() => {
    return Array(numDots)
      .fill(null)
      .map((_, index) => ({
        x: (numDots - 1 - index) * GRID_SIZE,
        y: 0,
      }));
  }, [numDots]);

  const [positions, setPositions] = useState<Position[]>(getDefaultPositions);

  // Function to reset the game when snake hits itself
  const resetGame = useCallback(() => {
    // Reset to DEFAULT_DOT_COUNT dots
    setNumDots(DEFAULT_DOT_COUNT);
    saveDotCount(DEFAULT_DOT_COUNT);
    // Stop the game and return to loading animation
    setHasGameStarted(false);
    // Clear target
    setTargetPosition(null);
    // Reset direction
    directionRef.current = { x: -1, y: 0 };
    // Reset positions to default
    setPositions(
      Array(DEFAULT_DOT_COUNT)
        .fill(null)
        .map((_, index) => ({
          x: (DEFAULT_DOT_COUNT - 1 - index) * GRID_SIZE,
          y: 0,
        }))
    );
  }, []);

  // Check if snake collides with itself
  const checkSelfCollision = useCallback((head: Position, body: Position[]) => {
    // Start from 4th segment (index 3) because it's impossible to collide with the first few segments
    for (let i = 3; i < body.length; i++) {
      // Using similar collision detection as with target
      const distanceX = Math.abs(head.x - body[i].x);
      const distanceY = Math.abs(head.y - body[i].y);

      // Consider it a collision if centers are very close
      if (distanceX < DOT_SIZE / 2 && distanceY < DOT_SIZE / 2) {
        return true;
      }
    }
    return false;
  }, []);

  // Calculate positions of dots based on container position and flex layout
  const calculateDotsPositions = useCallback(() => {
    if (!dotsContainerRef.current) {
      throw new Error("Container ref not set");
    }

    // Get container rectangle
    const containerRect = dotsContainerRef.current.getBoundingClientRect();
    console.log("Container position:", containerRect);

    // In a flex container with justify-content: center, dots will be centered horizontally
    const singleDotWidth = DOT_SIZE + 4; // DOT_SIZE + margin
    const totalDotsWidth = numDots * singleDotWidth;

    // Calculate starting X position for first dot (center alignment logic)
    const startX =
      containerRect.left + (containerRect.width - totalDotsWidth) / 2;

    // Create positions array with calculated values
    // Reverse the order so head (index 0) is on the right
    return Array(numDots)
      .fill(null)
      .map((_, index) => ({
        x: startX + (numDots - 1 - index) * singleDotWidth,
        y: containerRect.top + containerRect.height / 2 - DOT_SIZE / 2,
      }));
  }, [numDots, getDefaultPositions]);

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

  // Update positions during game play
  const updatePositions = useCallback(() => {
    if (!hasGameStarted) return;

    setPositions((prevPositions) => {
      // Create copy for modification
      const newPositions = [...prevPositions];

      // Save the last position in case we need to grow
      const lastPosition = { ...newPositions[newPositions.length - 1] };

      // Calculate new head position
      let newHead = {
        x: newPositions[0].x + directionRef.current.x * GRID_SIZE,
        y: newPositions[0].y + directionRef.current.y * GRID_SIZE,
        isTeleporting: false,
      };

      // Apply screen wrap-around - if the snake goes off the screen, it appears on the opposite side
      if (newHead.x < 0) {
        newHead.x = screenDimensions.width - GRID_SIZE;
        newHead.isTeleporting = true;
      } else if (newHead.x >= screenDimensions.width) {
        newHead.x = 0;
        newHead.isTeleporting = true;
      }

      if (newHead.y < 0) {
        newHead.y = screenDimensions.height - GRID_SIZE;
        newHead.isTeleporting = true;
      } else if (newHead.y >= screenDimensions.height) {
        newHead.y = 0;
        newHead.isTeleporting = true;
      }

      // Move body segments - each segment takes the position of the segment in front of it
      for (let i = newPositions.length - 1; i > 0; i--) {
        newPositions[i] = {
          ...newPositions[i - 1],
          // If the segment ahead is teleporting, this segment should also teleport
          // This propagates the teleporting state through the entire snake
          isTeleporting:
            newPositions[i - 1].isTeleporting ||
            (i === 1 && newHead.isTeleporting),
        };
      }

      // Set new head position
      newPositions[0] = newHead;

      // Check for collision with target
      if (targetPosition && checkCollision(newHead, targetPosition)) {
        setTargetPosition(
          generateRandomTarget(screenDimensions.width, screenDimensions.height)
        );
        const newDotCount = numDots + 1;
        setNumDots(newDotCount);
        saveDotCount(newDotCount); // Save to localStorage when count changes
        newPositions.push(lastPosition);
      }

      // Check for collision with self - use the updated positions that include the new head
      if (checkSelfCollision(newHead, newPositions)) {
        // Schedule reset outside of this callback to avoid state update issues
        setTimeout(resetGame, 0);
        // Return the current positions to avoid a render with invalid state
        return prevPositions;
      }

      return newPositions;
    });
  }, [
    hasGameStarted,
    targetPosition,
    numDots,
    screenDimensions,
    checkSelfCollision,
    resetGame,
  ]);

  useEffect(() => {
    if (!hasGameStarted) return;

    const interval = setInterval(updatePositions, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [updatePositions, hasGameStarted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        return;
      }

      // Prevent default scrolling behavior
      e.preventDefault();

      if (!hasGameStarted) {
        // Calculate positions based on container and flex layout
        const calculatedPositions = calculateDotsPositions();
        console.log("Calculated dot positions:", calculatedPositions);

        // Update positions state with calculated values
        setPositions(calculatedPositions);

        // Start the game
        setHasGameStarted(true);

        // Set initial target
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
  }, [hasGameStarted, screenDimensions, calculateDotsPositions]);

  // Save dot count when component unmounts and notify parent if callback provided
  useEffect(() => {
    return () => {
      saveDotCount(numDots);
      if (onDotsCountChange) {
        onDotsCountChange(numDots);
      }
    };
  }, [numDots, onDotsCountChange]);

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
        throw new Error("Target outside visible area resetting");
      }
    }
  }, [targetPosition, screenDimensions]);

  return (
    <DotsContainer ref={dotsContainerRef}>
      {targetPosition && (
        <ForwardedTarget
          ref={targetDotRef}
          x={targetPosition.x}
          y={targetPosition.y}
        />
      )}

      {positions.map((pos, index) => (
        <ForwardedDot
          key={index}
          ref={index === 0 ? headDotRef : null}
          $isAnimating={!hasGameStarted}
          $left={pos.x}
          $top={pos.y}
          $isTeleporting={pos.isTeleporting}
          $animationDelay={index * ANIMATION_DELAY_INCREMENT}
        />
      ))}
    </DotsContainer>
  );
};

export default LoadingDots;
