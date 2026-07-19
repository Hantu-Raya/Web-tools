import type { AudioSample, VideoSample } from "mediabunny";

export const MAX_SEGMENTS = 12;
export const MIN_SEGMENT_DURATION = 0.1;

export interface SegmentRange {
  id: number;
  start: number;
  end: number;
}

interface TimedSlice {
  duration: number;
  timestamp: number;
}

interface FrameSlice {
  endFrame: number;
  startFrame: number;
}

function roundTime(seconds: number): number {
  return Number(seconds.toFixed(3));
}

export function segmentDuration(segment: SegmentRange): number {
  return segment.end - segment.start;
}

export function keptDuration(segments: SegmentRange[]): number {
  return segments.reduce(
    (total, segment) => total + segmentDuration(segment),
    0,
  );
}

export function initialSegments(duration: number): SegmentRange[] {
  return [{ id: 1, start: 0, end: roundTime(duration) }];
}

function outputOffset(segments: SegmentRange[], index: number): number {
  return segments
    .slice(0, index)
    .reduce((total, segment) => total + segmentDuration(segment), 0);
}

function intersectVideoSample(
  sample: VideoSample,
  segment: SegmentRange,
  offset: number,
): TimedSlice | null {
  const sampleEnd = sample.timestamp + Math.max(sample.duration, Number.EPSILON);
  const start = Math.max(sample.timestamp, segment.start);
  const end = Math.min(sampleEnd, segment.end);
  if (end <= start) return null;

  return {
    duration: end - start,
    timestamp: offset + start - segment.start,
  };
}

function applyVideoTiming(
  sample: VideoSample,
  timing: TimedSlice,
  hasDuration: boolean,
): VideoSample {
  sample.setTimestamp(timing.timestamp);
  if (hasDuration) sample.setDuration(timing.duration);
  return sample;
}

export function remapVideoSample(
  sample: VideoSample,
  segments: SegmentRange[],
): VideoSample | VideoSample[] | null {
  const intersections = segments.flatMap((segment, index) => {
    const intersection = intersectVideoSample(
      sample,
      segment,
      outputOffset(segments, index),
    );
    return intersection ? [intersection] : [];
  });

  if (intersections.length === 0) return null;
  if (intersections.length === 1) {
    return applyVideoTiming(sample, intersections[0], sample.duration > 0);
  }

  return intersections.map((timing) =>
    applyVideoTiming(sample.clone(), timing, sample.duration > 0)
  );
}

function intersectAudioSample(
  sample: AudioSample,
  segment: SegmentRange,
): FrameSlice | null {
  const start = Math.max(sample.timestamp, segment.start);
  const end = Math.min(sample.timestamp + sample.duration, segment.end);
  if (end <= start) return null;

  const startFrame = Math.max(
    0,
    Math.round((start - sample.timestamp) * sample.sampleRate),
  );
  const endFrame = Math.min(
    sample.numberOfFrames,
    Math.round((end - sample.timestamp) * sample.sampleRate),
  );
  return endFrame > startFrame ? { endFrame, startFrame } : null;
}

export function createAudioSegmentProcessor(
  segments: SegmentRange[],
): (sample: AudioSample) => AudioSample | AudioSample[] | null {
  let outputCursor = 0;

  return (sample) => {
    const overlaps = segments.flatMap((segment) => {
      const overlap = intersectAudioSample(sample, segment);
      return overlap ? [overlap] : [];
    });
    if (overlaps.length === 0) return null;

    const outputs = overlaps.map(({ endFrame, startFrame }) => {
      const output =
        startFrame === 0 && endFrame === sample.numberOfFrames
          ? sample
          : sample.trim(startFrame, endFrame);
      output.setTimestamp(outputCursor);
      outputCursor += output.numberOfFrames / output.sampleRate;
      return output;
    });
    return outputs.length === 1 ? outputs[0] : outputs;
  };
}

function ffmpegTime(seconds: number): string {
  return seconds.toFixed(3);
}

