import { jest } from '@jest/globals';

const mockLstat = jest.fn().mockResolvedValue({
  isFile: () => true,
  isSymbolicLink: () => true,
});

await jest.unstable_mockModule('fs/promises', () => ({
  default: {
    lstat: mockLstat,
    realpath: jest.fn(),
    stat: jest.fn(),
  },
}));

const { resolvePrivateUploadPath } = await import('../../src/utils/privateUpload.js');

describe('privateUpload symlink safety', () => {
  it('rechaza un symlink antes de resolver su destino', async () => {
    await expect(resolvePrivateUploadPath('/private/uploads', 'link.jpg')).resolves.toBeNull();
    expect(mockLstat).toHaveBeenCalledWith(expect.stringContaining('link.jpg'));
  });
});
