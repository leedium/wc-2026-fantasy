import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PredictionStepper, type StepperStep } from '../PredictionStepper';
import { Tabs } from '@/components/ui/tabs';

function renderStepper(steps: StepperStep[], onValueChange = jest.fn(), value = 'one') {
  return {
    onValueChange,
    ...render(
      <Tabs value={value} onValueChange={onValueChange}>
        <PredictionStepper steps={steps} />
      </Tabs>
    ),
  };
}

const baseSteps: StepperStep[] = [
  { value: 'one', label: 'Group Stage', status: 'current' },
  { value: 'two', label: 'Knockout', status: 'upcoming' },
  { value: 'three', label: 'Tiebreaker', status: 'upcoming' },
];

describe('PredictionStepper', () => {
  it('renders one trigger per step with the configured label', () => {
    renderStepper(baseSteps);
    expect(screen.getByRole('tab', { name: /Group Stage/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Knockout/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tiebreaker/ })).toBeInTheDocument();
  });

  it('shows the step number for upcoming steps', () => {
    renderStepper(baseSteps);
    expect(screen.getByTestId('step-circle-two')).toHaveTextContent('2');
    expect(screen.getByTestId('step-circle-three')).toHaveTextContent('3');
  });

  it('shows a check icon for done steps', () => {
    renderStepper([
      { value: 'one', label: 'Group Stage', status: 'done' },
      { value: 'two', label: 'Knockout', status: 'current' },
      { value: 'three', label: 'Tiebreaker', status: 'upcoming' },
    ]);
    const doneCircle = screen.getByTestId('step-circle-one');
    expect(doneCircle).not.toHaveTextContent('1');
    expect(doneCircle.querySelector('svg')).toBeInTheDocument();
    expect(doneCircle).toHaveClass('bg-green-500');
  });

  it('renders locked steps as disabled triggers', () => {
    renderStepper([
      { value: 'one', label: 'Group Stage', status: 'locked' },
      { value: 'two', label: 'Knockout', status: 'locked' },
      { value: 'three', label: 'Tiebreaker', status: 'locked' },
    ]);
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab).toBeDisabled());
    const lockedCircle = screen.getByTestId('step-circle-one');
    expect(lockedCircle.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onValueChange when a step is clicked', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderStepper(baseSteps);
    await user.click(screen.getByRole('tab', { name: /Knockout/ }));
    expect(onValueChange).toHaveBeenCalledWith('two');
  });

  it('marks the active step with aria-selected', () => {
    renderStepper(baseSteps, jest.fn(), 'two');
    expect(screen.getByRole('tab', { name: /Group Stage/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('tab', { name: /Knockout/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
