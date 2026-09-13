# AITECH トランプ / Unity

Unity 6000.3.24f1向けのWebゲームです。Assets/CardRules.csにババ抜き・神経衰弱・スピードのルール、Assets/TrumpTable.csに画面・CPU操作があります。

## ビルド

このプロジェクトを開いているUnity Editorを閉じてから実行します。

```powershell
& 'C:/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe' -batchmode -nographics -quit -projectPath $PWD -buildTarget WebGL -executeMethod TrumpBuild.Build -logFile build.log
```

ビルド前に各モード150シードの完走テストと境界条件を実行します。成功時はverification.jsonとBuilds/Webを出力します。Webサーバーで配信し、URLに`?game=babanuki`、`?game=memory`、`?game=speed`を付けて起動します。

ババ抜きは4人卓（CPU3人）、神経衰弱は24枚のCPU対戦、スピードはCPUとの同時進行です。神経衰弱のCPUは公開された札を記憶します。スピードはKとAを隣接扱いとし、両者とも出せない場合は自動で場札を入れ替え、同時に札が尽きた場合は引き分けとします。

フォントはNoto Sans JP（SIL Open Font License）。Assets/Resources/OFL.txtを参照してください。
