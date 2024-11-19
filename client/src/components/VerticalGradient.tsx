import styled, { keyframes } from 'styled-components';

const moveVertical = keyframes`
  0% { background-position: 75% 50%; }
  50% { background-position: 75% 0%; }
  100% { background-position: 75% 50%; }
`;

const VerticalGradient = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at 75% 25%,
    rgba(248, 133, 142, 0.67) 0%,
    rgba(248, 133, 142, 0.13) 25%,
    transparent 50%
  );
  opacity: 0.8;
  background-size: 200% 200%;
  animation: ${moveVertical} 30s linear infinite;
  z-index: 0;
`;

export default VerticalGradient; 