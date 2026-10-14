package expo.modules.cortexnative

import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import org.bouncycastle.math.ec.rfc7748.X25519

object CortexCrypto {
  private const val GCM_TAG_BITS = 128
  private const val SHA256_LENGTH = 32

  fun aesGcmSeal(key: ByteArray, nonce: ByteArray, plaintext: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
    return cipher.doFinal(plaintext)
  }

  fun aesGcmOpen(key: ByteArray, nonce: ByteArray, ciphertext: ByteArray, tag: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
    return cipher.doFinal(ciphertext + tag)
  }

  fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: String, length: Int): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(if (salt.isEmpty()) ByteArray(SHA256_LENGTH) else salt, "HmacSHA256"))
    val prk = mac.doFinal(ikm)
    mac.init(SecretKeySpec(prk, "HmacSHA256"))
    val infoBytes = info.toByteArray(Charsets.UTF_8)
    val output = ByteArray(length)
    var block = ByteArray(0)
    var offset = 0
    var counter = 1
    while (offset < length) {
      mac.update(block)
      mac.update(infoBytes)
      mac.update(counter.toByte())
      block = mac.doFinal()
      val count = minOf(block.size, length - offset)
      System.arraycopy(block, 0, output, offset, count)
      offset += count
      counter += 1
    }
    return output
  }

  fun x25519PublicKey(privateKey: ByteArray): ByteArray {
    val publicKey = ByteArray(X25519.POINT_SIZE)
    X25519.generatePublicKey(privateKey, 0, publicKey, 0)
    return publicKey
  }

  fun x25519SharedSecret(privateKey: ByteArray, publicKey: ByteArray): ByteArray {
    val secret = ByteArray(X25519.POINT_SIZE)
    check(X25519.calculateAgreement(privateKey, 0, publicKey, 0, secret, 0)) { "Invalid X25519 public key" }
    return secret
  }

  fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

  fun argon2id(
    password: String,
    salt: ByteArray,
    memoryCost: Int,
    timeCost: Int,
    parallelism: Int,
    hashLength: Int
  ): ByteArray {
    val parameters = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
      .withVersion(Argon2Parameters.ARGON2_VERSION_13)
      .withIterations(timeCost)
      .withMemoryAsKB(memoryCost)
      .withParallelism(parallelism)
      .withSalt(salt)
      .build()
    val generator = Argon2BytesGenerator()
    generator.init(parameters)
    val hash = ByteArray(hashLength)
    generator.generateBytes(password.toByteArray(Charsets.UTF_8), hash)
    return hash
  }
}
