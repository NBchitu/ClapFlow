/**
 * StoryboardBoardViewer DOM tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Shot, Storyboard, StoryboardStreamEvent } from '@/common/types/videoCreation';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFsReadFile, getStreamSubscribers, resetStreamSubscribers } = vi.hoisted(() => {
  const subscribers: Array<(event: unknown) => void> = [];
  return {
    mockFsReadFile: vi.fn(),
    getStreamSubscribers: () => subscribers,
    resetStreamSubscribers: () => {
      subscribers.length = 0;
    },
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      readFile: { invoke: mockFsReadFile },
    },
    videoCreation: {
      storyboardStream: {
        on: (cb: (event: unknown) => void) => {
          const subs = getStreamSubscribers();
          subs.push(cb);
          return () => {
            const idx = subs.indexOf(cb);
            if (idx >= 0) subs.splice(idx, 1);
          };
        },
      },
      updateShot: { invoke: vi.fn().mockResolvedValue({}) },
      generateShotImages: { invoke: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }) },
      insertShot: {
        invoke: vi
          .fn()
          .mockResolvedValue({
            id: 'shot-new',
            sceneIndex: 0,
            shotIndex: 99,
            goal: '',
            sceneDescription: '',
            characters: [],
            action: '',
            dialogue: '',
            shotType: 'MS',
            cameraMove: 'static',
            imagePrompt: '',
            videoPrompt: '',
            lockedTokens: [],
            continuityRefs: {},
            assetRefs: [],
            duration: 4,
            status: 'pending',
            locked: false,
          }),
      },
      deleteShot: { invoke: vi.fn().mockResolvedValue(undefined) },
      reorderShots: { invoke: vi.fn().mockResolvedValue(undefined) },
      getAssets: { invoke: vi.fn().mockResolvedValue({ characters: [], scenes: [], props: [] }) },
      createAsset: {
        invoke: vi
          .fn()
          .mockResolvedValue({ id: 'char-001', name: 'Test', description: '', appearance: '', lockedTokens: [] }),
      },
      applyAssetToShots: { invoke: vi.fn().mockResolvedValue(undefined) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key.split('.').pop() ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Spin: ({ size: _size, children }: { size?: number; children?: React.ReactNode }) =>
    React.createElement('div', { role: 'status' }, children ?? 'loading'),
  Button: ({
    children,
    onClick,
    ...props
  }: React.ComponentProps<'button'> & { type?: string; size?: string; loading?: boolean; disabled?: boolean }) =>
    React.createElement('button', { onClick, ...props }, children),
  Slider: ({
    value,
    onChange,
    onAfterChange,
  }: {
    value?: number;
    onChange?: (v: number) => void;
    onAfterChange?: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
  }) =>
    React.createElement('input', {
      type: 'range',
      value: value ?? 0,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(Number(e.target.value)),
      onMouseUp: (e: React.MouseEvent<HTMLInputElement>) =>
        onAfterChange?.(Number((e.target as HTMLInputElement).value)),
    }),
  Select: ({
    value,
    options,
    onChange,
  }: {
    value?: string;
    options?: Array<{ label: string; value: string }>;
    onChange?: (v: string) => void;
    size?: string;
  }) =>
    React.createElement(
      'select',
      { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) },
      options?.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))
    ),
  Tag: ({
    children,
    closable,
    onClose,
  }: {
    children?: React.ReactNode;
    closable?: boolean;
    onClose?: () => void;
    size?: string;
  }) =>
    React.createElement(
      'span',
      null,
      children,
      closable ? React.createElement('button', { onClick: onClose, 'aria-label': 'close' }, '×') : null
    ),
  Radio: Object.assign(
    ({ children, value, ...props }: React.ComponentProps<'label'> & { value?: string }) =>
      React.createElement('label', { ...props, 'data-value': value }, children),
    {
      Group: ({
        children,
        onChange,
      }: {
        children?: React.ReactNode;
        onChange?: (val: string) => void;
        value?: string;
        type?: string;
        size?: string;
      }) =>
        React.createElement(
          'div',
          {
            onClick: (e: React.MouseEvent<HTMLDivElement>) => {
              const target = e.target as HTMLElement;
              const val = target.getAttribute('data-value');
              if (val) onChange?.(val);
            },
          },
          children
        ),
    }
  ),
  Drawer: ({
    children,
    visible,
    title,
    onCancel,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
    title?: React.ReactNode;
    onCancel?: () => void;
    placement?: string;
    width?: number;
    footer?: React.ReactNode;
  }) =>
    visible
      ? React.createElement(
          'div',
          { role: 'dialog', 'aria-label': String(title) },
          React.createElement('button', { onClick: onCancel, 'aria-label': 'close-drawer' }, '×'),
          children
        )
      : null,
  Tabs: Object.assign(
    ({ children }: { children?: React.ReactNode; defaultActiveTab?: string; size?: string }) =>
      React.createElement('div', null, children),
    {
      TabPane: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode; key?: string }) =>
        React.createElement('div', { 'data-tab': String(title) }, children),
    }
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    size: _size,
  }: {
    value?: string;
    onChange?: (val: string) => void;
    placeholder?: string;
    size?: string;
  }) =>
    React.createElement('input', {
      value: value ?? '',
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value),
    }),
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'react-flow' }, children),
  Background: () => React.createElement('div', { 'data-testid': 'react-flow-bg' }),
  MiniMap: () => React.createElement('div', { 'data-testid': 'react-flow-minimap' }),
  Panel: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Handle: () => React.createElement('div'),
  BaseEdge: () => React.createElement('path'),
  getSmoothStepPath: () => ['M0 0 C 0 0 0 0 0 0'],
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
  useViewport: () => ({ zoom: 1 }),
  Position: { Left: 'left', Right: 'right' },
  BackgroundVariant: { Dots: 'dots' },
}));

// Static imports after mocks
import StoryboardBoardViewer from '@renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/StoryboardBoardViewer';
import ShotCard from '@renderer/pages/conversation/Preview/components/viewers/StoryboardBoardViewer/ShotCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShot(id: string, overrides?: Partial<Shot>): Shot {
  const idx = parseInt(id.replace('shot-', ''), 10) || 1;
  return {
    id,
    sceneId: 'scene-01',
    sceneIndex: 0,
    sceneShotIndex: idx,
    shotIndex: idx,
    goal: `Goal for ${id}`,
    sceneDescription: 'Scene',
    characters: [],
    action: '',
    dialogue: '',
    shotType: 'MS',
    cameraMove: 'static',
    imagePrompt: '',
    videoPrompt: '',
    lockedTokens: [],
    continuityRefs: {},
    assetRefs: [],
    duration: 4,
    status: 'pending',
    locked: false,
    ...overrides,
  };
}

function makeStoryboard(shotIds: string[]): Storyboard {
  return {
    id: 'sb-001',
    title: 'Test Storyboard',
    projectRoot: '/tmp/test-project',
    scriptPath: '/tmp/test-project/00-script/script.md',
    style: undefined,
    scenes: [
      {
        id: 'scene-01',
        name: 'Scene 1',
        description: 'Desc',
        shotIds,
      },
    ],
    shotIds,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StoryboardBoardViewer', () => {
  beforeEach(() => {
    resetStreamSubscribers();
    mockFsReadFile.mockReset();
  });

  it('renders shot cards after IPC resolves', async () => {
    const sb = makeStoryboard(['shot-001', 'shot-002']);
    mockFsReadFile
      .mockResolvedValueOnce(JSON.stringify(makeShot('shot-001')))
      .mockResolvedValueOnce(JSON.stringify(makeShot('shot-002')));

    render(
      React.createElement(StoryboardBoardViewer, {
        content: JSON.stringify(sb),
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows parse error when content is invalid JSON', async () => {
    render(
      React.createElement(StoryboardBoardViewer, {
        content: 'not valid json',
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/loadFailed/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when storyboard has no shots', () => {
    const sb = makeStoryboard([]);
    render(
      React.createElement(StoryboardBoardViewer, {
        content: JSON.stringify(sb),
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );
    expect(screen.getByText(/empty/i)).toBeInTheDocument();
  });

  it('registers storyboardStream subscriber and handles shot-updated event', async () => {
    const sb = makeStoryboard(['shot-001']);
    mockFsReadFile.mockResolvedValueOnce(JSON.stringify(makeShot('shot-001')));

    render(
      React.createElement(StoryboardBoardViewer, {
        content: JSON.stringify(sb),
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );

    await waitFor(() => expect(mockFsReadFile).toHaveBeenCalledTimes(1));
    expect(getStreamSubscribers().length).toBeGreaterThan(0);

    const updatedShot = makeShot('shot-001', { status: 'prompts-ready' });
    await act(async () => {
      getStreamSubscribers().forEach((cb) =>
        (cb as (e: StoryboardStreamEvent) => void)({
          type: 'shot-updated',
          shotId: 'shot-001',
          shot: updatedShot,
        })
      );
    });
  });

  it('unsubscribes from storyboardStream on unmount', async () => {
    const sb = makeStoryboard([]);
    const { unmount } = render(
      React.createElement(StoryboardBoardViewer, {
        content: JSON.stringify(sb),
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );
    await waitFor(() => expect(getStreamSubscribers().length).toBeGreaterThan(0));
    unmount();
    expect(getStreamSubscribers().length).toBe(0);
  });

  it('switches to flow view and renders React Flow canvas', async () => {
    const sb = makeStoryboard(['shot-001']);
    mockFsReadFile.mockResolvedValueOnce(JSON.stringify(makeShot('shot-001')));

    render(
      React.createElement(StoryboardBoardViewer, {
        content: JSON.stringify(sb),
        filePath: '/tmp/test/01-storyboard/storyboard.json',
      })
    );

    await waitFor(() => expect(mockFsReadFile).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('◎'));

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });
});

describe('ShotCard', () => {
  it('renders without crashing for all shot statuses', () => {
    const statuses: Array<Shot['status']> = [
      'pending',
      'prompts-ready',
      'image-generating',
      'image-generated',
      'image-approved',
      'video-generated',
      'approved',
    ];

    for (const status of statuses) {
      const shot = makeShot('shot-001', { status });
      const { unmount } = render(
        React.createElement(ShotCard, {
          shot,
          cardSize: 'M',
          isHighlighted: false,
          onClick: () => {},
        })
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('shows ⚠ for error-severity QA issue', () => {
    const shot = makeShot('shot-001', {
      qaIssues: [{ type: 'character-drift', severity: 'error', description: 'D', suggestion: 'S' }],
    });
    render(React.createElement(ShotCard, { shot, cardSize: 'M', isHighlighted: false, onClick: () => {} }));
    expect(screen.getByRole('button').textContent).toContain('⚠');
  });

  it('shows 🔒 when shot is locked', () => {
    const shot = makeShot('shot-001', { locked: true });
    render(React.createElement(ShotCard, { shot, cardSize: 'M', isHighlighted: false, onClick: () => {} }));
    expect(screen.getByRole('button').textContent).toContain('🔒');
  });

  it('calls onClick with the shot when clicked', () => {
    const shot = makeShot('shot-001');
    const onClick = vi.fn();
    render(React.createElement(ShotCard, { shot, cardSize: 'M', isHighlighted: false, onClick }));
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(shot, expect.anything());
  });

  it('hides index label in S size', () => {
    const shot = makeShot('shot-001');
    const { container } = render(
      React.createElement(ShotCard, { shot, cardSize: 'S', isHighlighted: false, onClick: () => {} })
    );
    expect(container.querySelectorAll('span.text-11px').length).toBe(0);
  });

  it('applies highlighted border class when isHighlighted=true', () => {
    const shot = makeShot('shot-001');
    render(React.createElement(ShotCard, { shot, cardSize: 'M', isHighlighted: true, onClick: () => {} }));
    expect(screen.getByRole('button').className).toContain('border-brand-6');
  });
});
