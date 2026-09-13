using System;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
public static class TrumpBuild {
 public static void Build() {
  TrumpTests.Run();
  var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var camera=new GameObject("Camera").AddComponent<Camera>();
  camera.clearFlags=CameraClearFlags.SolidColor; camera.backgroundColor=new Color(.025f,.09f,.10f);
  new GameObject("TrumpTable").AddComponent<TrumpTable>();
  Directory.CreateDirectory("Assets/Scenes"); EditorSceneManager.SaveScene(scene,"Assets/Scenes/Trump.unity");
  PlayerSettings.companyName="AITECH"; PlayerSettings.productName="Trump";
  PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Gzip;
  PlayerSettings.WebGL.decompressionFallback=true;
  PlayerSettings.WebGL.dataCaching=false; PlayerSettings.runInBackground=false;
  PlayerSettings.defaultWebScreenWidth=1100; PlayerSettings.defaultWebScreenHeight=760;
  var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Scenes/Trump.unity"},locationPathName="Builds/Web",target=BuildTarget.WebGL,options=BuildOptions.None});
  if(report.summary.result!=BuildResult.Succeeded) throw new Exception("Build failed");
  File.WriteAllText("verification.json","{\"tests\":true,\"webBuild\":true,\"bytes\":"+report.summary.totalSize+"}");
  Debug.Log("TRUMP_BUILD_OK");
 }
}
