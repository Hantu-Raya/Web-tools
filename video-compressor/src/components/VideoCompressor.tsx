import { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  Input,
  MATROSKA,
  MP4,
  Mp4OutputFormat,
  Output,
  QTFF,
  WEBM,
} from "mediabunny";
import {
  ArrowLeftIcon as ArrowLeft,
  CheckCircleIcon as CheckCircle,
  DownloadSimpleIcon as DownloadSimple,
  FileVideoIcon as FileVideo,
  GaugeIcon as Gauge,
  HardDrivesIcon as HardDrives,
  ShieldCheckIcon as ShieldCheck,
  SlidersHorizontalIcon as SlidersHorizontal,
  UploadSimpleIcon as UploadSimple,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from "@phosphor-icons/react";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MIN_VIDEO_BITRATE_KBPS = 150;
const MIN_AUDIO_BITRATE_KBPS = 64;
const CONTAINER_HEADROOM = 0.96;
const NATIVE_TARGET_FLOOR = 0.93;
const NATIVE_CORRECTION_TARGET = 1.03;
const MAX_NATIVE_ATTEMPTS = 3;

type Phase =
  | "empty"
  | "ready"
  | "loading"
  | "analyzing"
  | "pass-two"
  | "finalizing"
  | "complete"
  | "error";

type CompressionProfile = "quality" | "compatible";

interface VideoDetails {
  duration: number;
  width: number;
  height: number;
}

interface SelectedVideo extends VideoDetails {
  file: File;
  previewUrl: string;
}

interface CompressionResult {
  blob: Blob;
  fileName: string;
  size: number;
}

const OUTPUT_DETAILS = {
  description: "MP4 video",
  extension: ".mp4",
  label: "MP4",
  mimeType: "video/mp4",
} as const;

interface WritableFileTarget {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface SaveFileHandle {
  createWritable(): Promise<WritableFileTarget>;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<SaveFileHandle>;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function safeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^/.]+$/, "");
  return stem.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "video";
}

function inputExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : "mp4";
}

function getSaveFilePicker(): SaveFilePicker | null {
  const candidate = Reflect.get(window, "showSaveFilePicker");
  return typeof candidate === "function"
    ? (candidate.bind(window) as SaveFilePicker)
    : null;
}

function readVideoDetails(file: File): Promise<VideoDetails> {
  const { promise, resolve, reject } = Promise.withResolvers<VideoDetails>();
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  const cleanUp = () => {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  };

  video.preload = "metadata";
  video.onloadedmetadata = () => {
    const details = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
    cleanUp();

    if (!Number.isFinite(details.duration) || details.duration <= 0) {
      reject(new Error("The video duration could not be read."));
      return;
    }

    resolve(details);
  };
  video.onerror = () => {
    cleanUp();
    reject(new Error("This browser could not read the selected video."));
  };
  video.src = objectUrl;

  return promise;
}

function targetBounds(video: SelectedVideo): { min: number; max: number } {
  const sourceMegabytes = video.file.size / 1_000_000;
  const codecFloor =
    (video.duration * (MIN_VIDEO_BITRATE_KBPS + MIN_AUDIO_BITRATE_KBPS)) /
    8000 /
    CONTAINER_HEADROOM;
  const max = Math.max(0.2, sourceMegabytes * 0.95);
  const min = Math.min(max, Math.max(0.2, codecFloor));
  return { min, max };
}

function chooseAudioBitrate(totalBitrate: number): number {
  if (totalBitrate >= 1200) return 128;
  if (totalBitrate >= 500) return 96;
  return MIN_AUDIO_BITRATE_KBPS;
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "loading":
      return "Loading the local compression engine";
    case "analyzing":
      return "Preparing the video";
    case "pass-two":
      return "Encoding toward your target";
    case "finalizing":
      return "Finalizing the video";
    default:
      return "Working locally in your browser";
  }
}


