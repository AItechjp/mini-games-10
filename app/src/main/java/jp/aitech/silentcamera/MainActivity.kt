package jp.aitech.silentcamera

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Size
import android.view.KeyEvent
import android.view.MotionEvent
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 無音カメラ
 *
 * 通常の「静止画キャプチャ」は端末によってはシステム側でシャッター音が強制される。
 * このアプリは静止画キャプチャを一切使わず、カメラの映像ストリーム(ImageAnalysis)から
 * 1フレームを取り出して JPEG 保存するため、どの端末でも音が鳴らない。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var thumb: ImageView
    private lateinit var info: TextView
    private lateinit var flash: android.view.View

    private lateinit var analysisExecutor: ExecutorService
    private val saveExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private var camera: Camera? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private val captureRequested = AtomicBoolean(false)
    private var lastUri: Uri? = null

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result[Manifest.permission.CAMERA] == true) startCamera()
            else {
                Toast.makeText(this, "カメラの許可が必要です", Toast.LENGTH_LONG).show()
                finish()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        previewView = findViewById(R.id.preview)
        thumb = findViewById(R.id.thumb)
        info = findViewById(R.id.info)
        flash = findViewById(R.id.flash)
        analysisExecutor = Executors.newSingleThreadExecutor()

        findViewById<ImageButton>(R.id.shutter).setOnClickListener { requestCapture() }
        findViewById<ImageButton>(R.id.switchCam).setOnClickListener {
            lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK)
                CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
            startCamera()
        }
        thumb.setOnClickListener { openLastPhoto() }

        // タップでピント合わせ
        previewView.setOnTouchListener { v, ev ->
            if (ev.action == MotionEvent.ACTION_UP) {
                val point = previewView.meteringPointFactory.createPoint(ev.x, ev.y)
                camera?.cameraControl?.startFocusAndMetering(
                    FocusMeteringAction.Builder(point).build()
                )
                v.performClick()
            }
            true
        }

        val needed = mutableListOf(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            needed += Manifest.permission.WRITE_EXTERNAL_STORAGE
        }
        if (needed.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) {
            startCamera()
        } else {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    // 音量キーでも撮影できる
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            if (event?.repeatCount == 0) requestCapture()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            // 解析ストリームはできるだけ高解像度に（端末の対応範囲内で自動選択）
            val selector = ResolutionSelector.Builder()
                .setResolutionStrategy(
                    ResolutionStrategy(
                        Size(4000, 3000),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
                    )
                )
                .build()

            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(selector)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build()

            analysis.setAnalyzer(analysisExecutor) { image -> onFrame(image) }

            val cameraSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
            try {
                provider.unbindAll()
                camera = provider.bindToLifecycle(this, cameraSelector, preview, analysis)
                val res = analysis.resolutionInfo?.resolution
                info.text = if (res != null) "🔇 無音モード  ${res.width}×${res.height}" else "🔇 無音モード"
            } catch (e: Exception) {
                Toast.makeText(this, "カメラを開けません: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun requestCapture() {
        captureRequested.set(true)
        // 音の代わりに画面を一瞬白くする
        flash.animate().cancel()
        flash.alpha = 0.7f
        flash.animate().alpha(0f).setDuration(180).start()
    }

    private fun onFrame(image: ImageProxy) {
        if (!captureRequested.getAndSet(false)) {
            image.close()
            return
        }
        val rotation = image.imageInfo.rotationDegrees
        val raw: Bitmap = try {
            image.toBitmap()
        } finally {
            image.close()
        }
        val front = lensFacing == CameraSelector.LENS_FACING_FRONT
        saveExecutor.execute {
            val matrix = Matrix().apply {
                postRotate(rotation.toFloat())
                if (front) postScale(-1f, 1f) // 自撮りは見たまま（鏡像）で保存
            }
            val bmp = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
            val uri = saveJpeg(bmp)
            runOnUiThread {
                if (uri != null) {
                    lastUri = uri
                    thumb.setImageBitmap(Bitmap.createScaledBitmap(bmp, 160, 160 * bmp.height / bmp.width, true))
                } else {
                    Toast.makeText(this, "保存に失敗しました", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun saveJpeg(bmp: Bitmap): Uri? {
        val name = "SILENT_" + SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.JAPAN).format(Date()) + ".jpg"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SilentCamera")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            } else {
                @Suppress("DEPRECATION")
                val dir = java.io.File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    "SilentCamera"
                ).apply { mkdirs() }
                @Suppress("DEPRECATION")
                put(MediaStore.Images.Media.DATA, java.io.File(dir, name).absolutePath)
            }
        }
        val resolver = contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null
        return try {
            resolver.openOutputStream(uri)?.use { out ->
                bmp.compress(Bitmap.CompressFormat.JPEG, 95, out)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }
            uri
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            null
        }
    }

    private fun openLastPhoto() {
        val uri = lastUri ?: return
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "image/jpeg")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try { startActivity(intent) } catch (_: Exception) { }
    }

    override fun onDestroy() {
        super.onDestroy()
        analysisExecutor.shutdown()
        saveExecutor.shutdown()
    }
}
