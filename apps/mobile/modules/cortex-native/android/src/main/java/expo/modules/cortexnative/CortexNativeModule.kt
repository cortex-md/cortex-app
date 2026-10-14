package expo.modules.cortexnative

import android.content.Intent
import android.net.Uri
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CortexNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CortexNative")

    Function("createBookmark") { _: String -> null as String? }

    Function("resolveBookmark") { _: String -> null as Map<String, Any>? }

    Function("takePersistablePermission") { uri: String ->
      val context = appContext.reactContext ?: return@Function false
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      try {
        context.contentResolver.takePersistableUriPermission(Uri.parse(uri), flags)
        true
      } catch (error: SecurityException) {
        false
      }
    }

    AsyncFunction("extractPdfText") { uri: String ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready to read PDFs.", null)
      PDFBoxResourceLoader.init(context)
      val stream = context.contentResolver.openInputStream(Uri.parse(uri))
        ?: throw CodedException("ERR_UNREADABLE_PDF", "The PDF could not be opened.", null)
      stream.use { input ->
        PDDocument.load(input).use { document ->
          val stripper = PDFTextStripper()
          (1..document.numberOfPages).map { page ->
            stripper.startPage = page
            stripper.endPage = page
            stripper.getText(document)
          }
        }
      }
    }
  }
}