export default function VideoCompressor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const isCancellingRef = useRef(false);
  const coreBlobUrlsRef = useRef<string[]>([]);
  const conversionRef = useRef<Conversion | null>(null);
  const engineModeRef = useRef<"native" | "single" | null>(null);
  const ffmpegPassRef = useRef<1 | 2>(1);
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [targetSize, setTargetSize] = useState(0);
  const [compressionProfile, setCompressionProfile] = useState<CompressionProfile>("quality");
  const [phase, setPhase] = useState<Phase>("empty");
  const [progress, setProgress] = useState(0);
  const [statusCopy, setStatusCopy] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [engineMode, setEngineMode] = useState<"native" | "single" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isProcessing = [
    "loading",
    "analyzing",
    "pass-two",
    "finalizing",
  ].includes(phase);

  useEffect(() => {
    return () => {
      if (video?.previewUrl) URL.revokeObjectURL(video.previewUrl);
    };
  }, [video]);


  useEffect(() => {
    return () => {
      void conversionRef.current?.cancel();
      ffmpegRef.current?.terminate();
      coreBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const bounds = useMemo(() => (video ? targetBounds(video) : { min: 0.2, max: 1 }), [video]);
  const bitratePlan = useMemo(() => {
    if (!video || targetSize <= 0) return null;
    const total = Math.floor((targetSize * 8000 * CONTAINER_HEADROOM) / video.duration);
    const audio = chooseAudioBitrate(total);
    return {
      audio,
      total,
      video: Math.max(MIN_VIDEO_BITRATE_KBPS, total - audio),
      source: Math.round((video.file.size * 8) / video.duration / 1000),
    };
  }, [targetSize, video]);

  const resetResult = () => {
    setResult(null);
    setProgress(0);
    setStatusCopy("");
  };

  const saveResult = async () => {
    if (!result || isSaving) return;

    setError("");
    setIsSaving(true);

    try {
      const saveFilePicker = getSaveFilePicker();
      if (saveFilePicker) {
        const outputDetails = OUTPUT_DETAILS;
        const handle = await saveFilePicker({
          suggestedName: result.fileName,
          types: [{
            description: outputDetails.description,
            accept: {
              [outputDetails.mimeType]: [outputDetails.extension],
            },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(result.blob);
        await writable.close();
        return;
      }

      const outputFile = new File([result.blob], result.fileName, {
        type: result.blob.type,
      });
      if (navigator.canShare?.({ files: [outputFile] })) {
        await navigator.share({
          files: [outputFile],
          title: "Compressed video",
        });
        return;
      }

      const downloadUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = result.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        return;
      }

      console.error("Video save failed", saveError);
      setError("The video could not be saved. Try choosing a different folder.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectFile = async (file: File | undefined) => {
    if (!file || isProcessing) return;

    setError("");
    resetResult();

    if (!file.type.startsWith("video/")) {
      setError("Choose a video file such as MP4, WebM, MOV, or MKV.");
      setPhase(video ? "ready" : "error");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError("Choose a video smaller than 2 GB. Browser memory cannot safely process larger files.");
      setPhase(video ? "ready" : "error");
      return;
    }

    setPhase("analyzing");
    setStatusCopy("Reading video details");

    try {
      const details = await readVideoDetails(file);
      const selected: SelectedVideo = {
        file,
        ...details,
        previewUrl: URL.createObjectURL(file),
      };
      const nextBounds = targetBounds(selected);
      setVideo(selected);
      setTargetSize(Number(((nextBounds.min + nextBounds.max) / 2).toFixed(1)));
      setPhase("ready");
      setStatusCopy("");
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "The video could not be opened.");
      setPhase(video ? "ready" : "error");
      setStatusCopy("");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeVideo = () => {
    if (isProcessing) return;
    setVideo(null);
    setTargetSize(0);
    setError("");
    resetResult();
    setPhase("empty");
  };

  const ensureFFmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: currentProgress }) => {
      const normalized = Math.max(0, Math.min(1, currentProgress));
      const overall = ffmpegPassRef.current === 1
        ? 10 + normalized * 40
        : 52 + normalized * 45;
      setProgress(Math.round(overall));
    });
    ffmpeg.on("log", ({ message }) => {
      if (message.includes("time=")) setStatusCopy(message.trim());
    });

    const basePath = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const corePath = `${basePath}ffmpeg/ffmpeg-core.js`;
    const wasmPath = `${basePath}ffmpeg/ffmpeg-core.wasm`;
    const coreURL = import.meta.env.DEV
      ? await toBlobURL(corePath, "text/javascript")
      : corePath;
    const wasmURL = import.meta.env.DEV
      ? await toBlobURL(wasmPath, "application/wasm")
      : wasmPath;

    if (import.meta.env.DEV) coreBlobUrlsRef.current = [coreURL, wasmURL];

    await ffmpeg.load({ coreURL, wasmURL });
    engineModeRef.current = "single";
    setEngineMode("single");
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const safeDelete = async (ffmpeg: FFmpeg, path: string) => {
    try {
      await ffmpeg.deleteFile(path);
    } catch {
      // Optional FFmpeg pass files may not exist for every input.
    }
  };

  const compress = async () => {
    if (!video || !bitratePlan || isProcessing) return;

    isCancellingRef.current = false;
    setError("");
    resetResult();
    setPhase("loading");
    setProgress(2);
    setStatusCopy("Starting the in-browser engine for this session");

    let ffmpeg: FFmpeg | null = null;
    const inputName = `input.${inputExtension(video.file.name)}`;
    const outputName = "compressed.mp4";

    const completeOutput = (buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: OUTPUT_DETAILS.mimeType });
      const fileName = `${safeFileStem(video.file.name)}-compressed${OUTPUT_DETAILS.extension}`;
      setResult({ blob, fileName, size: blob.size });
      setProgress(100);
      setStatusCopy("Compression complete");
      setPhase("complete");
    };

    const browserAudioBitrate = Math.max(96, bitratePlan.audio);
    const browserVideoBitrate = Math.max(
      MIN_VIDEO_BITRATE_KBPS,
      bitratePlan.total - browserAudioBitrate,
    );
    const preferredVideoCodec: "vp9" | "avc" =
      compressionProfile === "quality" ? "vp9" : "avc";

    try {
      let canUseNativeEncoder = false;
      let browserAudioCodec: "aac" | "opus" | null = null;
      const browserAcceleration = "no-preference" as const;

      if (typeof VideoEncoder !== "undefined") {
        try {
          canUseNativeEncoder = await canEncodeVideo(preferredVideoCodec, {
            width: video.width,
            height: video.height,
            bitrate: browserVideoBitrate * 1000,
            hardwareAcceleration: browserAcceleration,
          });

          if (typeof AudioEncoder !== "undefined") {
            if (
              compressionProfile === "compatible" &&
              await canEncodeAudio("aac", {
                bitrate: browserAudioBitrate * 1000,
              })
            ) {
              browserAudioCodec = "aac";
            } else if (await canEncodeAudio("opus", {
              bitrate: browserAudioBitrate * 1000,
            })) {
              browserAudioCodec = "opus";
            }
          }
        } catch {
          canUseNativeEncoder = false;
          browserAudioCodec = null;
        }
      }

      if (canUseNativeEncoder && browserAudioCodec) {
        try {
          const targetBytes = targetSize * 1_000_000;
          let requestedVideoBitrate = browserVideoBitrate * 1000;
          let largestUnderTarget: ArrayBuffer | null = null;
          let smallestOverTarget: ArrayBuffer | null = null;
          let largestUnderTargetBitrate: number | null = null;
          let smallestOverTargetBitrate: number | null = null;

          engineModeRef.current = "native";
          setEngineMode("native");
          setPhase("pass-two");

          const encodeNativeAttempt = async (
            videoBitrate: number,
            attempt: number,
          ): Promise<ArrayBuffer> => {
            const target = new BufferTarget();
            const input = new Input({
              source: new BlobSource(video.file),
              formats: [MP4, QTFF, MATROSKA, WEBM],
            });
            const output = new Output({
              format: new Mp4OutputFormat({ fastStart: "in-memory" }),
              target,
            });
            const conversion = await Conversion.init({
              input,
              output,
              tracks: "primary",
              video: {
                codec: preferredVideoCodec,
                bitrate: videoBitrate,
                hardwareAcceleration: browserAcceleration,
                keyFrameInterval: compressionProfile === "quality" ? 4 : undefined,
                forceTranscode: true,
              },
              audio: {
                codec: browserAudioCodec,
                bitrate: browserAudioBitrate * 1000,
                forceTranscode: true,
              },
              tags: {},
              showWarnings: false,
            });

            if (!conversion.isValid) {
              throw new Error("The browser-native encoder does not support this profile.");
            }

            conversionRef.current = conversion;
            setStatusCopy(
              attempt === 0
                ? compressionProfile === "quality"
                  ? "Encoding quality-focused VP9 video"
                  : "Encoding compatible H.264 video"
                : "Refining bitrate to use the available target size",
            );
            conversion.onProgress = (currentProgress) => {
              const start = attempt === 0 ? 8 : 54;
              const span = attempt === 0 ? 44 : 43;
              setProgress(Math.round(start + currentProgress * span));
            };

            try {
              await conversion.execute();
            } finally {
              conversionRef.current = null;
            }

            if (!target.buffer) {
              throw new Error("The browser-native encoder returned no video data.");
            }

            return target.buffer;
          };

          for (let attempt = 0; attempt < MAX_NATIVE_ATTEMPTS; attempt += 1) {
            let nativeBuffer: ArrayBuffer;
            try {
              nativeBuffer = await encodeNativeAttempt(
                requestedVideoBitrate,
                attempt,
              );
            } catch (nativeAttemptError) {
              if (attempt === 0 || isCancellingRef.current) {
                throw nativeAttemptError;
              }
              console.warn(
                "Browser-native bitrate refinement unavailable; keeping the first encode",
                nativeAttemptError,
              );
              break;
            }

            if (nativeBuffer.byteLength <= targetBytes) {
              if (
                !largestUnderTarget ||
                nativeBuffer.byteLength > largestUnderTarget.byteLength
              ) {
                largestUnderTarget = nativeBuffer;
                largestUnderTargetBitrate = requestedVideoBitrate;
              }
            } else if (
              !smallestOverTarget ||
              nativeBuffer.byteLength < smallestOverTarget.byteLength
            ) {
              smallestOverTarget = nativeBuffer;
              smallestOverTargetBitrate = requestedVideoBitrate;
            }

            const targetRatio = nativeBuffer.byteLength / targetBytes;
            const isAccurateTarget =
              targetRatio >= NATIVE_TARGET_FLOOR && targetRatio <= 1;
            if (isAccurateTarget || attempt === MAX_NATIVE_ATTEMPTS - 1) {
              break;
            }

            if (
              largestUnderTargetBitrate !== null &&
              smallestOverTargetBitrate !== null
            ) {
              requestedVideoBitrate = Math.round(
                (largestUnderTargetBitrate + smallestOverTargetBitrate) / 2,
              );
              continue;
            }

            const audioBitrate = browserAudioBitrate * 1000;
            const actualTotalBitrate =
              (nativeBuffer.byteLength * 8) / video.duration;
            const desiredTotalBitrate =
              (targetBytes * NATIVE_CORRECTION_TARGET * 8) / video.duration;
            const actualVideoBitrate = Math.max(
              MIN_VIDEO_BITRATE_KBPS * 1000,
              actualTotalBitrate - audioBitrate,
            );
            const desiredVideoBitrate = Math.max(
              MIN_VIDEO_BITRATE_KBPS * 1000,
              desiredTotalBitrate - audioBitrate,
            );
            const correctedVideoBitrate =
              requestedVideoBitrate *
              (desiredVideoBitrate / actualVideoBitrate);
            requestedVideoBitrate = Math.round(
              Math.min(
                requestedVideoBitrate * 2.5,
                Math.max(requestedVideoBitrate * 0.4, correctedVideoBitrate),
              ),
            );
          }

          const selectedNativeBuffer =
            largestUnderTarget ?? smallestOverTarget;
          if (!selectedNativeBuffer) {
            throw new Error("The browser-native encoder returned no usable video data.");
          }

          setPhase("finalizing");
          setProgress(98);
          setStatusCopy("Preparing your download");
          completeOutput(selectedNativeBuffer);
          return;
        } catch (nativeError) {
          conversionRef.current = null;
          if (isCancellingRef.current) {
            throw nativeError;
          }
          console.warn(
            "Browser-native encoding unavailable; using FFmpeg compatibility mode",
            nativeError,
          );
          setProgress(2);
          setStatusCopy("Native encoding unavailable. Loading two-pass MP4 mode.");
        }
      }

      ffmpeg = await ensureFFmpeg();
      setProgress(7);
      setPhase("analyzing");
      setStatusCopy("Copying the video into private browser memory");
      await ffmpeg.writeFile(inputName, await fetchFile(video.file));

      setPhase("pass-two");
      setProgress(10);
      setStatusCopy("Analyzing video for efficient two-pass encoding");
      ffmpegPassRef.current = 1;
      const firstPassCode = await ffmpeg.exec([
        "-i",
        inputName,
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-b:v",
        `${bitratePlan.video}k`,
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-pass",
        "1",
        "-passlogfile",
        "compression-pass",
        "-f",
        "null",
        "-",
      ]);
      if (firstPassCode !== 0) {
        throw new Error("The video analysis pass could not be completed.");
      }

      ffmpegPassRef.current = 2;
      setProgress(52);
      setStatusCopy("Encoding the final compatibility MP4");
      const encodeCode = await ffmpeg.exec([
        "-i",
        inputName,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-b:v",
        `${bitratePlan.video}k`,
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-pass",
        "2",
        "-passlogfile",
        "compression-pass",
        "-c:a",
        "aac",
        "-b:a",
        `${bitratePlan.audio}k`,
        "-movflags",
        "+faststart",
        "-map_metadata",
        "-1",
        outputName,
      ]);
      if (encodeCode !== 0) throw new Error("The video encoding could not be completed.");

      setPhase("finalizing");
      setProgress(98);
      setStatusCopy("Preparing your download");
      const outputData = await ffmpeg.readFile(outputName);
      if (typeof outputData === "string") throw new Error("The encoded video was not returned correctly.");
      const bytes = Uint8Array.from(outputData);
      completeOutput(bytes.buffer);
    } catch (compressionError) {
      if (isCancellingRef.current) {
        setPhase("ready");
        setProgress(0);
        setStatusCopy("Compression cancelled");
      } else {
        console.error("Video compression failed", compressionError);
        setError(
          compressionError instanceof Error
            ? compressionError.message
            : "Compression failed. Try a smaller file or a different browser.",
        );
        setPhase("error");
        setStatusCopy("");
      }
    } finally {
      if (ffmpeg?.loaded) {
        await Promise.all([
          safeDelete(ffmpeg, inputName),
          safeDelete(ffmpeg, outputName),
          safeDelete(ffmpeg, "compression-pass-0.log"),
          safeDelete(ffmpeg, "compression-pass-0.log.mbtree"),
        ]);
      }
    }
  };

  const cancelCompression = () => {
    if (!isProcessing) return;
    isCancellingRef.current = true;
    void conversionRef.current?.cancel();
    conversionRef.current = null;
    ffmpegRef.current?.terminate();
    ffmpegRef.current = null;
    coreBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    coreBlobUrlsRef.current = [];
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="../../index.html" aria-label="Back to Web-Tools">
          <span className="brand-mark" aria-hidden="true"><SlidersHorizontal weight="bold" /></span>
          Web-Tools
        </a>
        <a className="back-link" href="../../index.html"><ArrowLeft /> All tools</a>
        <span className="utility-note"><ShieldCheck weight="fill" /> Files stay on this device</span>
      </header>

      <div className="workspace">
        <section className="intro-panel" aria-labelledby="page-title">
          <p className="eyebrow">Video compressor</p>
          <div className="hero-copy">
            <h1 id="page-title">Make the file fit.</h1>
            <p>Choose a target size and encoding priority. Resolution stays intact while the encoder spends the available bitrate on detail.</p>
          </div>
          <p className="privacy-line"><ShieldCheck /> No upload, account, or server processing.</p>
        </section>

        <section className="tool-panel" aria-label="Video compression tool">
          {!video ? (
            <div
              className={`drop-zone ${isDragging ? "drop-zone--active" : ""} ${isProcessing ? "drop-zone--disabled" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                className="file-input"
                type="file"
                accept="video/*,.mkv"
                onChange={(event) => void selectFile(event.target.files?.[0])}
                disabled={isProcessing}
                aria-label="Choose a video"
              />
              <span className="drop-icon" aria-hidden="true"><UploadSimple /></span>
              <div className="upload-copy">
                <h2>Drop a video here</h2>
                <p>MP4, MOV, WebM, or MKV up to 2 GB</p>
              </div>
              <span className="browse-button">Choose video</span>
            </div>
          ) : (
            <div className="file-stage">
              <article className="preview-card">
                <div className="video-frame">
                  <video src={video.previewUrl} controls preload="metadata" aria-label={`Preview of ${video.file.name}`} />
                </div>
                <div className="media-details">
                  <div>
                    <p className="file-title" title={video.file.name}><FileVideo weight="fill" /> {video.file.name}</p>
                    <p className="file-meta">{formatBytes(video.file.size)} · {formatDuration(video.duration)} · {video.width} × {video.height}</p>
                  </div>
                  <button className="remove-button" type="button" onClick={removeVideo} disabled={isProcessing} aria-label="Remove video"><X /></button>
                </div>
              </article>

              <div className="controls-panel">
                <div className="control-heading">
                  <div>
                    <p>Target output</p>
                    <h2 className="size-readout">{targetSize.toFixed(1)} MB</h2>
                  </div>
                  <SlidersHorizontal aria-hidden="true" />
                </div>

                <div className="slider-wrap">
                  <input
                    className="target-slider"
                    type="range"
                    min={bounds.min}
                    max={bounds.max}
                    step="0.1"
                    value={targetSize}
                    onChange={(event) => { setTargetSize(Number(event.target.value)); resetResult(); setPhase("ready"); }}
                    disabled={isProcessing}
                    aria-label="Target file size in megabytes"
                    aria-valuetext={`${targetSize.toFixed(1)} megabytes`}
                  />
                  <div className="range-labels"><span>{bounds.min.toFixed(1)} MB</span><span>{bounds.max.toFixed(1)} MB</span></div>
                </div>

                <fieldset className="profile-fieldset" disabled={isProcessing}>
                  <legend>Encoding priority</legend>
                  <div className="profile-options">
                    <button
                      className={`profile-option ${compressionProfile === "quality" ? "profile-option--active" : ""}`}
                      type="button"
                      aria-pressed={compressionProfile === "quality"}
                      onClick={() => {
                        setCompressionProfile("quality");
                        resetResult();
                        setPhase("ready");
                      }}
                    >
                      <strong>Best quality</strong>
                      <span>VP9 · MP4</span>
                    </button>
                    <button
                      className={`profile-option ${compressionProfile === "compatible" ? "profile-option--active" : ""}`}
                      type="button"
                      aria-pressed={compressionProfile === "compatible"}
                      onClick={() => {
                        setCompressionProfile("compatible");
                        resetResult();
                        setPhase("ready");
                      }}
                    >
                      <strong>Compatible</strong>
                      <span>H.264 · MP4</span>
                    </button>
                  </div>
                </fieldset>

                {bitratePlan && (
                  <div className="estimate-grid">
                    <div className="estimate-item"><Gauge /><div><span className="estimate-label">Target / source bitrate</span><strong className="estimate-value">{bitratePlan.total.toLocaleString()} / {bitratePlan.source.toLocaleString()} kbps</strong></div></div>
                    <div className="estimate-item"><HardDrives /><div><span className="estimate-label">Estimated saving</span><strong className="estimate-value">{Math.max(0, Math.round((1 - targetSize * 1_000_000 / video.file.size) * 100))}%</strong></div></div>
                  </div>
                )}

                <p className="notice">
                  {compressionProfile === "quality"
                    ? "VP9 VBR measures the output and retries locally when needed to spend more of the target on visual detail. A smaller file cannot retain the source bitrate or identical quality, and some older players may not support VP9 in MP4."
                    : "H.264 prioritizes playback compatibility. A smaller target necessarily lowers bitrate and visual quality; the local fallback uses two-pass encoding for better bit allocation."}
                </p>

                <div className="action-row">
                  <button className="primary-button" type="button" onClick={() => void compress()} disabled={isProcessing || bounds.min === bounds.max}>
                    <SlidersHorizontal /> Compress video
                  </button>
                  {isProcessing && <button className="secondary-button" type="button" onClick={cancelCompression}><X /> Cancel</button>}
                </div>
              </div>
            </div>
          )}

          {error && <div className="validation-error" role="alert"><WarningCircle weight="fill" /><span>{error}</span></div>}

          {isProcessing && (
            <section className="progress-panel" aria-live="polite" aria-label="Compression progress">
              <div className="progress-heading"><span>{phaseLabel(phase)}</span><strong>{progress}%</strong></div>
              <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span className="progress-fill" style={{ transform: `scaleX(${progress / 100})` }} /></div>
              <p className="progress-meta">{engineMode === "native" ? "Quality VBR encoding and target-size refinement are active." : engineMode === "single" ? "Two-pass compatibility encoding is active." : "Selecting the best supported encoder."} Keep this tab open.</p>
            </section>
          )}

          {phase === "complete" && result && (
            <section className="result-panel" aria-live="polite">
              <div className="result-summary"><CheckCircle weight="fill" /><div><h2>{OUTPUT_DETAILS.label} ready</h2><p>{formatBytes(result.size)} output from {formatBytes(video?.file.size ?? 0)} source · {Math.round(result.size / (targetSize * 1_000_000) * 100)}% of target</p></div></div>
              <div className="result-actions">
                <button className="primary-button" type="button" onClick={() => void saveResult()} disabled={isSaving}><DownloadSimple /> {isSaving ? "Saving…" : `Save ${OUTPUT_DETAILS.label}`}</button>
                <button className="secondary-button" type="button" onClick={() => { resetResult(); setPhase("ready"); }}>Adjust target</button>
              </div>
            </section>
          )}

          {statusCopy && !isProcessing && phase !== "complete" && <p className="status-copy" aria-live="polite">{statusCopy}</p>}
        </section>
      </div>

      <footer className="footer-note">
        <span>Quality-first VP9 MP4</span>
        <span>Compatible H.264 MP4</span>
        <span>Measured target-size refinement</span>
      </footer>
    </main>
  );
}
