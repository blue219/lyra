import { describe, expect, test, vi } from 'vitest';

import type { SpotifyPort, SpotifySnapshot } from '@/src/ports/spotify';
import type { LyricsResult } from '@/src/domain/model';
import { createOverlayController } from './overlay-controller';

function createSpotify(snapshot: SpotifySnapshot) {
  let listener: () => void = () => undefined;
  const spotify: SpotifyPort & { emit: () => void; snapshot: SpotifySnapshot } =
    {
      snapshot,
      readSnapshot: () => spotify.snapshot,
      readPlaybackPositionMs: vi.fn().mockReturnValue(0),
      isDocumentVisible: () => true,
      observe: (next) => {
        listener = next;
        return () => undefined;
      },
      emit: () => listener(),
    };
  return spotify;
}

describe('overlay controller', () => {
  test('publishes only semantic changes and native active-line events', async () => {
    vi.useFakeTimers();
    const spotify = createSpotify({
      activeLineIndex: 0,
      lyricsLines: [{ timeMs: 0, original: 'Hello' }],
      track: { title: 'Song', artists: ['Artist'] },
      hasUnsyncedLyrics: false,
      lyricsContainer: null,
    });
    const controller = createOverlayController({
      spotify,
      clock: {
        now: () => Date.now(),
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) => clearTimeout(handle),
      },
      lyricsClient: {
        fetchLyrics: vi.fn(),
        translateLyrics: vi.fn().mockResolvedValue({
          status: 'available',
          source: 'spotify',
          lines: [{ timeMs: 0, original: 'Hello' }],
        }),
      },
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setTargetLanguage('fr-FR');
    controller.start();
    await vi.runAllTicks();
    const afterReady = listener.mock.calls.length;

    spotify.emit();
    await vi.advanceTimersByTimeAsync(100);
    expect(listener).toHaveBeenCalledTimes(afterReady);

    spotify.snapshot = { ...spotify.snapshot, activeLineIndex: 1 };
    spotify.emit();
    await vi.advanceTimersByTimeAsync(100);
    expect(controller.getState().activeLineIndex).toBe(1);
    expect(listener.mock.calls.length).toBeGreaterThan(afterReady);
    controller.stop();
    vi.useRealTimers();
  });

  test('polls playback only for visible LRCLIB lyrics and tears down resources', async () => {
    let visible = true;
    let position: number | null = null;
    let poll: () => void = () => undefined;
    const clearInterval = vi.fn();
    const spotify = createSpotify({
      activeLineIndex: -1,
      lyricsLines: [],
      track: { title: 'Song', artists: ['Artist'] },
      hasUnsyncedLyrics: false,
      lyricsContainer: null,
    });
    spotify.isDocumentVisible = () => visible;
    spotify.readPlaybackPositionMs = vi.fn(() => position);
    const fetchLyrics = vi.fn().mockResolvedValue({
      status: 'available',
      source: 'lrclib',
      lines: [
        { timeMs: 0, original: 'First' },
        { timeMs: 4_000, original: 'Second' },
      ],
    });
    const controller = createOverlayController({
      spotify,
      lyricsClient: { fetchLyrics, translateLyrics: vi.fn() },
      setInterval: (callback) => {
        poll = callback;
        return 7 as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval,
    });
    const unsubscribe = controller.subscribe(() => undefined);
    controller.start();
    controller.start();
    expect(controller.getState().phase).toBe('waiting-track');
    controller.setTargetLanguage('fr-FR');
    controller.setTargetLanguage('fr-FR');
    await vi.waitFor(() => expect(controller.getState().phase).toBe('ready'));
    expect(fetchLyrics).toHaveBeenCalledOnce();

    visible = false;
    poll();
    expect(spotify.readPlaybackPositionMs).not.toHaveBeenCalled();
    visible = true;
    poll();
    expect(controller.getState().activeLineIndex).toBe(-1);
    position = 4_500;
    poll();
    expect(controller.getState()).toMatchObject({
      activeLineIndex: 1,
      playbackPositionMs: 4_500,
    });
    poll();

    unsubscribe();
    controller.stop();
    controller.stop();
    expect(clearInterval).toHaveBeenCalled();
  });

  test('keeps Spotify originals on translation failure and errors on LRCLIB failure', async () => {
    let scheduled: () => void = () => undefined;
    const spotify = createSpotify({
      activeLineIndex: 0,
      lyricsLines: [{ timeMs: 0, original: 'Hello' }],
      track: { title: 'Song', artists: ['Artist'] },
      hasUnsyncedLyrics: false,
      lyricsContainer: null,
    });
    const controller = createOverlayController({
      spotify,
      clock: {
        now: () => 0,
        setTimeout: (callback) => {
          scheduled = callback;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimeout: vi.fn(),
      },
      lyricsClient: {
        fetchLyrics: vi.fn().mockRejectedValue(new Error('offline')),
        translateLyrics: vi.fn().mockRejectedValue(new Error('offline')),
      },
    });
    controller.setTargetLanguage('fr-FR');
    controller.start();
    await vi.waitFor(() => expect(controller.getState().phase).toBe('ready'));
    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      lyrics: {
        status: 'available',
        source: 'spotify',
        degradationReason: 'provider-error',
      },
    });

    spotify.snapshot = { ...spotify.snapshot, lyricsLines: [] };
    spotify.emit();
    scheduled();
    await vi.waitFor(() => expect(controller.getState().phase).toBe('error'));
    controller.stop();
  });

  test('ignores a stale request after the selected lyrics change', async () => {
    let scheduled: () => void = () => undefined;
    let resolveFirst!: (value: LyricsResult) => void;
    const translateLyrics = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({
        status: 'available',
        source: 'spotify',
        lines: [{ timeMs: 0, original: 'Second', translated: 'Deux' }],
      });
    const spotify = createSpotify({
      activeLineIndex: 0,
      lyricsLines: [{ timeMs: 0, original: 'First' }],
      track: { title: 'Song', artists: ['Artist'] },
      hasUnsyncedLyrics: false,
      lyricsContainer: null,
    });
    const controller = createOverlayController({
      spotify,
      clock: {
        now: () => 0,
        setTimeout: (callback) => {
          scheduled = callback;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimeout: vi.fn(),
      },
      lyricsClient: { fetchLyrics: vi.fn(), translateLyrics },
    });
    controller.setTargetLanguage('fr-FR');
    controller.start();
    spotify.snapshot = {
      ...spotify.snapshot,
      lyricsLines: [{ timeMs: 0, original: 'Second' }],
    };
    spotify.emit();
    scheduled();
    await vi.waitFor(() =>
      expect(controller.getState().lyrics.lines[0]?.original).toBe('Second'),
    );
    resolveFirst({
      status: 'available',
      source: 'spotify',
      lines: [{ timeMs: 0, original: 'First', translated: 'Un' }],
    });
    await Promise.resolve();
    expect(controller.getState().lyrics.lines[0]?.original).toBe('Second');
    controller.stop();
  });
});