function buildVideoChains(segments: SegmentRange[]): string[] {
  return segments.map((segment, index) =>
    `[0:v:0]trim=start=${ffmpegTime(segment.start)}:end=${ffmpegTime(segment.end)},setpts=PTS-STARTPTS[v${index}]`
  );
}

function buildAudioChains(segments: SegmentRange[]): string[] {
  return segments.map((segment, index) =>
    `[0:a:0]atrim=start=${ffmpegTime(segment.start)}:end=${ffmpegTime(segment.end)},asetpts=PTS-STARTPTS[a${index}]`
  );
}

function buildSingleSegmentFilter(
  videoChain: string,
  audioChain: string,
  includeAudio: boolean,
): string {
  const video = videoChain.replace("[v0]", "[vout]");
  const audio = audioChain.replace("[a0]", "[aout]");
  return includeAudio ? `${video};${audio}` : video;
}

function buildConcatenatedFilter(
  segments: SegmentRange[],
  videoChains: string[],
  audioChains: string[],
  includeAudio: boolean,
): string {
  const videoInputs = segments.map((_, index) => `[v${index}]`).join("");
  const mediaInputs = segments
    .map((_, index) => `[v${index}][a${index}]`)
    .join("");
  const concat = includeAudio
    ? `${mediaInputs}concat=n=${segments.length}:v=1:a=1[vout][aout]`
    : `${videoInputs}concat=n=${segments.length}:v=1:a=0[vout]`;
  const chains = includeAudio
    ? [...videoChains, ...audioChains]
    : videoChains;
  return [...chains, concat].join(";");
}

export function buildSegmentFilter(
  segments: SegmentRange[],
  includeAudio: boolean,
): string {
  const videoChains = buildVideoChains(segments);
  const audioChains = buildAudioChains(segments);
  if (segments.length === 1) {
    return buildSingleSegmentFilter(
      videoChains[0],
      audioChains[0],
      includeAudio,
    );
  }
  return buildConcatenatedFilter(
    segments,
    videoChains,
    audioChains,
    includeAudio,
  );
}

function updateStartBoundary(
  segments: SegmentRange[],
  index: number,
  rawValue: number,
): SegmentRange[] {
  const segment = segments[index];
  const previousEnd = index === 0 ? 0 : segments[index - 1].end;
  segment.start = roundTime(Math.min(
    segment.end - MIN_SEGMENT_DURATION,
    Math.max(previousEnd, rawValue),
  ));
  return segments;
}

function updateEndBoundary(
  segments: SegmentRange[],
  index: number,
  rawValue: number,
  sourceDuration: number,
): SegmentRange[] {
  const segment = segments[index];
  const nextStart =
    index === segments.length - 1 ? sourceDuration : segments[index + 1].start;
  segment.end = roundTime(Math.max(
    segment.start + MIN_SEGMENT_DURATION,
    Math.min(nextStart, rawValue),
  ));
  return segments;
}

export function updateSegmentBoundary(
  segments: SegmentRange[],
  id: number,
  boundary: "start" | "end",
  rawValue: number,
  sourceDuration: number,
): SegmentRange[] {
  const index = segments.findIndex((segment) => segment.id === id);
  if (index === -1) return segments;

  const next = segments.map((segment) => ({ ...segment }));
  return boundary === "start"
    ? updateStartBoundary(next, index, rawValue)
    : updateEndBoundary(next, index, rawValue, sourceDuration);
}

export function splitLongestSegment(
  segments: SegmentRange[],
  nextId: number,
): SegmentRange[] | null {
  const longest = segments.reduce(
    (best, segment, index) => {
      const duration = segmentDuration(segment);
      return duration > best.duration ? { duration, index } : best;
    },
    { duration: 0, index: -1 },
  );
  if (
    longest.index === -1 ||
    longest.duration < MIN_SEGMENT_DURATION * 2
  ) return null;

  const next = segments.map((segment) => ({ ...segment }));
  const selected = next[longest.index];
  const splitAt = roundTime((selected.start + selected.end) / 2);
  const added: SegmentRange = { id: nextId, start: splitAt, end: selected.end };
  selected.end = splitAt;
  next.splice(longest.index + 1, 0, added);
  return next;
}
