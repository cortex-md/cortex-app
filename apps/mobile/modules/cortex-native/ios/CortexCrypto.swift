import CryptoKit
import Foundation

enum CortexCryptoError: Error, CustomStringConvertible {
  case argon2(String)

  var description: String {
    switch self {
    case .argon2(let message):
      return "Argon2id failed: \(message)"
    }
  }
}

enum CortexCrypto {
  static func aesGcmSeal(key: Data, nonce: Data, plaintext: Data) throws -> Data {
    let box = try AES.GCM.seal(plaintext, using: SymmetricKey(data: key), nonce: AES.GCM.Nonce(data: nonce))
    return box.ciphertext + box.tag
  }

  static func aesGcmOpen(key: Data, nonce: Data, ciphertext: Data, tag: Data) throws -> Data {
    let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce), ciphertext: ciphertext, tag: tag)
    return try AES.GCM.open(box, using: SymmetricKey(data: key))
  }

  static func hkdfSha256(ikm: Data, salt: Data, info: String, length: Int) -> Data {
    let key = HKDF<SHA256>.deriveKey(
      inputKeyMaterial: SymmetricKey(data: ikm),
      salt: salt,
      info: Data(info.utf8),
      outputByteCount: length
    )
    return key.withUnsafeBytes { Data($0) }
  }

  static func x25519PublicKey(privateKey: Data) throws -> Data {
    try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey).publicKey.rawRepresentation
  }

  static func x25519SharedSecret(privateKey: Data, publicKey: Data) throws -> Data {
    let secret = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey)
      .sharedSecretFromKeyAgreement(with: Curve25519.KeyAgreement.PublicKey(rawRepresentation: publicKey))
    return secret.withUnsafeBytes { Data($0) }
  }

  static func sha256(data: Data) -> Data {
    Data(SHA256.hash(data: data))
  }

  static func argon2id(
    password: String,
    salt: Data,
    memoryCost: Int,
    timeCost: Int,
    parallelism: Int,
    hashLength: Int
  ) throws -> Data {
    let passwordBytes = Data(password.utf8)
    var hash = Data(count: hashLength)
    let code = hash.withUnsafeMutableBytes { hashBuffer in
      passwordBytes.withUnsafeBytes { passwordBuffer in
        salt.withUnsafeBytes { saltBuffer in
          cortex_argon2id_raw(
            UInt32(timeCost),
            UInt32(memoryCost),
            UInt32(parallelism),
            passwordBuffer.baseAddress,
            passwordBytes.count,
            saltBuffer.baseAddress,
            salt.count,
            hashBuffer.baseAddress,
            hashLength
          )
        }
      }
    }
    guard code == 0 else {
      throw CortexCryptoError.argon2(String(cString: cortex_argon2_error_message(code)))
    }
    return hash
  }
}
