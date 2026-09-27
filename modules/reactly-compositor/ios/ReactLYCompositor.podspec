Pod::Spec.new do |s|
  s.name           = 'ReactLYCompositor'
  s.version        = '1.0.0'
  s.summary        = 'Local native video composition for ReactLY.'
  s.description    = 'Consumes ReactLY frame plans and exports device-local reaction videos.'
  s.author         = 'ReactLY'
  s.homepage       = 'https://github.com/'
  s.platform       = :ios, '16.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
