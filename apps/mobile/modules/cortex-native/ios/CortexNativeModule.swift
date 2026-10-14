import ExpoModulesCore
import PDFKit

public class CortexNativeModule: Module {
  private var accessedUrls: [String: URL] = [:]

  public func definition() -> ModuleDefinition {
    Name("CortexNative")

    Function("createBookmark") { (uri: String) -> String? in
      guard let url = URL(string: uri) else { return nil }
      let started = url.startAccessingSecurityScopedResource()
      defer {
        if started { url.stopAccessingSecurityScopedResource() }
      }
      let data = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
      return data.base64EncodedString()
    }

    Function("resolveBookmark") { (bookmark: String) -> [String: Any]? in
      guard let data = Data(base64Encoded: bookmark) else { return nil }
      var stale = false
      let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
      let key = url.absoluteString
      if self.accessedUrls[key] == nil, url.startAccessingSecurityScopedResource() {
        self.accessedUrls[key] = url
      }
      return ["uri": key, "stale": stale]
    }

    Function("takePersistablePermission") { (_: String) -> Bool in
      return true
    }

    AsyncFunction("extractPdfText") { (uri: String) -> [String] in
      guard let url = URL(string: uri) else {
        throw Exception(name: "InvalidUri", description: "The PDF path is not a valid URL.")
      }
      let started = url.startAccessingSecurityScopedResource()
      defer {
        if started { url.stopAccessingSecurityScopedResource() }
      }
      guard let document = PDFDocument(url: url) else {
        throw Exception(name: "UnreadablePdf", description: "The PDF could not be opened.")
      }
      return (0..<document.pageCount).map { document.page(at: $0)?.string ?? "" }
    }

    OnDestroy {
      for url in self.accessedUrls.values {
        url.stopAccessingSecurityScopedResource()
      }
      self.accessedUrls.removeAll()
    }
  }
}
