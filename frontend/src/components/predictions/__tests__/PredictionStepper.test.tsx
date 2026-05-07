import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PredictionStepper, type StepperStep } from '../PredictionStepper';

const baseTopSteps: StepperStep[] = [
  { value: 'groups', label: 'Group Stage', status: 'current' },
  { value: 'knockout', label: 'Knockout', status: 'upcoming' },
  { value: 'tiebreaker', label: 'Tiebreaker', status: 'upcoming' },
];

const baseSubSteps: StepperStep[] = [
  { value: 'round_of_32', label: 'R32', status: 'current' },
  { value: 'round_of_16', label: 'R16', status: 'upcoming' },
  { value: 'quarter_finals', label: 'QF', status: 'upcoming' },
  { value: 'semi_finals', label: 'SF', status: 'upcoming' },
  { value: 'final', label: 'Final', status: 'upcoming' },
  { value: 'third_place', label: '3rd', status: 'upcoming' },
];

function renderStepper(props: Partial<React.ComponentProps<typeof PredictionStepper>> = {}) {
  const onTopChange = props.onTopChange ?? jest.fn();
  const onSubChange = props.onSubChange ?? jest.fn();
  return {
    onTopChange,
    onSubChange,
    ...render(
      <PredictionStepper
        topSteps={props.topSteps ?? baseTopSteps}
        topValue={props.topValue ?? 'groups'}
        onTopChange={onTopChange}
        subSteps={props.subSteps}
        subValue={props.subValue}
        onSubChange={props.onSubChange ? onSubChange : undefined}
      />
    ),
  };
}

describe('PredictionStepper', () => {
  it('renders one trigger per top step with the configured label', () => {
    renderStepper();
    expect(screen.getByRole('tab', { name: /Group Stage/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Knockout/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tiebreaker/ })).toBeInTheDocument();
  });

  it('shows the step number for upcoming top steps', () => {
    renderStepper();
    expect(screen.getByTestId('step-circle-knockout')).toHaveTextContent('2');
    expect(screen.getByTestId('step-circle-tiebreaker')).toHaveTextContent('3');
  });

  it('shows a check icon for done top steps', () => {
    renderStepper({
      topSteps: [
        { value: 'groups', label: 'Group Stage', status: 'done' },
        { value: 'knockout', label: 'Knockout', status: 'current' },
        { value: 'tiebreaker', label: 'Tiebreaker', status: 'upcoming' },
      ],
      topValue: 'knockout',
    });
    const doneCircle = screen.getByTestId('step-circle-groups');
    expect(doneCircle).not.toHaveTextContent('1');
    expect(doneCircle.querySelector('svg')).toBeInTheDocument();
    expect(doneCircle).toHaveClass('bg-green-500');
  });

  it('renders locked top steps as disabled triggers', () => {
    renderStepper({
      topSteps: [
        { value: 'groups', label: 'Group Stage', status: 'locked' },
        { value: 'knockout', label: 'Knockout', status: 'locked' },
        { value: 'tiebreaker', label: 'Tiebreaker', status: 'locked' },
      ],
    });
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => expect(tab).toBeDisabled());
  });

  it('calls onTopChange when a top step is clicked', async () => {
    const user = userEvent.setup();
    const { onTopChange } = renderStepper();
    await user.click(screen.getByRole('tab', { name: /Knockout/ }));
    expect(onTopChange).toHaveBeenCalledWith('knockout');
  });

  it('marks the active top step with aria-selected', () => {
    renderStepper({
      topValue: 'knockout',
      topSteps: [
        { value: 'groups', label: 'Group Stage', status: 'done' },
        { value: 'knockout', label: 'Knockout', status: 'current' },
        { value: 'tiebreaker', label: 'Tiebreaker', status: 'upcoming' },
      ],
    });
    expect(screen.getByRole('tab', { name: /Group Stage/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('tab', { name: /Knockout/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  describe('hierarchical (sub row)', () => {
    it('does not render the sub row when subSteps is omitted', () => {
      renderStepper();
      expect(screen.queryByTestId('prediction-substepper')).not.toBeInTheDocument();
    });

    it('renders the sub row when subSteps is provided', () => {
      renderStepper({
        topValue: 'knockout',
        subSteps: baseSubSteps,
        subValue: 'round_of_32',
        onSubChange: jest.fn(),
      });
      expect(screen.getByTestId('prediction-substepper')).toBeInTheDocument();
      // Six sub chips with the short labels.
      expect(screen.getByRole('tab', { name: /R32/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /R16/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /QF/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /SF/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /3rd/ })).toBeInTheDocument();
    });

    it('calls onSubChange when a sub chip is clicked', async () => {
      const onSubChange = jest.fn();
      const user = userEvent.setup();
      renderStepper({
        topValue: 'knockout',
        subSteps: baseSubSteps,
        subValue: 'round_of_32',
        onSubChange,
      });
      await user.click(screen.getByRole('tab', { name: /QF/ }));
      expect(onSubChange).toHaveBeenCalledWith('quarter_finals');
    });
  });
});
