package com.notex.inkrecognition

import com.google.mlkit.vision.digitalink.DigitalInkRecognition
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModel
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModelIdentifier
import com.google.mlkit.vision.digitalink.DigitalInkRecognizerOptions
import com.google.mlkit.vision.digitalink.Ink
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.common.model.DownloadConditions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class InkRecognitionModule : Module() {
  private val manager = RemoteModelManager.getInstance()

  private fun modelFor(lang: String): DigitalInkRecognitionModel {
    val identifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag(lang)
      ?: throw IllegalArgumentException("ML Kit bu dili desteklemiyor: $lang")
    return DigitalInkRecognitionModel.builder(identifier).build()
  }

  override fun definition() = ModuleDefinition {
    Name("InkRecognition")

    AsyncFunction("isModelDownloaded") { lang: String, promise: Promise ->
      try {
        manager.isModelDownloaded(modelFor(lang))
          .addOnSuccessListener { promise.resolve(it) }
          .addOnFailureListener { promise.reject("MODEL_CHECK_FAILED", it.message ?: "Model durumu okunamadı", it) }
      } catch (error: Exception) {
        promise.reject("INVALID_LANGUAGE", error.message ?: "Geçersiz dil", error)
      }
    }

    AsyncFunction("downloadModel") { lang: String, promise: Promise ->
      try {
        manager.download(modelFor(lang), DownloadConditions.Builder().build())
          .addOnSuccessListener { promise.resolve(null) }
          .addOnFailureListener { promise.reject("MODEL_DOWNLOAD_FAILED", it.message ?: "Model indirilemedi", it) }
      } catch (error: Exception) {
        promise.reject("INVALID_LANGUAGE", error.message ?: "Geçersiz dil", error)
      }
    }

    AsyncFunction("recognize") { strokes: List<Map<String, Any>>, lang: String, promise: Promise ->
      try {
        val model = modelFor(lang)
        manager.isModelDownloaded(model).addOnSuccessListener { downloaded ->
          if (!downloaded) {
            promise.reject("MODEL_NOT_DOWNLOADED", "$lang el yazısı modeli indirilmemiş. Önce downloadModel çağırın.", null)
            return@addOnSuccessListener
          }
          try {
            val inkBuilder = Ink.builder()
            for (stroke in strokes) {
              val rawPoints = stroke["points"] as? List<*> ?: continue
              val strokeBuilder = Ink.Stroke.builder()
              for (rawPoint in rawPoints) {
                val point = rawPoint as? Map<*, *> ?: continue
                val x = (point["x"] as? Number)?.toFloat() ?: continue
                val y = (point["y"] as? Number)?.toFloat() ?: continue
                val t = (point["t"] as? Number)?.toLong() ?: continue
                strokeBuilder.addPoint(Ink.Point.create(x, y, t))
              }
              if (rawPoints.isNotEmpty()) inkBuilder.addStroke(strokeBuilder.build())
            }
            val ink = inkBuilder.build()
            val recognizer = DigitalInkRecognition.getClient(
              DigitalInkRecognizerOptions.builder(model).build()
            )
            recognizer.recognize(ink)
              .addOnSuccessListener { result ->
                recognizer.close()
                val best = result.candidates.firstOrNull()?.text
                if (best.isNullOrBlank()) promise.reject("NO_RECOGNITION", "El yazısı tanınamadı.", null)
                else promise.resolve(best)
              }
              .addOnFailureListener { error ->
                recognizer.close()
                promise.reject("RECOGNITION_FAILED", error.message ?: "Tanıma başarısız", error)
              }
          } catch (error: Exception) {
            promise.reject("INVALID_STROKES", error.message ?: "Darbe verisi geçersiz", error)
          }
        }.addOnFailureListener { error ->
          promise.reject("MODEL_CHECK_FAILED", error.message ?: "Model kontrol edilemedi", error)
        }
      } catch (error: Exception) {
        promise.reject("INVALID_LANGUAGE", error.message ?: "Geçersiz dil", error)
      }
    }
  }
}
