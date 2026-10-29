# Qwen3-ASR の公式イメージ（vLLM 0.14.0・CUDA 12.8）に、kikitori の常駐プロセスを足す
FROM qwenllm/qwen3-asr:latest@sha256:fb75b775f089e06e5a1aaebffd421e37505cc630d50c86d889d95ffa45a7e16a

# イメージの qwen-asr 0.0.4 を、コードを読んで使い方を確かめた 0.0.6 に揃える。依存はイメージのものを使う
# Silero VAD の基本の依存は torch と packaging だけで、どちらもイメージにある
RUN pip3 install --no-cache-dir --no-deps "qwen-asr==0.0.6" \
    && pip3 install --no-cache-dir "silero-vad==6.2.3"

WORKDIR /app
COPY kikitori_asr ./kikitori_asr
COPY tools ./tools

ENV HF_HOME=/models/hf
EXPOSE 8781
ENTRYPOINT ["uvicorn", "kikitori_asr.server:app", "--host", "0.0.0.0", "--port", "8781", "--ws-max-size", "1048576"]
