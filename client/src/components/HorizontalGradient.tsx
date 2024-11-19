import styled, { keyframes } from 'styled-components';

const moveHorizontal = keyframes`
  0% { background-position: 0% 25%; }
  50% { background-position: 90% 25%; }
  100% { background-position: 0% 25%; }
`;

const HorizontalGradient = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at 25% 75%,
    rgba(248, 133, 142, 0.67) 0%,
    rgba(248, 133, 142, 0.13) 25%,
    transparent 50%
  );
  opacity: 0.8;
  background-size: 200% 200%;
  z-index: 0;
  animation: ${moveHorizontal} 30s linear infinite;
`;

export default HorizontalGradient; 