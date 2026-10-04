import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the focused medical AI research home', () => {
  render(<App />);

  expect(screen.getByText('CureNet')).toBeInTheDocument();
  expect(screen.getByText('Lung CT Classification')).toBeInTheDocument();
  expect(screen.getByText('Stroke-Pattern Classification')).toBeInTheDocument();
  expect(screen.getByText('Computer vision for lung CT and brain-stroke image analysis.')).toBeInTheDocument();
});
