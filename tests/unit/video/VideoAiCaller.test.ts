import { beforeEach, describe, expect, it, vi } from 'vitest';

const readFileMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
}));

vi.mock('@process/utils/initStorage', () => ({
  getBuiltinSkillsCopyDir: () => '/mock-skills',
}));

describe('VideoAiCaller.loadVideoSkillContent', () => {
  beforeEach(() => {
    readFileMock.mockReset();
  });

  it('loads sub-skill from cinematic suite first', async () => {
    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath.includes('/cinematic-video-creation-suite/director/SKILL.md')) {
        return '---\nname: cinematic-video-director\ndescription: test\n---\nPrimary body';
      }
      throw new Error('not found');
    });

    const { loadVideoSkillContent } = await import('@process/services/video/VideoAiCaller');
    const content = await loadVideoSkillContent('director');

    expect(content).toBe('Primary body');
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy suite when cinematic sub-skill is missing', async () => {
    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath.includes('/cinematic-video-creation-suite/prompt/SKILL.md')) {
        throw new Error('missing cinematic');
      }
      if (filePath.includes('/video-creation-suite/prompt/SKILL.md')) {
        return '---\nname: video-prompt\ndescription: test\n---\nLegacy body';
      }
      throw new Error('not found');
    });

    const { loadVideoSkillContent } = await import('@process/services/video/VideoAiCaller');
    const content = await loadVideoSkillContent('prompt');

    expect(content).toBe('Legacy body');
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty string if not found in both suites', async () => {
    readFileMock.mockRejectedValue(new Error('not found'));

    const { loadVideoSkillContent } = await import('@process/services/video/VideoAiCaller');
    const content = await loadVideoSkillContent('not-exist');

    expect(content).toBe('');
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });
});
