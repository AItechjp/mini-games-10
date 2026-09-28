# 無音カメラ (SilentCamera)

シャッター音が鳴らない Android カメラアプリ。

- 静止画キャプチャを使わず、映像ストリームから1フレームを保存する方式なので、シャッター音を強制する端末でも無音
- シャッターボタン / 音量キーで撮影、タップでピント、前後カメラ切替
- 保存先: `ピクチャ/SilentCamera`
- Android 8.0 以上

## ビルド
- GitHub に push すると Actions が APK をビルドし、Releases に `SilentCamera.apk` を添付
- もしくは Android Studio でこのフォルダを開いて ▶ 実行
