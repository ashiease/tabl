export const theme = {
  colors: {
    bg: '#000000',
    surface: '#0a0a0a',
    surface2: '#141414',
    border: '#1f1f1f',
    borderBright: '#2e2e2e',
    text: '#ffffff',
    textDim: '#808080',
    textFaint: '#4a4a4a',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    blue: '#3b82f6',
  },
  fonts: {
    // Inter — the UI workhorse. Use for anything a human reads as a word:
    // headers, subtitles, buttons, labels, descriptions, section labels.
    sans:        'Inter_400Regular',
    sansMedium:  'Inter_500Medium',
    sansSemi:    'Inter_600SemiBold',
    sansBold:    'Inter_700Bold',

    // JetBrains Mono — for numbers, table IDs, and timers. Never for prose.
    mono:        'JetBrainsMono_400Regular',
    monoMedium:  'JetBrainsMono_500Medium',
    monoBold:    'JetBrainsMono_700Bold',

    // Backwards-compat aliases so any component still referencing the
    // old theme.fonts.* keys resolves. Prefer the named roles above.
    display:     'Inter_600SemiBold',
    mono2:       'JetBrainsMono_400Regular',
  },
  radius: 12,
};