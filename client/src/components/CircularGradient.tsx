import styled, { keyframes } from 'styled-components';

const generateKeyframes = (centerX: number, centerY: number, radius: number) => {
  const steps = 80; // Number of keyframes
  const keyframes = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI; // Calculate angle in radians
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const percentage = (i / steps) * 100;
    keyframes.push(`${percentage}% { background-position: ${x}% ${y}%; }`);
  }

  return keyframes.join(' ');
};

const moveCircular = keyframes`${generateKeyframes(50, 0, 40)}`;

const CircularGradient = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(248, 133, 142, 0.67) 0%,
    rgba(248, 133, 142, 0.13) 25%,
    transparent 50%
  );
  opacity: 0.8;
  background-size: 200% 200%;
  animation: ${moveCircular} 30s linear infinite;
  z-index: 0;
`;

export default CircularGradient; 