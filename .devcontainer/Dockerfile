FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update && apt-get install -y \
  curl unzip zip git ca-certificates \
  build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

# Android SDK env
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/emulator"

RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools
