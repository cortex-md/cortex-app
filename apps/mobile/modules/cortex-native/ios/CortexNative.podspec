Pod::Spec.new do |s|
  s.name           = 'CortexNative'
  s.version        = '1.0.0'
  s.summary        = 'Cortex native helpers'
  s.description    = 'Security-scoped bookmarks, PDF text extraction and sync cryptography for Cortex'
  s.author         = ''
  s.homepage       = 'https://cortex.md'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit', 'CryptoKit'
  s.source_files   = '**/*.{h,m,c,swift}'
  s.public_header_files = 'CortexArgon2.h'
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '"${PODS_TARGET_SRCROOT}/argon2"',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) ARGON2_NO_THREADS=1'
  }
end
