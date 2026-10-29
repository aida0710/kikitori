using System.IO;
using NAudio.Wave;

namespace Kikitori.Windows.Audio;

/// <summary>16kHz・モノラル・16bit の PCM を 100ms ずつ出すもの。</summary>
internal interface IAudioSource : IDisposable
{
    /// <summary>PCM と、その区間の音の大きさ（0〜1。画面のマイクの印に使う）。</summary>
    event Action<byte[], float>? FrameCaptured;

    void Start();
    void Stop();
}

internal static class AudioFormat
{
    public const int SampleRate = 16000;
    public const int FrameMilliseconds = 100;
    public const int FrameBytes = SampleRate * 2 * FrameMilliseconds / 1000;

    public static float Level(byte[] pcm, int length)
    {
        double sumOfSquares = 0;
        var samples = length / 2;
        for (var offset = 0; offset + 1 < length; offset += 2)
        {
            double sample = BitConverter.ToInt16(pcm, offset) / 32768.0;
            sumOfSquares += sample * sample;
        }
        var rms = samples == 0 ? 0 : Math.Sqrt(sumOfSquares / samples);
        // 話し声の RMS はおよそ 0.02〜0.2。画面の印が動いて見えるように広げる
        return (float)Math.Clamp(rms * 6, 0, 1);
    }
}

/// <summary>既定のマイク。Windows の音声の仕組みに 16kHz・モノラルへ変換させる（waveIn）。</summary>
internal sealed class MicrophoneSource : IAudioSource
{
    private readonly WaveInEvent waveIn;

    public event Action<byte[], float>? FrameCaptured;

    public MicrophoneSource()
    {
        waveIn = new WaveInEvent
        {
            WaveFormat = new WaveFormat(AudioFormat.SampleRate, 16, 1),
            BufferMilliseconds = AudioFormat.FrameMilliseconds,
        };
        waveIn.DataAvailable += (_, e) =>
        {
            var frame = new byte[e.BytesRecorded];
            Buffer.BlockCopy(e.Buffer, 0, frame, 0, e.BytesRecorded);
            FrameCaptured?.Invoke(frame, AudioFormat.Level(frame, frame.Length));
        };
    }

    public void Start() => waveIn.StartRecording();

    public void Stop() => waveIn.StopRecording();

    public void Dispose() => waveIn.Dispose();
}

/// <summary>試験用。16kHz・モノラル・16bit の WAV を、話す速さで流す。</summary>
internal sealed class WavFileSource : IAudioSource
{
    private readonly string path;
    private CancellationTokenSource? cancellation;

    public event Action<byte[], float>? FrameCaptured;

    public WavFileSource(string path)
    {
        this.path = path;
    }

    public void Start()
    {
        cancellation = new CancellationTokenSource();
        var token = cancellation.Token;
        _ = Task.Run(async () =>
        {
            using var reader = new WaveFileReader(path);
            if (reader.WaveFormat.SampleRate != AudioFormat.SampleRate || reader.WaveFormat.Channels != 1
                || reader.WaveFormat.BitsPerSample != 16)
            {
                throw new InvalidDataException("The test WAV must be 16 kHz, mono, 16-bit");
            }
            var started = DateTime.UtcNow;
            var buffer = new byte[AudioFormat.FrameBytes];
            long sent = 0;
            int read;
            while (!token.IsCancellationRequested && (read = reader.Read(buffer, 0, buffer.Length)) > 0)
            {
                var frame = buffer[..read];
                FrameCaptured?.Invoke(frame, AudioFormat.Level(frame, read));
                sent += read;
                var due = started + TimeSpan.FromSeconds(sent / (AudioFormat.SampleRate * 2.0));
                var wait = due - DateTime.UtcNow;
                if (wait > TimeSpan.Zero)
                {
                    await Task.Delay(wait, token).ContinueWith(_ => { });
                }
            }
        }, token);
    }

    public void Stop() => cancellation?.Cancel();

    public void Dispose() => cancellation?.Dispose();
}
