package com.notex.inkrecognition

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InkRecognitionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InkRecognition")
    AsyncFunction("hello") { "merhaba" }
  }
}
