#include "CortexArgon2.h"
#include "argon2/argon2.h"

int cortex_argon2id_raw(uint32_t time_cost, uint32_t memory_cost_kib, uint32_t parallelism,
                        const void *password, size_t password_length, const void *salt,
                        size_t salt_length, void *hash, size_t hash_length) {
  return argon2id_hash_raw(time_cost, memory_cost_kib, parallelism, password, password_length,
                           salt, salt_length, hash, hash_length);
}

const char *cortex_argon2_error_message(int code) {
  return argon2_error_message(code);
}
