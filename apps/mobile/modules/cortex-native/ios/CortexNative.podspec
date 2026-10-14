Pod::Spec.new do |s|
  s.name           = 'CortexNative'
  s.version        = '1.0.0'
  s.summary        = 'Cortex native helpers'
  s.description    = 'Security-scoped bookmarks and PDF text extraction for Cortex'
  s.author         = ''
  s.homepage       = 'https://cortex.md'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit'
  s.source_files   = '**/*.{h,m,swift}'
end
