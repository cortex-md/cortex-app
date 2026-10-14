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

    Function("aes256GcmSeal") { (key: Data, nonce: Data, plaintext: Data) -> Data in
      try CortexCrypto.aesGcmSeal(key: key, nonce: nonce, plaintext: plaintext)
    }

    Function("aes256GcmOpen") { (key: Data, nonce: Data, ciphertext: Data, tag: Data) -> Data in
      try CortexCrypto.aesGcmOpen(key: key, nonce: nonce, ciphertext: ciphertext, tag: tag)
    }

    Function("hkdfSha256") { (ikm: Data, salt: Data, info: String, length: Int) -> Data in
      CortexCrypto.hkdfSha256(ikm: ikm, salt: salt, info: info, length: length)
    }

    Function("x25519PublicKey") { (privateKey: Data) -> Data in
      try CortexCrypto.x25519PublicKey(privateKey: privateKey)
    }

    Function("x25519SharedSecret") { (privateKey: Data, publicKey: Data) -> Data in
      try CortexCrypto.x25519SharedSecret(privateKey: privateKey, publicKey: publicKey)
    }

    Function("sha256") { (data: Data) -> Data in
      CortexCrypto.sha256(data: data)
    }

    AsyncFunction("argon2id") {
      (password: String, salt: Data, memoryCost: Int, timeCost: Int, parallelism: Int, hashLength: Int) -> Data in
      try CortexCrypto.argon2id(
        password: password,
        salt: salt,
        memoryCost: memoryCost,
        timeCost: timeCost,
        parallelism: parallelism,
        hashLength: hashLength
      )
    }

    OnDestroy {
      for url in self.accessedUrls.values {
        url.stopAccessingSecurityScopedResource()
      }
      self.accessedUrls.removeAll()
    }
  }
}
