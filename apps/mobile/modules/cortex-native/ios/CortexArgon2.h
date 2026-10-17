#ifndef CORTEX_ARGON2_H
#define CORTEX_ARGON2_H

#include <stddef.h>
#include <stdint.h>

int cortex_argon2id_raw(uint32_t time_cost, uint32_t memory_cost_kib, uint32_t parallelism,
                        const void *password, size_t password_length, const void *salt,
                        size_t salt_length, void *hash, size_t hash_length);

const char *cortex_argon2_error_message(int code);

#endif
