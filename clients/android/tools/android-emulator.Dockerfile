# Android のエミュレーターで試すためのイメージ（KVM が要る: docker run --device /dev/kvm）
FROM kikitori-android-sdk:37
RUN sdkmanager "emulator" "system-images;android-36;google_apis;x86_64" >/dev/null \
    && echo no | avdmanager create avd -n kikitori -k "system-images;android-36;google_apis;x86_64" -d pixel_6 >/dev/null \
    && chmod -R a+rwX /root /opt/android-sdk-linux/emulator
ENV ANDROID_AVD_HOME=/root/.android/avd
