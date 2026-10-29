# Android の組み立てに使う SDK。cirruslabs の SDK 36 のイメージに、依存が求める SDK 37 を足す
FROM ghcr.io/cirruslabs/android-sdk:36
RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager "platforms;android-37.0" "build-tools;37.0.0" >/dev/null
