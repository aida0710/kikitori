using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace Kikitori.Windows.Dictation;

/// <summary>サーバーから届く知らせ。形は docs/dictation-protocol.md。</summary>
internal abstract record DictationEvent;
internal sealed record ReadyEvent(long DictationId) : DictationEvent;
internal sealed record PartialEvent(int Segment, string Text) : DictationEvent;
internal sealed record SegmentEvent(int Segment, string Raw, string Text, bool Corrected) : DictationEvent;
internal sealed record EndEvent(string Text, bool Cancelled) : DictationEvent;
internal sealed record ErrorEvent(string Code, string Message) : DictationEvent;

/// <summary>1 回の音声入力の WebSocket（/v1/dictation）。送るのは 1 本の列に並べて順に送る。</summary>
internal sealed class DictationConnection : IAsyncDisposable
{
    private readonly ClientWebSocket socket = new();
    private readonly Channel<(WebSocketMessageType Type, byte[] Payload)> outgoing =
        Channel.CreateUnbounded<(WebSocketMessageType, byte[])>(new UnboundedChannelOptions { SingleReader = true });
    private readonly CancellationTokenSource lifetime = new();
    private Task? sender;

    public event Action<DictationEvent>? EventReceived;
    public event Action<Exception>? ConnectionFailed;

    public async Task ConnectAsync(Uri uri, string accessKey, string client, bool correction)
    {
        socket.Options.SetRequestHeader("Authorization", $"Bearer {accessKey}");
        socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        // 接続の前に start を並べておけば、接続できしだい最初に送られる
        EnqueueText(JsonSerializer.Serialize(new { type = "start", client, correction }));
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        await socket.ConnectAsync(uri, timeout.Token);
        sender = Task.Run(SendLoopAsync);
        _ = Task.Run(ReceiveLoopAsync);
    }

    public void SendAudio(byte[] pcm16) => outgoing.Writer.TryWrite((WebSocketMessageType.Binary, pcm16));

    public void SendStop() => EnqueueText("""{"type":"stop"}""");

    public void SendCancel() => EnqueueText("""{"type":"cancel"}""");

    private void EnqueueText(string json) =>
        outgoing.Writer.TryWrite((WebSocketMessageType.Text, Encoding.UTF8.GetBytes(json)));

    private async Task SendLoopAsync()
    {
        try
        {
            await foreach (var (type, payload) in outgoing.Reader.ReadAllAsync(lifetime.Token))
            {
                if (socket.State != WebSocketState.Open)
                {
                    break;
                }
                await socket.SendAsync(payload, type, endOfMessage: true, lifetime.Token);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception error)
        {
            ConnectionFailed?.Invoke(error);
        }
    }

    private async Task ReceiveLoopAsync()
    {
        var buffer = new byte[64 * 1024];
        try
        {
            while (socket.State == WebSocketState.Open)
            {
                using var message = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(buffer, lifetime.Token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return;
                    }
                    message.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);
                var parsed = Parse(Encoding.UTF8.GetString(message.ToArray()));
                if (parsed is not null)
                {
                    EventReceived?.Invoke(parsed);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception error)
        {
            ConnectionFailed?.Invoke(error);
        }
    }

    private static DictationEvent? Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        string Text(string name) => root.TryGetProperty(name, out var value) ? value.GetString() ?? "" : "";
        return Text("type") switch
        {
            "ready" => new ReadyEvent(root.GetProperty("dictationId").GetInt64()),
            "partial" => new PartialEvent(root.GetProperty("segment").GetInt32(), Text("text")),
            "segment" => new SegmentEvent(
                root.GetProperty("segment").GetInt32(), Text("raw"), Text("text"), root.GetProperty("corrected").GetBoolean()),
            "end" => new EndEvent(Text("text"), root.GetProperty("cancelled").GetBoolean()),
            "error" => new ErrorEvent(Text("code"), Text("message")),
            _ => null,
        };
    }

    public async ValueTask DisposeAsync()
    {
        outgoing.Writer.TryComplete();
        if (sender is not null)
        {
            await Task.WhenAny(sender, Task.Delay(TimeSpan.FromSeconds(1)));
        }
        lifetime.Cancel();
        socket.Dispose();
        lifetime.Dispose();
    }
}
